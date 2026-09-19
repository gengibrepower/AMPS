import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CTRL, abrirNavegador } from './navegador';
import type { Navegador } from './navegador';

// Fatia 4 no navegador de verdade. Suíte própria porque o pátio precisa de
// vagas cadastradas pelo servidor — com sensor — para provar que o inspetor
// edita o que veio do banco e devolve o resto intacto.
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const WEB = process.env['E2E_WEB_URL'] ?? 'http://localhost:5173';

interface Ponto {
    readonly x: number;
    readonly y: number;
}

let navegador: Navegador;
let paraTela: (metros: Ponto) => Ponto;

// Duas vagas ao sul da alameda e o meio da rua, todos em metros do modelo.
const VAGA_A: Ponto = { x: 8, y: 5.7 };
const VAGA_B: Ponto = { x: 12, y: 5.7 };
const NA_RUA: Ponto = { x: 6, y: 1.6 };
const VAZIO: Ponto = { x: 2, y: 9 };

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

async function gravar(rota: string, token: string, corpo: unknown): Promise<void> {
    const resposta = await fetch(`${API}${rota}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo),
    });
    if (!resposta.ok) throw new Error(`${rota}: ${resposta.status}`);
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
    const a = await sondar(400, 300);
    const b = await sondar(800, 500);
    const porMetroX = (800 - 400) / (b.x - a.x);
    const porMetroY = (500 - 300) / (b.y - a.y);

    return (metros) => ({
        x: 400 + (metros.x - a.x) * porMetroX,
        y: 300 + (metros.y - a.y) * porMetroY,
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

const ENTER = (): Promise<void> => apertar('Enter', 'Enter', 13);
const DESFAZER = (): Promise<void> => apertar('KeyZ', 'z', 90, CTRL);

function valor(seletor: string): Promise<string> {
    return navegador.js<string>(
        `document.querySelector(${JSON.stringify(seletor)})?.value ?? ''`,
    );
}

function visivel(seletor: string): Promise<boolean> {
    return navegador.js<boolean>(
        `!document.querySelector(${JSON.stringify(seletor)})?.classList.contains("disabled")`,
    );
}

// Clique de verdade no campo, pelo retângulo que ele ocupa: o inspetor é DOM
// comum, mas o foco tem que vir do ponteiro como viria de uma pessoa.
async function clicarNoCampo(seletor: string): Promise<void> {
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

// Os campos gravam no `change`, que para texto sai no Enter ou ao perder o
// foco: por isso o Enter no fim.
async function preencher(seletor: string, texto: string): Promise<void> {
    await clicarNoCampo(seletor);
    await apertar('KeyA', 'a', 65, CTRL);
    await navegador.digitar(texto);
    await ENTER();
}

beforeAll(async () => {
    // Sorteado, não tirado do relógio: o CNPJ usa os dois últimos dígitos, e
    // suítes que levam segundos quase inteiros repetem `ms % 100` — aí o
    // /donos devolve 409 e o beforeAll inteiro cai.
    const carimbo = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const email = `insp${carimbo}@ex.com`;
    await pedir('/donos', {
        nome: 'Teste Inspetor',
        email,
        cpf: `${carimbo.slice(0, 3)}.${carimbo.slice(3, 6)}.789-00`,
        senha: 'segredo-de-teste',
        razao: 'Inspetor LTDA',
        cnpj: `${carimbo.slice(0, 2)}.345.678/0001-${carimbo.slice(6, 8)}`,
    });
    const sessao = await pedir<{ token: string }>('/auth/login', {
        email,
        senha: 'segredo-de-teste',
    });
    const patio = await pedir<{ id: number }>(
        '/estacionamentos',
        { nome: `Pátio Inspetor ${carimbo}` },
        sessao.token,
    );

    await gravar(`/estacionamentos/${patio.id}/topologia`, sessao.token, topologia());
    await gravar(`/estacionamentos/${patio.id}/vagas`, sessao.token, VAGAS);

    navegador = await abrirNavegador();
    await navegador.ir(`${WEB}/index.html`);
    await navegador.js(
        `localStorage.setItem("amps:session", ${JSON.stringify(JSON.stringify(sessao))})`,
    );
    await navegador.ir(`${WEB}/owner/editor.html?estacionamento=${patio.id}`, 4000);
    paraTela = await calibrar();
}, 90_000);

afterAll(async () => {
    await navegador?.fechar();
});

describe('inspetor', () => {
    it('sem seleção não mostra campo nenhum', async () => {
        expect(await visivel('#inspetorVazio')).toBe(true);
        expect(await visivel('#inspetorNo')).toBe(false);
        expect(await visivel('#inspetorAresta')).toBe(false);
    });

    it('a vaga chega com o que o servidor gravou', async () => {
        expect(await clicarEm(VAGA_A)).toContain('vaga');

        expect(await navegador.texto('#inspetorId')).toBe('s1');
        expect(await navegador.texto('#inspetorPapel')).toBe('vaga');
        expect(await valor('#campoNumero')).toBe('A-01');
        expect(await valor('#campoTipo')).toBe('pcd');
        expect(await valor('#campoRotacao')).toBe('0');
    });

    // Painel de nó e painel de aresta não podem aparecer juntos.
    it('um painel de cada vez', async () => {
        expect(await visivel('#inspetorNo')).toBe(true);
        expect(await visivel('#inspetorAresta')).toBe(false);

        expect(await clicarEm(NA_RUA)).toContain('→');
        expect(await visivel('#inspetorNo')).toBe(false);
        expect(await visivel('#inspetorAresta')).toBe(true);
    });

    it('a aresta mostra o peso gravado e a distância real', async () => {
        expect(await valor('#campoPeso')).toBe('16');
        expect(await navegador.texto('#dicaPeso')).toContain('16,00 m');
    });

    it('edita o peso à mão e desfaz', async () => {
        await preencher('#campoPeso', '42.5');
        expect(await valor('#campoPeso')).toBe('42.5');
        expect(await navegador.texto('#alterado')).toBe('sim');

        await DESFAZER();
        expect(await valor('#campoPeso')).toBe('16');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    // Mover um nó não refaz o peso sozinho; o botão é a ação explícita.
    it('recalcular traz o peso de volta para a distância', async () => {
        await preencher('#campoPeso', '99');
        expect(await valor('#campoPeso')).toBe('99');

        await clicarNoCampo('#recalcular');
        expect(await valor('#campoPeso')).toBe('16');

        await DESFAZER();
        await DESFAZER();
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('renomeia o nó pelo rótulo', async () => {
        await clicarEm(VAGA_A);
        await preencher('#campoRotulo', 'Vaga da frente');
        expect(await navegador.texto('#alterado')).toBe('sim');

        await clicarEm(VAZIO);
        await clicarEm(VAGA_A);
        expect(await valor('#campoRotulo')).toBe('Vaga da frente');

        await DESFAZER();
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('os botões de grau giram a vaga', async () => {
        await clicarEm(VAGA_A);
        await clicarNoCampo('[data-graus="90"]');

        expect(await valor('#campoRotacao')).toBe('90');
        expect(await navegador.texto('#alterado')).toBe('sim');

        await DESFAZER();
        expect(await valor('#campoRotacao')).toBe('0');
    });

    it('aceita rotação fora dos quatro cantos, para espinha de peixe', async () => {
        await preencher('#campoRotacao', '45');
        expect(await valor('#campoRotacao')).toBe('45');

        await DESFAZER();
        expect(await valor('#campoRotacao')).toBe('0');
    });

    // vagas tem UNIQUE em (estacionamento_id, numero): o 422 do trigger é rede
    // de segurança, não fluxo normal.
    it('recusa número que já é de outra vaga', async () => {
        await preencher('#campoNumero', 'A-02');

        expect(await navegador.texto('#inspetorErro')).toContain('A-02');
        expect(await valor('#campoNumero')).toBe('A-01');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    it('aceita número livre e desfaz', async () => {
        await preencher('#campoNumero', 'B-07');
        expect(await valor('#campoNumero')).toBe('B-07');
        expect(await navegador.texto('#inspetorErro')).toBe('');

        await DESFAZER();
        expect(await valor('#campoNumero')).toBe('A-01');
        expect(await navegador.texto('#alterado')).toBe('não');
    });

    // O editor não sequestra atalho de dentro de campo de formulário, então o
    // Ctrl+Z só vale depois que o tipo perde o foco — clicar no título basta.
    it('o tipo sai do teclado e vira um passo do desfazer', async () => {
        await navegador.js('document.getElementById("campoTipo").focus()');
        await apertar('ArrowDown', 'ArrowDown', 40);

        expect(await valor('#campoTipo')).not.toBe('pcd');
        expect(await navegador.texto('#alterado')).toBe('sim');

        await clicarNoCampo('#inspetorId');
        await DESFAZER();
        expect(await valor('#campoTipo')).toBe('pcd');
    });

    it('nó que não é vaga não mostra os campos de vaga', async () => {
        await clicarEm({ x: 0, y: 0 });
        expect(await navegador.texto('#inspetorId')).toBe('e1');
        expect(await visivel('#inspetorNo')).toBe(true);
        expect(await visivel('#inspetorVaga')).toBe(false);
    });

    it('clicar no vazio volta para "nada selecionado"', async () => {
        await clicarEm(VAZIO);
        expect(await visivel('#inspetorVazio')).toBe(true);
        expect(await visivel('#inspetorNo')).toBe(false);
    });
});
