import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CTRL, abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// Fatia 5 no navegador de verdade: o que o editor grava tem que sobreviver a
// um F5. Suíte própria porque ela é a única que muda o banco pelo front.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

interface Ponto {
    readonly x: number;
    readonly y: number;
}

interface VagaNoBanco {
    readonly no_id: string;
    readonly numero: string;
    readonly tipo: string;
    readonly sensor: string | null;
}

interface Mapa {
    readonly versao: number;
    readonly grafo: { readonly nodes: readonly { readonly id: string }[] };
    readonly vagas: readonly VagaNoBanco[];
}

const MEIO_FIO = 3.2 + 2.5;
const VAGA_A: Ponto = { x: 8, y: MEIO_FIO };
const VAGA_B: Ponto = { x: 12, y: MEIO_FIO };
const LIVRE: Ponto = { x: 20, y: MEIO_FIO };
const VAZIO: Ponto = { x: 2, y: 11 };

let navegador: Navegador;
let paraTela: (metros: Ponto) => Ponto;
let token: string;
let patioId: number;

async function pedir<T>(rota: string, corpo?: unknown, comToken?: string): Promise<T> {
    const resposta = await fetch(`${API}${rota}`, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: {
            'content-type': 'application/json',
            ...(comToken === undefined ? {} : { authorization: `Bearer ${comToken}` }),
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    if (!resposta.ok) throw new Error(`${rota}: ${resposta.status}`);
    return (await resposta.json()) as T;
}

async function gravar(rota: string, corpo: unknown): Promise<void> {
    const resposta = await fetch(`${API}${rota}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
    });
    if (!resposta.ok) throw new Error(`${rota}: ${resposta.status}`);
}

function doBanco(): Promise<Mapa> {
    return pedir<Mapa>(`/estacionamentos/${patioId}/mapa`, undefined, token);
}

function topologia(): unknown {
    return {
        nodes: [
            { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
            { id: 't1', role: 'transit', position: { x: 16, y: 0 } },
            { id: 's1', role: 'candidate', position: VAGA_A, dimensions: { width: 2.5, length: 5 } },
            { id: 's2', role: 'candidate', position: VAGA_B, dimensions: { width: 2.5, length: 5 } },
        ],
        edges: [
            { from: 'e1', to: 't1', weight: 16 },
            { from: 't1', to: 'e1', weight: 16 },
            { from: 't1', to: 's1', weight: 9 },
            { from: 't1', to: 's2', weight: 6 },
        ],
    };
}

const VAGAS = [
    { no_id: 's1', numero: 'A-01', tipo: 'pcd', rotacao_graus: 0, sensor: 'esp32-01' },
    { no_id: 's2', numero: 'A-02', tipo: 'comum', rotacao_graus: 0, sensor: null },
];

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

async function calibrar(): Promise<(metros: Ponto) => Ponto> {
    const area = await navegador.js<{ x: number; y: number; w: number; h: number }>(`(() => {
        const r = document.getElementById('palco').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`);
    const telaA = { x: area.x + area.w * 0.3, y: area.y + area.h * 0.4 };
    const telaB = { x: area.x + area.w * 0.7, y: area.y + area.h * 0.75 };

    const a = await sondar(telaA.x, telaA.y);
    const b = await sondar(telaB.x, telaB.y);
    const porMetroX = (telaB.x - telaA.x) / (b.x - a.x);
    const porMetroY = (telaB.y - telaA.y) / (b.y - a.y);

    return (metros) => ({
        x: telaA.x + (metros.x - a.x) * porMetroX,
        y: telaA.y + (metros.y - a.y) * porMetroY,
    });
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

async function apertar(codigo: string, chave: string, virtual: number, mods = 0): Promise<void> {
    await navegador.tecla('rawKeyDown', codigo, chave, virtual, mods);
    await navegador.tecla('keyUp', codigo, chave, virtual, mods);
}

const VAGA = (): Promise<void> => apertar('Digit1', '1', 49);
const APONTAR = (): Promise<void> => apertar('KeyV', 'v', 86);
const DEL = (): Promise<void> => apertar('Delete', 'Delete', 46);
const DESFAZER = (): Promise<void> => apertar('KeyZ', 'z', 90, CTRL);

// O salvar é assíncrono: espera o botão voltar de "Salvando…" em vez de chutar
// um tempo fixo.
async function salvarEEsperar(): Promise<void> {
    await apertar('KeyS', 's', 83, CTRL);
    for (let tentativa = 0; tentativa < 60; tentativa++) {
        if (await navegador.texto('#salvar') !== 'Salvando…') return;
        await new Promise((pronto) => setTimeout(pronto, 100));
    }
    throw new Error('o salvar não terminou');
}

function salvarDesabilitado(): Promise<boolean> {
    return navegador.js<boolean>('document.getElementById("salvar").disabled');
}

async function abrirEditor(): Promise<void> {
    await navegador.ir(`${WEB}/owner/editor.html?estacionamento=${patioId}`, 4000);
    paraTela = await calibrar();
}

beforeAll(async () => {
    const carimbo = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const email = `grav${carimbo}@ex.com`;
    await pedir('/donos', {
        nome: 'Teste Gravação',
        email,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.789-00`,
        senha: 'segredo-de-teste',
        razao: 'Gravação LTDA',
        cnpj: `${carimbo.slice(0, 2)}.345.678/0001-${carimbo.slice(6, 8)}`,
    });
    const sessao = await pedir<{ token: string }>('/auth/login', {
        email,
        senha: 'segredo-de-teste',
    });
    token = sessao.token;

    const patio = await pedir<{ id: number }>(
        '/estacionamentos',
        { nome: `Pátio Gravação ${carimbo}` },
        token,
    );
    patioId = patio.id;

    await gravar(`/estacionamentos/${patioId}/topologia`, topologia());
    await gravar(`/estacionamentos/${patioId}/vagas`, VAGAS);

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
    await abrirEditor();
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('gravação', () => {
    it('abre limpo e sem nada para salvar', async () => {
        expect(await navegador.texto('#alterado')).toBe('não');
        expect(await salvarDesabilitado()).toBe(true);
        expect(await navegador.texto('#versao')).toBe('1');
    });

    it('mudar habilita o salvar', async () => {
        await VAGA();
        await clicarEm(LIVRE);
        await APONTAR();

        expect(await navegador.texto('#alterado')).toBe('sim');
        expect(await salvarDesabilitado()).toBe(false);
    });

    it('Ctrl+S grava, sobe a versão e limpa o alterado', async () => {
        await salvarEEsperar();

        expect(await navegador.texto('#avisoDeGravacao')).toBe('salvo');
        expect(await navegador.texto('#alterado')).toBe('não');
        expect(await navegador.texto('#versao')).toBe('2');
        expect(await salvarDesabilitado()).toBe(true);
    });

    it('o que foi gravado sobrevive ao recarregar', async () => {
        await abrirEditor();

        expect(await navegador.texto('#selecao')).toBe('5 nós');
        expect(await navegador.texto('#versao')).toBe('2');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('a vaga nova chegou ao banco', async () => {
        const mapa = await doBanco();
        expect(mapa.grafo.nodes).toHaveLength(5);
        expect(mapa.vagas).toHaveLength(3);
    });

    // O PUT /vagas é upsert da linha inteira: sem carregar o sensor de volta,
    // gravar apagaria o pareamento de toda vaga já cadastrada.
    it('o sensor de quem não foi tocado continua no banco', async () => {
        const mapa = await doBanco();
        expect(mapa.vagas.find((v) => v.no_id === 's1')?.sensor).toBe('esp32-01');
    });

    // A prova da ordem: o trigger recusa tirar do grafo um nó que ainda tem
    // vaga, então o DELETE tem que sair antes do PUT /topologia. Com a ordem
    // trocada isto falha com 422.
    it('apagar uma vaga e salvar respeita a ordem que o trigger impõe', async () => {
        await clicarEm(VAGA_B);
        await DEL();
        expect(await navegador.texto('#alterado')).toBe('sim');

        await salvarEEsperar();
        expect(await navegador.texto('#avisoDeGravacao')).toBe('salvo');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('a vaga apagada sumiu do grafo e da tabela', async () => {
        const mapa = await doBanco();
        expect(mapa.grafo.nodes.map((no) => no.id)).not.toContain('s2');
        expect(mapa.vagas.map((vaga) => vaga.no_id)).not.toContain('s2');
    });

    it('desfazer até o começo desabilita o salvar de novo', async () => {
        await clicarEm(VAGA_A);
        await DEL();
        expect(await salvarDesabilitado()).toBe(false);

        await DESFAZER();
        expect(await navegador.texto('#alterado')).toBe('não');
        expect(await salvarDesabilitado()).toBe(true);
    });

    it('clicar no vazio não inventa mudança', async () => {
        await clicarEm(VAZIO);
        expect(await navegador.texto('#alterado')).toBe('não');
        expect(await salvarDesabilitado()).toBe(true);
    });
});
