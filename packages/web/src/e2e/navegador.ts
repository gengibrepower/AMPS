import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Driver mínimo do Chrome DevTools Protocol. Existe porque evento sintético
// (dispatchEvent) não prova nada sobre interação: ele pula a captura de
// ponteiro, o foco e o grafo de acerto do Konva. Aqui o input é o mesmo que o
// navegador entrega a uma pessoa.

interface Resposta {
    readonly id?: number;
    readonly result?: { readonly result?: { readonly value?: unknown }; readonly data?: string };
    readonly error?: { readonly message?: string };
}

export type TipoDeTecla = 'rawKeyDown' | 'keyUp';
export type TipoDeMouse = 'mousePressed' | 'mouseReleased' | 'mouseMoved';
export type Botao = 'none' | 'left' | 'middle' | 'right';

export interface OpcoesDoMouse {
    readonly botao?: Botao;
    readonly cliques?: number;
    readonly botoesPressionados?: number;
}

export interface Navegador {
    ir(url: string, espera?: number): Promise<void>;
    js<T>(expressao: string): Promise<T>;
    texto(seletor: string): Promise<string>;
    tecla(tipo: TipoDeTecla, codigo: string, chave: string, virtual: number): Promise<void>;
    mouse(tipo: TipoDeMouse, x: number, y: number, opcoes?: OpcoesDoMouse): Promise<void>;
    roda(x: number, y: number, dx: number, dy: number, comCtrl?: boolean): Promise<void>;
    foto(caminho: string): Promise<void>;
    fechar(): Promise<void>;
}

export const LARGURA = 1280;
export const ALTURA = 760;

function espere(ms: number): Promise<void> {
    return new Promise((pronto) => setTimeout(pronto, ms));
}

async function acharAlvo(porta: number): Promise<string> {
    for (let tentativa = 0; tentativa < 80; tentativa++) {
        try {
            const resposta = await fetch(`http://localhost:${porta}/json/list`);
            const alvos = (await resposta.json()) as { type: string; webSocketDebuggerUrl: string }[];
            const pagina = alvos.find((alvo) => alvo.type === 'page');
            if (pagina !== undefined) return pagina.webSocketDebuggerUrl;
        } catch {
            // o navegador ainda não subiu
        }
        await espere(250);
    }
    throw new Error('o Chromium não abriu a porta de depuração');
}

export async function abrirNavegador(): Promise<Navegador> {
    const porta = 9300 + Math.floor(Math.random() * 400);
    const perfil = await mkdtemp(join(tmpdir(), 'amps-e2e-'));
    const processo: ChildProcess = spawn('chromium', [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        `--remote-debugging-port=${porta}`,
        `--user-data-dir=${perfil}`,
        `--window-size=${LARGURA},${ALTURA}`,
        'about:blank',
    ], { stdio: 'ignore' });

    const socket = new WebSocket(await acharAlvo(porta));
    await new Promise<void>((pronto, falhou) => {
        socket.addEventListener('open', () => pronto(), { once: true });
        socket.addEventListener('error', () => falhou(new Error('não conectou no CDP')), { once: true });
    });

    let proximoId = 0;

    function comando(metodo: string, params: Record<string, unknown> = {}): Promise<Resposta> {
        proximoId += 1;
        const id = proximoId;
        return new Promise((pronto, falhou) => {
            const ouvinte = (evento: MessageEvent): void => {
                const mensagem = JSON.parse(String(evento.data)) as Resposta;
                if (mensagem.id !== id) return;
                socket.removeEventListener('message', ouvinte);
                if (mensagem.error !== undefined) {
                    falhou(new Error(`${metodo}: ${mensagem.error.message ?? 'erro'}`));
                    return;
                }
                pronto(mensagem);
            };
            socket.addEventListener('message', ouvinte);
            socket.send(JSON.stringify({ id, method: metodo, params }));
        });
    }

    async function js<T>(expressao: string): Promise<T> {
        const resposta = await comando('Runtime.evaluate', {
            expression: expressao,
            returnByValue: true,
        });
        return resposta.result?.result?.value as T;
    }

    return {
        js,
        async ir(url, espera = 2500) {
            await comando('Page.navigate', { url });
            await espere(espera);
        },
        async texto(seletor) {
            return (await js<string>(
                `document.querySelector(${JSON.stringify(seletor)})?.textContent ?? ''`,
            )) ?? '';
        },
        async tecla(tipo, codigo, chave, virtual) {
            await comando('Input.dispatchKeyEvent', {
                type: tipo,
                code: codigo,
                key: chave,
                windowsVirtualKeyCode: virtual,
                nativeVirtualKeyCode: virtual,
            });
        },
        async mouse(tipo, x, y, opcoes = {}) {
            await comando('Input.dispatchMouseEvent', {
                type: tipo,
                x,
                y,
                button: opcoes.botao ?? 'none',
                clickCount: opcoes.cliques ?? 0,
                buttons: opcoes.botoesPressionados ?? 0,
            });
        },
        async roda(x, y, dx, dy, comCtrl = false) {
            await comando('Input.dispatchMouseEvent', {
                type: 'mouseWheel',
                x,
                y,
                deltaX: dx,
                deltaY: dy,
                modifiers: comCtrl ? 2 : 0,
            });
        },
        async foto(caminho) {
            const resposta = await comando('Page.captureScreenshot');
            await writeFile(caminho, Buffer.from(resposta.result?.data ?? '', 'base64'));
        },
        async fechar() {
            socket.close();
            processo.kill();
        },
    };
}
