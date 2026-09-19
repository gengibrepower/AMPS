import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CTRL, abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// Fatia 3 no navegador de verdade: criar, mover e apagar nó com o mouse, e
// desfazer. Precisa da API e do vite de pé (`npm run dev`) e do MySQL. O pátio
// é criado pela própria suíte, num navegador só dela: as outras suítes arrastam
// e dão zoom no palco, e aqui a conta de metros para tela precisa valer.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

interface Ponto {
    readonly x: number;
    readonly y: number;
}

// Pontos livres do pátio, ao sul da fileira de vagas. Saem da própria sondagem
// do cursor em vez de metro chutado: o enquadramento inicial deixa pouca folga
// ao norte do corredor, e um metro escolhido no papel cai fora da tela.
let LIVRE: Ponto;
let DESTINO: Ponto;
let OUTRO: Ponto;

// Uma rua de teste a leste do POI, onde o pátio é vazio. A faixa da ida e a da
// volta ficam a 1,6 m de cada lado do eixo, então cada sentido tem um ponto só
// dele: é isso que prova que a mão dupla nasceu com os dois.
let VIA_A: Ponto;
let VIA_B: Ponto;
let NA_IDA: Ponto;
let NA_VOLTA: Ponto;

let navegador: Navegador;
let paraTela: (metros: Ponto) => Ponto;

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

// Uma alameda de mão dupla e três vagas encostadas nela: o bastante para a vaga
// nova ter uma rua de onde deduzir a rotação.
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

function comoNumero(leitura: string): number {
    return Number(leitura.replace(' m', '').replace(',', '.'));
}

async function sondar(x: number, y: number): Promise<Ponto> {
    await navegador.mouse('mouseMoved', x, y);
    return {
        x: comoNumero(await navegador.texto('#cursorX')),
        y: comoNumero(await navegador.texto('#cursorY')),
    };
}

interface Area {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
}

function areaDoPalco(): Promise<Area> {
    return navegador.js<Area>(`(() => {
        const r = document.getElementById('palco').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`);
}

// Ponto do palco por fração do lado, não por pixel: a barra de ferramentas e o
// inspetor mudam a largura do canvas, e pixel chutado passa a cair em cima do
// painel — o cursor não lê nada e a conta vira NaN.
function naArea(area: Area, fracaoX: number, fracaoY: number): Ponto {
    return { x: area.x + area.w * fracaoX, y: area.y + area.h * fracaoY };
}

async function noPalco(fracaoX: number, fracaoY: number): Promise<Ponto> {
    const alvo = naArea(await areaDoPalco(), fracaoX, fracaoY);
    return sondar(alvo.x, alvo.y);
}

// O enquadramento depende do tamanho da janela, então a conversão sai de duas
// sondagens do próprio cursor em vez de pixel chutado.
async function calibrar(): Promise<(metros: Ponto) => Ponto> {
    const area = await areaDoPalco();
    const telaA = naArea(area, 0.3, 0.4);
    const telaB = naArea(area, 0.7, 0.75);

    const a = await sondar(telaA.x, telaA.y);
    const b = await sondar(telaB.x, telaB.y);
    const porMetroX = (telaB.x - telaA.x) / (b.x - a.x);
    const porMetroY = (telaB.y - telaA.y) / (b.y - a.y);

    return (metros) => ({
        x: telaA.x + (metros.x - a.x) * porMetroX,
        y: telaA.y + (metros.y - a.y) * porMetroY,
    });
}

// As ferramentas encaixam na grade de 1 m: mirar no metro inteiro faz o clique
// cair no centro do que foi criado ali.
function noMetro(metros: Ponto): Ponto {
    return { x: Math.round(metros.x), y: Math.round(metros.y) };
}

async function clicarEm(metros: Ponto): Promise<string> {
    const tela = paraTela(metros);
    await navegador.mouse('mouseMoved', tela.x, tela.y);
    await navegador.mouse('mousePressed', tela.x, tela.y, {
        botao: 'left',
        cliques: 1,
        botoesPressionados: 1,
    });
    await navegador.mouse('mouseReleased', tela.x, tela.y, { botao: 'left', cliques: 1 });
    return navegador.texto('#selecao');
}

async function arrastarDe(origem: Ponto, destino: Ponto): Promise<void> {
    const de = paraTela(origem);
    const para = paraTela(destino);

    await navegador.mouse('mouseMoved', de.x, de.y);
    await navegador.mouse('mousePressed', de.x, de.y, {
        botao: 'left',
        cliques: 1,
        botoesPressionados: 1,
    });
    for (let passo = 1; passo <= 8; passo++) {
        await navegador.mouse('mouseMoved',
            de.x + ((para.x - de.x) * passo) / 8,
            de.y + ((para.y - de.y) * passo) / 8,
            { botao: 'left', botoesPressionados: 1 });
    }
    await navegador.mouse('mouseReleased', para.x, para.y, { botao: 'left', cliques: 1 });
}

async function apertar(codigo: string, chave: string, virtual: number, mods = 0): Promise<void> {
    await navegador.tecla('rawKeyDown', codigo, chave, virtual, mods);
    await navegador.tecla('keyUp', codigo, chave, virtual, mods);
}

const VAGA = (): Promise<void> => apertar('Digit1', '1', 49);
const VIA = (): Promise<void> => apertar('Digit3', '3', 51);
const LIGAR = (): Promise<void> => apertar('KeyA', 'a', 65);
const ENTRADA = (): Promise<void> => apertar('Digit2', '2', 50);
const APONTAR = (): Promise<void> => apertar('KeyV', 'v', 86);
const ESC = (): Promise<void> => apertar('Escape', 'Escape', 27);
const DEL = (): Promise<void> => apertar('Delete', 'Delete', 46);
const DESFAZER = (): Promise<void> => apertar('KeyZ', 'z', 90, CTRL);

async function contagem(): Promise<string> {
    await ESC();
    return navegador.texto('#selecao');
}

beforeAll(async () => {
    // Sorteado, não tirado do relógio: o CNPJ usa os dois últimos dígitos, e
    // suítes que levam segundos quase inteiros repetem `ms % 100` — aí o
    // /donos devolve 409 e o beforeAll inteiro cai.
    const carimbo = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const email = `tools${carimbo}@ex.com`;
    await pedir('/donos', {
        nome: 'Teste Ferramentas',
        email,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.789-00`,
        senha: 'segredo-de-teste',
        razao: 'Ferramentas LTDA',
        cnpj: `${carimbo.slice(0, 2)}.345.678/0001-${carimbo.slice(6, 8)}`,
    });
    const sessao = await pedir<{ token: string }>('/auth/login', {
        email,
        senha: 'segredo-de-teste',
    });
    const patio = await pedir<{ id: number }>(
        '/estacionamentos',
        { nome: `Pátio Ferramentas ${carimbo}` },
        sessao.token,
    );

    const resposta = await fetch(`${API}/estacionamentos/${patio.id}/topologia`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sessao.token}` },
        body: JSON.stringify(patioDeTeste()),
    });
    if (!resposta.ok) throw new Error(`topologia: ${resposta.status}`);

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
    await navegador.ir(`${WEB}/owner/editor.html?estacionamento=${patio.id}`, 4000);
    paraTela = await calibrar();

    LIVRE = noMetro(await noPalco(0.70, 0.87));
    DESTINO = noMetro(await noPalco(0.87, 0.87));
    OUTRO = noMetro(await noPalco(0.30, 0.87));

    VIA_A = noMetro(await noPalco(0.93, 0.59));
    VIA_B = noMetro(await noPalco(0.93, 0.87));
    const meio = (VIA_A.y + VIA_B.y) / 2;
    NA_IDA = { x: VIA_A.x - 1, y: meio };
    NA_VOLTA = { x: VIA_A.x + 1, y: meio };
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('ferramentas do editor', () => {
    it('abre limpo, com seis nós e nada alterado', async () => {
        expect(await navegador.texto('#selecao')).toBe('6 nós');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('os pontos de trabalho estão mesmo vazios', async () => {
        expect(await clicarEm(LIVRE)).toBe('6 nós');
        expect(await clicarEm(DESTINO)).toBe('6 nós');
        expect(await clicarEm(OUTRO)).toBe('6 nós');
    });

    it('a tecla arma a ferramenta na barra', async () => {
        await VAGA();
        expect(await navegador.js<string | null>(
            'document.querySelector(\'[data-ferramenta="candidate"]\')?.getAttribute("aria-pressed")',
        )).toBe('true');

        await APONTAR();
        expect(await navegador.js<string | null>(
            'document.querySelector(\'[data-ferramenta="selecionar"]\')?.getAttribute("aria-pressed")',
        )).toBe('true');
    });

    it('cria uma vaga no clique e marca o pátio como alterado', async () => {
        await VAGA();
        expect(await clicarEm(LIVRE)).toContain('vaga');
        expect(await navegador.texto('#alterado')).toBe('sim');
        expect(await contagem()).toBe('7 nós');
    });

    it('a vaga criada está mesmo lá e recebe clique', async () => {
        await APONTAR();
        expect(await clicarEm(LIVRE)).toContain('vaga');
    });

    // Encaixe de 1 m: arrasto que passa do limiar de 4 px mas pousa no mesmo
    // metro não é mudança nenhuma. Quem prova isso é o Ctrl+Z do teste seguinte,
    // que tem de apagar a vaga inteira e não um arrasto que nunca aconteceu.
    it('arrasto menor que o encaixe não tira o nó do lugar', async () => {
        await arrastarDe(LIVRE, { x: LIVRE.x + 0.3, y: LIVRE.y + 0.3 });
        expect(await clicarEm(LIVRE)).toContain('vaga');
    });

    it('Ctrl+Z desfaz a criação e devolve o pátio ao que o servidor mandou', async () => {
        await DESFAZER();
        expect(await contagem()).toBe('6 nós');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('Ctrl+Z no fundo da pilha não faz nada', async () => {
        await DESFAZER();
        expect(await contagem()).toBe('6 nós');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('arrasta o nó para longe e ele fica no lugar novo', async () => {
        await VAGA();
        await clicarEm(LIVRE);
        await APONTAR();

        await arrastarDe(LIVRE, DESTINO);
        expect(await clicarEm(DESTINO)).toContain('vaga');
        expect(await clicarEm(LIVRE)).toBe('7 nós');
    });

    it('Ctrl+Z desfaz só o arrasto, sem levar a criação junto', async () => {
        await DESFAZER();
        expect(await clicarEm(LIVRE)).toContain('vaga');
        expect(await navegador.texto('#alterado')).toBe('sim');
    });

    it('Del apaga o nó selecionado', async () => {
        await clicarEm(LIVRE);
        await DEL();
        expect(await contagem()).toBe('6 nós');
    });

    it('Ctrl+Z traz o nó apagado de volta', async () => {
        await DESFAZER();
        expect(await contagem()).toBe('7 nós');
        expect(await clicarEm(LIVRE)).toContain('vaga');
    });

    it('cada ferramenta cria o seu tipo de nó', async () => {
        await ENTRADA();
        expect(await clicarEm(OUTRO)).toContain('entrada');
        expect(await contagem()).toBe('8 nós');
    });

    it('Esc volta para o ponteiro e limpa a seleção', async () => {
        await VAGA();
        await ESC();
        expect(await navegador.js<string | null>(
            'document.querySelector(\'[data-ferramenta="selecionar"]\')?.getAttribute("aria-pressed")',
        )).toBe('true');
        expect(await navegador.texto('#selecao')).toBe('8 nós');
    });

    // Sem a ferramenta de aresta o nó novo nasce solto e não vira rua nenhuma:
    // é a ligação que faz o corredor existir para ser desenhado.
    it('liga dois nós e a rua aparece no lugar onde ela passa', async () => {
        await VIA();
        await clicarEm(VIA_A);
        await clicarEm(VIA_B);
        expect(await contagem()).toBe('10 nós');

        await LIGAR();
        await clicarEm(VIA_A);
        await clicarEm(VIA_B);

        await APONTAR();
        expect(await clicarEm(NA_IDA)).toBe('t2 → t3');
    });

    // 3,2 m por sentido: a ida e a volta ocupam faixas diferentes do asfalto, e
    // cada uma recebe clique no seu lado do eixo.
    it('entre vias a rua nasce de mão dupla, com as duas faixas', async () => {
        expect(await clicarEm(NA_VOLTA)).toBe('t3 → t2');
    });

    // Tirar um sentido deixa a rua de mão única, e mão única é desenhada
    // centrada no eixo com 3,2 m em vez de duas faixas deslocadas: a que sobrou
    // passa a ocupar também o lado onde a ida estava.
    it('Del tira um sentido e a mão única recentra no eixo', async () => {
        await clicarEm(NA_IDA);
        await DEL();

        expect(await clicarEm(NA_IDA)).toBe('t3 → t2');
        expect(await clicarEm(NA_VOLTA)).toBe('t3 → t2');
    });

    it('Ctrl+Z devolve o sentido apagado', async () => {
        await DESFAZER();
        expect(await clicarEm(NA_IDA)).toBe('t2 → t3');
    });
});
