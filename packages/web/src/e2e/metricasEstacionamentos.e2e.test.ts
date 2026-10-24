import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// O cartão da lista leva ao painel do pátio, e o painel mostra o que a API
// contou. O clique é de verdade: o link se estica sobre o cartão por CSS, e só
// um clique confiável prova que ele cobre o cartão sem engolir as ações.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

const SENHA = 'segredo-de-teste';

const GRAFO = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 'p1', role: 'attractor', position: { x: 10, y: 0 } },
        ...['s1', 's2', 's3'].map((id, i) => ({
            id,
            role: 'candidate',
            position: { x: 2 + i * 3, y: 3 },
            dimensions: { width: 2.5, length: 5 },
        })),
    ],
    edges: [
        { from: 'e1', to: 's1', weight: 2 },
        { from: 's1', to: 's2', weight: 3 },
        { from: 's2', to: 's3', weight: 3 },
        { from: 's3', to: 'p1', weight: 2 },
    ],
};

let navegador: Navegador;
let sessao: { token: string };
let patioId: number;

async function pedir<T>(metodo: string, rota: string, corpo?: unknown): Promise<T> {
    const resposta = await fetch(`${API}${rota}`, {
        method: metodo,
        headers: {
            'content-type': 'application/json',
            ...(sessao === undefined ? {} : { authorization: `Bearer ${sessao.token}` }),
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    if (!resposta.ok) throw new Error(`${metodo} ${rota}: ${resposta.status}`);
    return (await resposta.json()) as T;
}

function espere(ms: number): Promise<void> {
    return new Promise((pronto) => setTimeout(pronto, ms));
}

async function clicar(seletor: string): Promise<void> {
    const ponto = await navegador.js<{ x: number; y: number }>(`(() => {
        const r = document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await clicarEm(ponto.x, ponto.y);
}

async function clicarEm(x: number, y: number): Promise<void> {
    await navegador.mouse('mouseMoved', x, y);
    await navegador.mouse('mousePressed', x, y, { botao: 'left', cliques: 1, botoesPressionados: 1 });
    await navegador.mouse('mouseReleased', x, y, { botao: 'left', cliques: 1 });
}

function caminhoAtual(): Promise<string> {
    return navegador.js<string>('location.pathname + location.search');
}

beforeAll(async () => {
    const carimbo = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const email = `painel${carimbo}@ex.com`;

    await pedir('POST', '/donos', {
        nome: 'Dono Painel',
        email,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.222-00`,
        senha: SENHA,
        razao: 'Painel LTDA',
        cnpj: `${carimbo.slice(0, 2)}.${carimbo.slice(2, 5)}.${carimbo.slice(5, 8)}/0001-00`,
    });
    sessao = await pedir('POST', '/auth/login', { email, senha: SENHA });

    const patio = await pedir<{ id: number }>('POST', '/estacionamentos', {
        nome: 'Pátio do Painel',
        cidade: 'Blumenau',
        estado: 'SC',
    });
    patioId = patio.id;
    await pedir('PUT', `/estacionamentos/${patioId}/topologia`, GRAFO);
    await pedir('PUT', `/estacionamentos/${patioId}/vagas`, [
        { no_id: 's1', numero: 'A-01' },
        { no_id: 's2', numero: 'A-02', tipo: 'pcd', sensor: 'sensor-2' },
    ]);

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('painel do pátio', () => {
    it('o botão de editar do cartão não leva ao painel', async () => {
        await navegador.ir(`${WEB}/owner/estacionamentos.html`);
        await espere(800);

        await clicar('.item button[title="Editar"]');
        await espere(300);

        expect(await caminhoAtual()).toBe('/owner/estacionamentos.html');
        expect(
            await navegador.js<boolean>(
                'document.getElementById("formPatio").classList.contains("disabled")',
            ),
        ).toBe(false);
    });

    it('clicar no cartão, fora do nome, abre o painel daquele pátio', async () => {
        await navegador.ir(`${WEB}/owner/estacionamentos.html`);
        await espere(800);

        // Entre o texto e as ações: só o ::after do link cobre esse ponto.
        const ponto = await navegador.js<{ x: number; y: number }>(`(() => {
            const info = document.querySelector('.item-info').getBoundingClientRect();
            const acoes = document.querySelector('.item-acoes').getBoundingClientRect();
            return { x: (info.right + acoes.left) / 2, y: info.y + info.height / 2 };
        })()`);
        await clicarEm(ponto.x, ponto.y);
        await espere(1200);

        expect(await caminhoAtual()).toBe(`/owner/metricas-estacionamentos.html?estacionamento=${patioId}`);
    });

    it('mostra as contagens que a API calculou', async () => {
        expect(await navegador.texto('#patioNome')).toBe('Pátio do Painel');
        expect(await navegador.texto('#patioEtiqueta')).toBe('Rascunho');
        expect(await navegador.texto('#kpiTotal')).toBe('2');
        expect(await navegador.texto('#kpiLivres')).toBe('2');
        expect(await navegador.texto('#kpiOcupacao')).toBe('0%');
        expect(
            await navegador.js<readonly string[]>(
                `Array.from(document.querySelectorAll('.tipo'), (li) => li.textContent)`,
            ),
        ).toEqual(['Comum1 de 1 livres', 'PCD1 de 1 livres']);
        expect(await navegador.js<string>('document.getElementById("abrirEditor").pathname + document.getElementById("abrirEditor").search'))
            .toBe(`/owner/editor.html?estacionamento=${patioId}`);
    });

    it('recusa pátio que não existe', async () => {
        await navegador.ir(`${WEB}/owner/metricas-estacionamentos.html?estacionamento=999999999`);
        await espere(800);

        expect(await navegador.texto('#bloqueioTexto')).toBe(
            'Este estacionamento não é seu ou não existe.',
        );
    });
});
