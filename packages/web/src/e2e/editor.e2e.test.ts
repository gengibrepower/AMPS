import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// Precisa da API e do vite de pé (`npm run dev`) e do MySQL. O pátio é criado
// pela própria suíte, para não depender de nada semeado à mão.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

const VAZIO = 250;
const NUMA_VAGA = { x: 640, y: 480 };

let navegador: Navegador;
let estacionamentoId: number;

async function pedir<T>(rota: string, corpo?: unknown, token?: string): Promise<T> {
    const resposta = await fetch(`${API}${rota}`, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: {
            'content-type': 'application/json',
            ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    if (!resposta.ok) throw new Error(`${rota}: ${resposta.status}`);
    return (await resposta.json()) as T;
}

async function gravarTopologia(id: number, token: string, grafo: unknown): Promise<void> {
    const resposta = await fetch(`${API}/estacionamentos/${id}/topologia`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(grafo),
    });
    if (!resposta.ok) throw new Error(`topologia: ${resposta.status}`);
}

// Pátio mínimo: uma alameda de mão dupla e três vagas encostadas nela.
function patioDeTeste(): unknown {
    const MEIO = 3.2 + 2.5;
    return {
        nodes: [
            { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
            { id: 't1', role: 'transit', position: { x: 12, y: 0 } },
            { id: 'p1', role: 'attractor', position: { x: 20, y: 0 } },
            ...[8, 10.5, 13].map((x, i) => ({
                id: `s${i + 1}`,
                role: 'candidate',
                position: { x, y: MEIO },
                dimensions: { width: 2.5, length: 5 },
            })),
        ],
        edges: [
            { from: 'e1', to: 't1', weight: 12 },
            { from: 't1', to: 'e1', weight: 12 },
            { from: 't1', to: 'p1', weight: 8 },
            ...[1, 2, 3].map((n) => ({ from: 't1', to: `s${n}`, weight: 6 })),
        ],
    };
}

async function arrastar(
    botao: 'left' | 'middle',
    botoes: number,
    passo: number,
    comEspaco = false,
): Promise<void> {
    if (comEspaco) {
        await navegador.tecla('rawKeyDown', 'Space', ' ', 32);
    }
    await navegador.mouse('mousePressed', VAZIO, 600, { botao, cliques: 1, botoesPressionados: botoes });
    for (let i = 1; i <= 8; i++) {
        await navegador.mouse('mouseMoved', VAZIO + i * passo, 600, {
            botao,
            botoesPressionados: botoes,
        });
    }
    await navegador.mouse('mouseReleased', VAZIO + 8 * passo, 600, { botao, cliques: 1 });
    if (comEspaco) {
        await navegador.tecla('keyUp', 'Space', ' ', 32);
    }
}

async function sonda(x = VAZIO, y = 600): Promise<string> {
    await navegador.mouse('mouseMoved', x, y);
    return navegador.texto('#cursorX');
}

async function clicar(x: number, y: number): Promise<string> {
    await navegador.mouse('mouseMoved', x, y);
    await navegador.mouse('mousePressed', x, y, { botao: 'left', cliques: 1, botoesPressionados: 1 });
    await navegador.mouse('mouseReleased', x, y, { botao: 'left', cliques: 1 });
    return navegador.texto('#selecao');
}

beforeAll(async () => {
    const carimbo = Date.now().toString().slice(-8);
    const email = `e2e${carimbo}@ex.com`;
    await pedir('/donos', {
        nome: 'Teste E2E',
        email,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.789-00`,
        senha: 'segredo-de-teste',
        razao: 'E2E LTDA',
        cnpj: `${carimbo.slice(0, 2)}.345.678/0001-${carimbo.slice(6, 8)}`,
    });
    const sessao = await pedir<{ token: string }>('/auth/login', {
        email,
        senha: 'segredo-de-teste',
    });
    const patio = await pedir<{ id: number }>(
        '/estacionamentos',
        { nome: `Pátio E2E ${carimbo}` },
        sessao.token,
    );
    estacionamentoId = patio.id;
    await gravarTopologia(estacionamentoId, sessao.token, patioDeTeste());

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
    await navegador.ir(`${WEB}/owner/editor.html?estacionamento=${estacionamentoId}`, 4000);
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('editor de pátio', () => {
    it('abre o pátio enquadrado e desenhado', async () => {
        expect(await navegador.texto('#nomeDoPatio')).toContain('Pátio E2E');
        expect(await navegador.texto('#selecao')).toBe('6 nós');
        expect(await navegador.texto('#versao')).toBe('1');
    });

    it('arrasta com o botão esquerdo no vazio', async () => {
        const antes = await sonda();
        await arrastar('left', 1, 15);
        expect(await sonda()).not.toBe(antes);
    });

    it('arrasta com o botão do meio', async () => {
        const antes = await sonda();
        await arrastar('middle', 4, -15);
        expect(await sonda()).not.toBe(antes);
    });

    it('arrasta com espaço e botão esquerdo', async () => {
        const antes = await sonda();
        await arrastar('left', 1, 12, true);
        expect(await sonda()).not.toBe(antes);
    });

    it('clique curto continua sendo clique, não arrasto', async () => {
        expect(await clicar(NUMA_VAGA.x, NUMA_VAGA.y)).toContain('vaga');
        expect(await clicar(VAZIO, 640)).not.toContain('vaga');
    });

    it('roda de mouse dá zoom', async () => {
        const antes = await navegador.texto('#nivelZoom');
        await navegador.mouse('mouseMoved', 640, 400);
        await navegador.roda(640, 400, 0, -120);
        expect(await navegador.texto('#nivelZoom')).not.toBe(antes);
    });

    it('dois dedos no trackpad deslocam sem mexer no zoom', async () => {
        const zoom = await navegador.texto('#nivelZoom');
        const antes = await sonda();
        await navegador.mouse('mouseMoved', 640, 400);
        await navegador.roda(640, 400, -18, 24);
        expect(await navegador.texto('#nivelZoom')).toBe(zoom);
        expect(await sonda()).not.toBe(antes);
    });

    it('pinça do trackpad dá zoom', async () => {
        const antes = await navegador.texto('#nivelZoom');
        await navegador.mouse('mouseMoved', 640, 400);
        await navegador.roda(640, 400, 0, -9, true);
        expect(await navegador.texto('#nivelZoom')).not.toBe(antes);
    });
});
