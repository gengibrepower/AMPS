import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// A navegação por tipo de conta no navegador de verdade: quem se cadastra pelo
// formulário, quem entra, e o que cada conta passa a enxergar no menu.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

const SENHA = 'segredo-de-teste';

let navegador: Navegador;
let carimbo: string;
let emailDono: string;
let sessaoCliente: unknown;

async function pedir<T>(rota: string, corpo?: unknown): Promise<T> {
    const resposta = await fetch(`${API}${rota}`, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json' },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    });
    if (!resposta.ok) throw new Error(`${rota}: ${resposta.status}`);
    return (await resposta.json()) as T;
}

function espere(ms: number): Promise<void> {
    return new Promise((pronto) => setTimeout(pronto, ms));
}

async function clicar(seletor: string): Promise<void> {
    const meio = await navegador.js<{ x: number; y: number }>(`(() => {
        const r = document.querySelector(${JSON.stringify(seletor)}).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await navegador.mouse('mouseMoved', meio.x, meio.y);
    await navegador.mouse('mousePressed', meio.x, meio.y, {
        botao: 'left',
        cliques: 1,
        botoesPressionados: 1,
    });
    await navegador.mouse('mouseReleased', meio.x, meio.y, { botao: 'left', cliques: 1 });
}

async function preencher(seletor: string, valor: string): Promise<void> {
    await clicar(seletor);
    await navegador.digitar(valor);
}

// A sidebar fecha ao abrir o painel de conta, então cada leitura do menu a
// reabre em vez de supor que ela ficou de pé.
async function itensDoMenu(): Promise<readonly string[]> {
    await clicar('#menu-button');
    const itens = await navegador.js<readonly string[]>(
        // O último filho é o texto; o primeiro é o span do ícone.
        `Array.from(document.querySelectorAll('.nav-item-area a'), (a) => a.lastChild.textContent.trim())`,
    );
    await clicar('#close-sidebar-button');
    return itens;
}

async function abrirConta(): Promise<void> {
    await clicar('#menu-button');
    await clicar('#sidebarAccountBtn');
}

async function entrar(email: string): Promise<void> {
    await abrirConta();
    await preencher('#email', email);
    await preencher('#senha', SENHA);
    await clicar('#login-form button[type="submit"]');
    await espere(1200);
    await clicar('#closeLogin');
}

async function gravarSessao(sessao: unknown): Promise<void> {
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
}

beforeAll(async () => {
    // Sorteado, não tirado do relógio: o CNPJ usa os dois últimos dígitos e
    // suítes que levam segundos quase inteiros repetem `ms % 100`.
    carimbo = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    emailDono = `dono${carimbo}@ex.com`;

    const emailCliente = `cli${carimbo}@ex.com`;
    await pedir('/usuarios', {
        nome: 'Cliente E2E',
        email: emailCliente,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.111-00`,
        senha: SENHA,
    });
    sessaoCliente = await pedir('/auth/login', { email: emailCliente, senha: SENHA });

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js('localStorage.clear()');
    await navegador.ir(`${WEB}/index.html`);
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('navegação por tipo de conta', () => {
    it('deslogado só enxerga a busca', async () => {
        expect(await itensDoMenu()).toEqual(['Buscar estacionamento']);
        expect(
            await navegador.js<boolean>(
                'document.getElementById("navArea").classList.contains("disabled")',
            ),
        ).toBe(true);
    });

    it('cadastra um dono pelo formulário', async () => {
        await abrirConta();
        await clicar('#linkRegisterOwner');

        await preencher('#nome-dono', 'Dono E2E');
        await preencher('#email-dono', emailDono);
        await preencher('#cpf-dono', `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.789-00`);
        await preencher('#razao-dono', 'E2E LTDA');
        await preencher('#cnpj-dono', `${carimbo.slice(0, 2)}.345.678/0001-${carimbo.slice(6, 8)}`);
        await preencher('#senha-dono', SENHA);
        await clicar('#owner-form button[type="submit"]');
        await espere(600);

        expect(await navegador.texto('#owner-msg')).toContain('cadastrado');
        await espere(1000);
        await clicar('#closeLogin');
    });

    it('o dono passa a ver os pátios, e o menu leva ao hub', async () => {
        await entrar(emailDono);

        expect(await itensDoMenu()).toEqual(['Buscar estacionamento', 'Meus pátios']);

        await clicar('#menu-button');
        await clicar('.nav-item-area a[href="owner/estacionamentos.html"]');
        await espere(2500);

        expect(await navegador.js<string>('location.pathname')).toContain(
            '/owner/estacionamentos.html',
        );
        expect(
            await navegador.js<boolean>(
                'document.getElementById("bloqueio").classList.contains("disabled")',
            ),
        ).toBe(true);
    });

    it('o cliente vê os carros, não os pátios', async () => {
        await navegador.ir(`${WEB}/index.html`);
        await gravarSessao(sessaoCliente);
        await navegador.ir(`${WEB}/index.html`);

        expect(await itensDoMenu()).toEqual(['Buscar estacionamento', 'Meus carros']);
    });

    // "Meus carros" aponta para `carro.html`, que ainda não existe: criá-la é o
    // primeiro passo de docs/07-cadastro-de-carro.md. Por isso o teste para no
    // menu e não segue o link.
});
