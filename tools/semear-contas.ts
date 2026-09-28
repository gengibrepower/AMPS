/**
 * Cria as duas contas de teste do Felipe, pela API.
 *
 *   npm run seed:contas          # precisa do `npm run dev` de pé
 *
 * - felipedono@teste.com  dono, com um pátio simples e um que usa tudo que o
 *   editor sabe fazer: os quatro papéis de nó, os cinco tipos de vaga, sensor,
 *   mão única, peso editado à mão e vaga em ângulo.
 * - felipeuser@teste.com  cliente, com carros de modelos diferentes.
 *
 * Publicar exige o Merlian de pé na 3000 (RN-11 confere alcançabilidade lá).
 * Sem ele o seeder avisa e deixa os pátios como rascunho.
 *
 * Roda de novo sem estragar nada: conta que já existe segue para o login, e
 * pátio com o mesmo nome é reaproveitado em vez de duplicado.
 */
import { Desenho, pedir, rotacaoDaVaga } from './comum.js';
import type { Grafo, No, Ponto } from './comum.js';

const DONO = {
    nome: 'Felipe Dono',
    email: 'felipedono@teste.com',
    cpf: '222.333.444-55',
    senha: 'teste1234',
    razao: 'Gegembauer Estacionamentos LTDA',
    cnpj: '98.765.432/0001-10',
};

const CLIENTE = {
    nome: 'Felipe Usuario',
    email: 'felipeuser@teste.com',
    cpf: '333.444.555-66',
    senha: 'teste1234',
};

const CARROS = [
    { placa: 'MHK4B21', modelo: 'Fiat Mobi' },
    { placa: 'QLZ7C09', modelo: 'Hyundai HB20' },
    { placa: 'RDT2A88', modelo: 'Toyota Corolla' },
    { placa: 'SCF9E14', modelo: 'Jeep Compass' },
];

/**
 * Meio-fio + metade do comprimento da vaga. A faixa de mão dupla é desenhada
 * com 3.2 m para cada lado do nó (LARGURA_DA_FAIXA em render/arestas.ts), e
 * meia vaga são 2.5: abaixo de 5.7 a vaga aparece por cima do asfalto. 6 é o
 * primeiro inteiro que serve, e inteiro é o que cai na grade de 1 m do editor.
 */
const RECUO = 6;

/** Entre centros de vagas vizinhas: 2.5 de largura não cai na grade, 3 cai. */
const PASSO = 3;

/** A 45° a vaga ocupa (2.5 + 5) / raiz(2) ≈ 5.3 na direção da fila. */
const PASSO_EM_ANGULO = 6;

/**
 * Cuidado com a distância às ruas: a rotação sai da rua MAIS PRÓXIMA, e vaga
 * equidistante de duas (a 6 da principal e a 6 da coluna, por exemplo) sai
 * deitada, perpendicular à rua errada. Por isso as colunas começam em y=10 e
 * as fileiras horizontais em x=7, fora da vertical das colunas.
 */
interface Fila {
    readonly setor: string;
    readonly rua: readonly string[];
    readonly de: Ponto;
    readonly passo: Ponto;
    readonly quantidade: number;
    /** As primeiras vagas da fila, que é a ponta encostada na rua principal. */
    readonly reservadas?: readonly string[];
    /** Só quando a vaga não é perpendicular à rua — a fila em ângulo. */
    readonly rotacao?: number;
}

interface VagaWire {
    readonly no_id: string;
    readonly numero: string;
    readonly tipo: string;
    readonly rotacao_graus: number;
    readonly sensor: string | null;
}

// `s` é o prefixo que o editor dá a candidate. Sem ele o setor F colidiria
// com os nós f1..f4 da rua do fundo, e o grafo nem chega a gravar.
function idDaVaga(setor: string, indice: number): string {
    return `s${setor}${String(indice + 1).padStart(2, '0')}`;
}

function tipoDaVaga(fila: Fila, indice: number): string {
    return (fila.reservadas ?? [])[indice] ?? 'comum';
}

function desenharFilas(desenho: Desenho, filas: readonly Fila[]): Fila[] {
    for (const fila of filas) {
        for (let i = 0; i < fila.quantidade; i++) {
            const x = fila.de.x + fila.passo.x * i;
            const y = fila.de.y + fila.passo.y * i;
            const id = desenho.vaga(idDaVaga(fila.setor, i), x, y);
            desenho.liga(desenho.maisPerto(fila.rua, { x, y }), id);
        }
    }
    return [...filas];
}

function vagasDasFilas(grafo: Grafo, filas: readonly Fila[]): VagaWire[] {
    const porId = new Map(grafo.nodes.map((no) => [no.id, no]));
    const vagas: VagaWire[] = [];

    for (const fila of filas) {
        for (let i = 0; i < fila.quantidade; i++) {
            const no = porId.get(idDaVaga(fila.setor, i)) as No;
            vagas.push({
                no_id: no.id,
                numero: `${fila.setor}-${String(i + 1).padStart(2, '0')}`,
                tipo: tipoDaVaga(fila, i),
                rotacao_graus: fila.rotacao ?? rotacaoDaVaga(grafo, no),
                sensor: i % 3 === 0 ? `SNS-${fila.setor}${String(i + 1).padStart(2, '0')}` : null,
            });
        }
    }
    return vagas;
}

/** Uma rua, uma entrada, um destino, duas fileiras. O mínimo que se publica. */
function patioSimples(): { grafo: Grafo; vagas: VagaWire[] } {
    const d = new Desenho();
    d.no('e1', 'source', 0, 0, 'Portaria');
    d.no('t1', 'transit', 10, 0);
    d.no('t2', 'transit', 25, 0);
    d.no('p1', 'attractor', 32, 0, 'Acesso à praça');

    d.corrente(['e1', 't1', 't2']);
    d.liga('t2', 'p1');

    const filas = desenharFilas(d, [
        { setor: 'N', rua: ['t1', 't2'], de: { x: 10, y: -RECUO }, passo: { x: PASSO, y: 0 }, quantidade: 6, reservadas: ['pcd', 'idoso'] },
        { setor: 'S', rua: ['t1', 't2'], de: { x: 10, y: RECUO }, passo: { x: PASSO, y: 0 }, quantidade: 6 },
    ]);

    const grafo = d.grafo();
    return { grafo, vagas: vagasDasFilas(grafo, filas) };
}

/**
 * Duas entradas, três destinos, um anel de ruas e quatro coisas que só
 * aparecem quando alguém usa o editor a sério:
 *
 *   - `m2 -> c2 -> f2` existe num sentido só (mão única);
 *   - `m3 -> c3` tem peso 55 contra 20 métricos (rampa, peso editado à mão),
 *     e a volta `c3 -> m3` ficou na distância real;
 *   - o setor H está a 45° num ramal, que é a vaga em ângulo;
 *   - sensor em uma vaga a cada três, o resto sem.
 */
function patioComplexo(): { grafo: Grafo; vagas: VagaWire[] } {
    const d = new Desenho();

    d.no('e1', 'source', 0, 0, 'Entrada Norte');
    d.no('e2', 'source', 0, 40, 'Entrada Sul');

    [12, 30, 48, 60].forEach((x, i) => d.no(`m${i + 1}`, 'transit', x, 0));
    [12, 30, 48, 60].forEach((x, i) => d.no(`f${i + 1}`, 'transit', x, 40));
    [12, 30, 48].forEach((x, i) => d.no(`c${i + 1}`, 'transit', x, 20));
    d.no('g1', 'transit', 66, -14);

    d.no('p1', 'attractor', 68, 0, 'Elevador Torre A');
    d.no('p2', 'attractor', 30, 48, 'Praça de alimentação');
    d.no('p3', 'attractor', 68, 40, 'Escada Torre B');

    d.corrente(['e1', 'm1', 'm2', 'm3', 'm4']);
    d.corrente(['e2', 'f1', 'f2', 'f3', 'f4']);
    d.corrente(['m1', 'c1', 'f1']);

    d.liga('m2', 'c2');
    d.liga('c2', 'f2');

    d.liga('m3', 'c3', 55);
    d.liga('c3', 'm3');
    d.corrente(['c3', 'f3']);

    d.liga('m4', 'p1');
    d.liga('f2', 'p2');
    d.liga('f4', 'p3');
    d.ligaNosDoisSentidos('m4', 'g1');

    const filas = desenharFilas(d, [
        { setor: 'A', rua: ['m1', 'm2', 'm3'], de: { x: 7, y: -RECUO }, passo: { x: PASSO, y: 0 }, quantidade: 12, reservadas: ['pcd', 'pcd', 'idoso', 'idoso'] },
        { setor: 'B', rua: ['m1', 'c1', 'f1'], de: { x: 12 - RECUO, y: 10 }, passo: { x: 0, y: PASSO }, quantidade: 8, reservadas: ['eletrico', 'eletrico'] },
        { setor: 'C', rua: ['m1', 'c1', 'f1'], de: { x: 12 + RECUO, y: 10 }, passo: { x: 0, y: PASSO }, quantidade: 8, reservadas: ['moto', 'moto', 'moto'] },
        { setor: 'D', rua: ['m2', 'c2', 'f2'], de: { x: 30 - RECUO, y: 10 }, passo: { x: 0, y: PASSO }, quantidade: 8, reservadas: ['pcd', 'idoso'] },
        { setor: 'E', rua: ['m2', 'c2', 'f2'], de: { x: 30 + RECUO, y: 10 }, passo: { x: 0, y: PASSO }, quantidade: 8, reservadas: ['eletrico'] },
        { setor: 'F', rua: ['m3', 'c3', 'f3'], de: { x: 48 - RECUO, y: 10 }, passo: { x: 0, y: PASSO }, quantidade: 8, reservadas: ['moto'] },
        { setor: 'G', rua: ['f1', 'f2'], de: { x: 7, y: 40 + RECUO }, passo: { x: PASSO, y: 0 }, quantidade: 6, reservadas: ['pcd', 'idoso', 'moto', 'eletrico'] },
        { setor: 'H', rua: ['g1'], de: { x: 51, y: -21 }, passo: { x: PASSO_EM_ANGULO, y: 0 }, quantidade: 5, rotacao: 45 },
    ]);

    const grafo = d.grafo();
    return { grafo, vagas: vagasDasFilas(grafo, filas) };
}

const PATIOS = [
    {
        nome: 'Estacionamento da Praça',
        endereco: {
            cep: '89010-200',
            logradouro: 'Rua Sete de Setembro',
            numero: '480',
            bairro: 'Centro',
            complemento: 'ao lado da praça',
            cidade: 'Blumenau',
            estado: 'SC',
        },
        desenho: patioSimples(),
    },
    {
        nome: 'Shopping Beira-Rio',
        endereco: {
            cep: '89025-100',
            logradouro: 'Rua Itajaí',
            numero: '3000',
            bairro: 'Vorstadt',
            complemento: 'subsolo G1',
            cidade: 'Blumenau',
            estado: 'SC',
        },
        desenho: patioComplexo(),
    },
];

async function conta(rota: string, cadastro: object, email: string, senha: string): Promise<string> {
    try {
        await pedir(rota, { method: 'POST', body: JSON.stringify(cadastro) });
        console.log(`${email}: criado`);
    } catch (erro) {
        if (!String(erro).includes('409')) throw erro;
        console.log(`${email}: já existia`);
    }

    const sessao = await pedir<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
    });
    return sessao.token;
}

async function patio(nome: string, endereco: object, token: string): Promise<number> {
    const meus = await pedir<{ id: number; nome: string }[]>('/estacionamentos', {}, token);
    const achado = meus.find((item) => item.nome === nome);
    if (achado !== undefined) return achado.id;

    const criado = await pedir<{ id: number }>('/estacionamentos', {
        method: 'POST',
        body: JSON.stringify({ nome, ...endereco }),
    }, token);
    return criado.id;
}

/**
 * A ordem que os triggers impõem (docs/05-editor.md): a vaga do nó que vai
 * sumir sai primeiro, senão `topologias_valida_update` recusa a topologia
 * nova. Só pesa quando o layout daqui encolhe entre duas execuções.
 */
async function apagarVagasOrfas(id: number, grafo: Grafo, token: string): Promise<number> {
    const mapa = await pedir<{ vagas: { no_id: string }[] }>(
        `/estacionamentos/${id}/mapa`, {}, token,
    );
    const nos = new Set(grafo.nodes.map((no) => no.id));
    const orfas = mapa.vagas.filter((vaga) => !nos.has(vaga.no_id));

    for (const vaga of orfas) {
        await pedir(`/estacionamentos/${id}/vagas/${vaga.no_id}`, { method: 'DELETE' }, token);
    }
    return orfas.length;
}

async function publicar(id: number, nome: string, token: string): Promise<string> {
    try {
        await pedir(`/estacionamentos/${id}/publicacao`, { method: 'POST' }, token);
        return 'publicado';
    } catch (erro) {
        if (String(erro).includes('503')) return 'rascunho (Merlian fora do ar na 3000)';
        return `rascunho (${String(erro).replace(/^Error: /, '')})`;
    }
}

const tokenDono = await conta('/donos', DONO, DONO.email, DONO.senha);

for (const { nome, endereco, desenho } of PATIOS) {
    const id = await patio(nome, endereco, tokenDono);
    const orfas = await apagarVagasOrfas(id, desenho.grafo, tokenDono);

    const topologia = await pedir<{ versao: number }>(
        `/estacionamentos/${id}/topologia`,
        { method: 'PUT', body: JSON.stringify(desenho.grafo) },
        tokenDono,
    );
    await pedir(
        `/estacionamentos/${id}/vagas`,
        { method: 'PUT', body: JSON.stringify(desenho.vagas) },
        tokenDono,
    );

    const situacao = await publicar(id, nome, tokenDono);
    const tipos = [...new Set(desenho.vagas.map((v) => v.tipo))];
    const angulos = [...new Set(desenho.vagas.map((v) => v.rotacao_graus))].sort((a, b) => a - b);

    console.log(
        `  ${nome} (id ${id}): versao ${topologia.versao}, ${desenho.grafo.nodes.length} nós, ` +
        `${desenho.grafo.edges.length} arestas, ${desenho.vagas.length} vagas\n` +
        `    tipos ${tipos.join(', ')} | angulos ${angulos.join(', ')} | ${situacao}` +
        (orfas === 0 ? '' : `\n    ${orfas} vaga(s) de uma execução anterior apagadas antes`),
    );
}

const tokenCliente = await conta('/usuarios', CLIENTE, CLIENTE.email, CLIENTE.senha);

const modelos = await pedir<{ id: number; marca: string; nome: string }[]>('/modelos');
const jaTem = await pedir<{ placa: string }[]>('/carros', {}, tokenCliente);

for (const { placa, modelo } of CARROS) {
    if (jaTem.some((carro) => carro.placa === placa)) {
        console.log(`  ${placa} (${modelo}): já existia`);
        continue;
    }

    const achado = modelos.find((item) => `${item.marca} ${item.nome}` === modelo);
    if (achado === undefined) {
        console.log(`  ${placa}: modelo "${modelo}" não está em /modelos, pulando`);
        continue;
    }

    await pedir('/carros', {
        method: 'POST',
        body: JSON.stringify({ placa, modelo_id: achado.id }),
    }, tokenCliente);
    console.log(`  ${placa} (${modelo}): cadastrado`);
}

console.log(`\ndono    ${DONO.email} / ${DONO.senha}`);
console.log(`cliente ${CLIENTE.email} / ${CLIENTE.senha}`);
