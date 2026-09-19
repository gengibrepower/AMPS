import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// Fatia 6 no navegador de verdade. Precisa do Merlian de pé na 3000 além da
// API e do vite: a alcançabilidade da RN-11 é ele quem responde.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

interface Ponto {
    readonly x: number;
    readonly y: number;
}

const MEIO_FIO = 3.2 + 2.5;
const VIA: Ponto = { x: 16, y: 0 };
// s2 nasce sem aresta de acesso: é a vaga que o Merlian vai recusar.
const LIGADA: Ponto = { x: 8, y: MEIO_FIO };
const SOLTA: Ponto = { x: 12, y: MEIO_FIO };

let navegador: Navegador;
let paraTela: (metros: Ponto) => Ponto;
let patioId: number;

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

function topologia(): unknown {
    return {
        nodes: [
            { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
            { id: 't1', role: 'transit', position: VIA },
            { id: 'p1', role: 'attractor', position: { x: 24, y: 0 } },
            { id: 's1', role: 'candidate', position: LIGADA, dimensions: { width: 2.5, length: 5 } },
            { id: 's2', role: 'candidate', position: SOLTA, dimensions: { width: 2.5, length: 5 } },
        ],
        edges: [
            { from: 'e1', to: 't1', weight: 16 },
            { from: 't1', to: 'e1', weight: 16 },
            { from: 't1', to: 'p1', weight: 8 },
            { from: 't1', to: 's1', weight: 9 },
        ],
    };
}

const VAGAS = [
    { no_id: 's1', numero: 'A-01', tipo: 'comum', rotacao_graus: 0, sensor: null },
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

    return (metros) => ({
        x: telaA.x + (metros.x - a.x) * ((telaB.x - telaA.x) / (b.x - a.x)),
        y: telaA.y + (metros.y - a.y) * ((telaB.y - telaA.y) / (b.y - a.y)),
    });
}

async function clicarNaTela(x: number, y: number): Promise<void> {
    await navegador.mouse('mouseMoved', x, y);
    await navegador.mouse('mousePressed', x, y, {
        botao: 'left',
        cliques: 1,
        botoesPressionados: 1,
    });
    await navegador.mouse('mouseReleased', x, y, { botao: 'left', cliques: 1 });
}

async function clicarEm(metros: Ponto): Promise<string> {
    const tela = paraTela(metros);
    await clicarNaTela(tela.x, tela.y);
    return navegador.texto('#selecao');
}

async function clicarNoBotao(seletor: string): Promise<void> {
    const meio = await navegador.js<{ x: number; y: number }>(`(() => {
        const r = document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await clicarNaTela(meio.x, meio.y);
}

async function apertar(codigo: string, chave: string, virtual: number): Promise<void> {
    await navegador.tecla('rawKeyDown', codigo, chave, virtual);
    await navegador.tecla('keyUp', codigo, chave, virtual);
}

// Publicar fala com o Merlian: espera o botão sair do desabilitado em vez de
// chutar um tempo fixo.
async function publicarEEsperar(): Promise<void> {
    await clicarNoBotao('#publicar');
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        const ocupado = await navegador.js<boolean>('document.getElementById("publicar").disabled');
        if (!ocupado) return;
        await new Promise((pronto) => setTimeout(pronto, 100));
    }
    throw new Error('a publicação não terminou');
}

beforeAll(async () => {
    const carimbo = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const email = `pub${carimbo}@ex.com`;
    await pedir('/donos', {
        nome: 'Teste Publicação',
        email,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.789-00`,
        senha: 'segredo-de-teste',
        razao: 'Publicação LTDA',
        cnpj: `${carimbo.slice(0, 2)}.345.678/0001-${carimbo.slice(6, 8)}`,
    });
    const sessao = await pedir<{ token: string }>('/auth/login', {
        email,
        senha: 'segredo-de-teste',
    });
    const patio = await pedir<{ id: number }>(
        '/estacionamentos',
        { nome: `Pátio Publicação ${carimbo}` },
        sessao.token,
    );
    patioId = patio.id;

    for (const [rota, corpo] of [
        [`/estacionamentos/${patioId}/topologia`, topologia()],
        [`/estacionamentos/${patioId}/vagas`, VAGAS],
    ] as const) {
        const resposta = await fetch(`${API}${rota}`, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${sessao.token}`,
            },
            body: JSON.stringify(corpo),
        });
        if (!resposta.ok) throw new Error(`${rota}: ${resposta.status}`);
    }

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
    await navegador.ir(`${WEB}/owner/editor.html?estacionamento=${patioId}`, 4000);
    paraTela = await calibrar();
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('publicação', () => {
    it('abre como rascunho', async () => {
        expect(await navegador.texto('#etiqueta')).toBe('Rascunho');
        expect(await navegador.texto('#publicar')).toBe('Publicar');
    });

    // A RN-11 confere entrada, vaga e POI na API; a alcançabilidade é o Merlian
    // quem responde, e é ela que recusa aqui.
    it('recusa e nomeia a vaga sem caminho até uma entrada', async () => {
        await publicarEEsperar();

        expect(await navegador.texto('#avisoDeGravacao')).toContain('A-02');
        expect(await navegador.texto('#etiqueta')).toBe('Rascunho');
        expect(await navegador.texto('#publicar')).toBe('Publicar');
    });

    // Publicar valida o que está no banco: com o editor sujo, o botão grava
    // antes, senão o dono publicaria um pátio diferente do que está vendo.
    // Clica na VAGA primeiro de propósito: o acesso tem de entrar nela venha o
    // clique de onde vier. Na ordem inversa nascia uma aresta saindo da vaga, e
    // o Merlian a considerava inalcançável — com razão.
    it('ligar a vaga pelo editor e publicar grava antes', async () => {
        await apertar('KeyA', 'a', 65);
        await clicarEm(SOLTA);
        await clicarEm(VIA);
        await apertar('KeyV', 'v', 86);
        expect(await navegador.texto('#alterado')).toBe('sim');

        await publicarEEsperar();

        expect(await navegador.texto('#alterado')).toBe('não');
        expect(await navegador.texto('#etiqueta')).toBe('Publicado');
        expect(await navegador.texto('#avisoDeGravacao')).toBe('publicado');
    });

    it('o botão vira despublicar', async () => {
        expect(await navegador.texto('#publicar')).toBe('Despublicar');
    });

    it('publicado sobrevive ao recarregar', async () => {
        await navegador.ir(`${WEB}/owner/editor.html?estacionamento=${patioId}`, 4000);
        paraTela = await calibrar();

        expect(await navegador.texto('#etiqueta')).toBe('Publicado');
        expect(await navegador.texto('#publicar')).toBe('Despublicar');
    });

    it('despublicar volta para rascunho', async () => {
        await publicarEEsperar();

        expect(await navegador.texto('#etiqueta')).toBe('Rascunho');
        expect(await navegador.texto('#publicar')).toBe('Publicar');
        expect(await navegador.texto('#avisoDeGravacao')).toBe('despublicado');
    });
});
