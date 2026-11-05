import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// O modal de conta fecha pelo X, pelo Esc e pelo véu, e não fecha quando o
// clique nasce dentro da caixa.
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

let navegador: Navegador;

function espere(ms: number): Promise<void> {
    return new Promise((pronto) => setTimeout(pronto, ms));
}

async function apertar(x: number, y: number): Promise<void> {
    await navegador.mouse('mousePressed', x, y, { botao: 'left', cliques: 1, botoesPressionados: 1 });
}

async function soltar(x: number, y: number): Promise<void> {
    await navegador.mouse('mouseReleased', x, y, { botao: 'left', cliques: 1 });
}

async function clicarEm(x: number, y: number): Promise<void> {
    await navegador.mouse('mouseMoved', x, y);
    await apertar(x, y);
    await soltar(x, y);
    await espere(200);
}

async function meio(seletor: string): Promise<{ x: number; y: number }> {
    return navegador.js<{ x: number; y: number }>(`(() => {
        const r = document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
}

async function abrir(): Promise<void> {
    const botao = await meio('.botao-entrar');
    await clicarEm(botao.x, botao.y);
}

function aberto(): Promise<boolean> {
    return navegador.js<boolean>(`!document.getElementById('accountPanel').classList.contains('disabled')`);
}

beforeAll(async () => {
    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`, 800);
    await navegador.js('localStorage.clear()');
    await navegador.ir(`${WEB}/index.html`, 1200);
}, 30_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('modal de conta', () => {
    it('fecha com Esc', async () => {
        await abrir();
        expect(await aberto()).toBe(true);

        await navegador.tecla('rawKeyDown', 'Escape', 'Escape', 27);
        await navegador.tecla('keyUp', 'Escape', 'Escape', 27);
        await espere(200);

        expect(await aberto()).toBe(false);
    });

    it('fecha com clique no véu, fora da caixa', async () => {
        await abrir();
        await clicarEm(20, 400);

        expect(await aberto()).toBe(false);
    });

    it('não fecha com clique dentro da caixa', async () => {
        await abrir();
        const caixa = await meio('.login-box h2');
        await clicarEm(caixa.x, caixa.y);

        expect(await aberto()).toBe(true);
    });

    it('não fecha quando o arrasto começa num campo e termina no véu', async () => {
        const campo = await meio('#email');
        await navegador.mouse('mouseMoved', campo.x, campo.y);
        await apertar(campo.x, campo.y);
        await navegador.mouse('mouseMoved', 20, 400, { botoesPressionados: 1 });
        await soltar(20, 400);
        await espere(200);

        expect(await aberto()).toBe(true);
    });
});
