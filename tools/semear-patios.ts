/**
 * Cria a conta de teste e dois pátios com topologia e vagas, pela API.
 *
 *   npm run seed:patios          # precisa do `npm run dev` de pé
 *
 * A rotação de cada vaga é deduzida da rua em que ela encosta e GRAVADA — é o
 * que a ferramenta de criar vaga vai fazer. Sem isso a vaga nasce a 0° e deita
 * no sentido errado, porque `vagas.rotacao_graus` manda no desenho.
 */

const API = process.env['SEED_API_URL'] ?? 'http://localhost:3001';

const DONO = {
    nome: 'Ana Souza',
    email: 'ana@teste.com',
    cpf: '111.222.333-44',
    senha: 'teste1234',
    razao: 'Souza Estacionamentos LTDA',
    cnpj: '12.345.678/0001-99',
};

const LARGURA = 2.5;
const COMPRIMENTO = 5;
const MEIO_FIO_DUPLO = 3.2;
const MEIO_FIO_UNICO = 1.6;
const RECUO_DUPLO = MEIO_FIO_DUPLO + COMPRIMENTO / 2;
const RECUO_UNICO = MEIO_FIO_UNICO + COMPRIMENTO / 2;

interface Ponto {
    x: number;
    y: number;
}

interface No {
    id: string;
    role: 'source' | 'transit' | 'attractor' | 'candidate';
    position: Ponto;
    label?: string;
    dimensions?: { width: number; length: number };
}

interface Aresta {
    from: string;
    to: string;
    weight: number;
}

interface Grafo {
    nodes: No[];
    edges: Aresta[];
}

async function pedir<T>(rota: string, opcoes: RequestInit = {}, token?: string): Promise<T> {
    const resposta = await fetch(`${API}${rota}`, {
        ...opcoes,
        headers: {
            'content-type': 'application/json',
            ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
            ...(opcoes.headers ?? {}),
        },
    });
    if (!resposta.ok) {
        throw new Error(`${opcoes.method ?? 'GET'} ${rota}: ${resposta.status}`);
    }
    return (await resposta.json()) as T;
}

function distancia(a: Ponto, b: Ponto): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function projecaoNoSegmento(ponto: Ponto, de: Ponto, para: Ponto): Ponto {
    const dx = para.x - de.x;
    const dy = para.y - de.y;
    const quadrado = dx * dx + dy * dy;
    if (quadrado === 0) return de;
    const t = Math.min(1, Math.max(0, ((ponto.x - de.x) * dx + (ponto.y - de.y) * dy) / quadrado));
    return { x: de.x + dx * t, y: de.y + dy * t };
}

/** Mesma regra do desenho: perpendicular à rua em que a vaga encosta. */
function rotacaoDaVaga(grafo: Grafo, vaga: No): number {
    const porId = new Map(grafo.nodes.map((no) => [no.id, no]));
    let melhor: Ponto | null = null;
    let menor = Infinity;

    for (const aresta of grafo.edges) {
        const de = porId.get(aresta.from);
        const para = porId.get(aresta.to);
        if (de === undefined || para === undefined) continue;
        if (de.role === 'candidate' || para.role === 'candidate') continue;

        const ponto = projecaoNoSegmento(vaga.position, de.position, para.position);
        const afastamento = { x: vaga.position.x - ponto.x, y: vaga.position.y - ponto.y };
        const quanto = Math.hypot(afastamento.x, afastamento.y);
        if (quanto > 0 && quanto < menor) {
            menor = quanto;
            melhor = { x: afastamento.x / quanto, y: afastamento.y / quanto };
        }
    }
    if (melhor === null) return 0;

    const graus = (Math.atan2(melhor.y, melhor.x) * 180) / Math.PI - 90;
    return ((Math.round(graus) % 360) + 360) % 360;
}

function vaga(id: string, x: number, y: number): No {
    return {
        id,
        role: 'candidate',
        position: { x, y },
        dimensions: { width: LARGURA, length: COMPRIMENTO },
    };
}

function patioSimples(): Grafo {
    const nodes: No[] = [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 }, label: 'Portaria' },
        { id: 't1', role: 'transit', position: { x: 9, y: 0 } },
        { id: 't2', role: 'transit', position: { x: 24, y: 0 } },
        { id: 'p1', role: 'attractor', position: { x: 31, y: 0 }, label: 'Elevador' },
    ];
    const edges: Aresta[] = [
        { from: 'e1', to: 't1', weight: 9 }, { from: 't1', to: 'e1', weight: 9 },
        { from: 't1', to: 't2', weight: 15 }, { from: 't2', to: 't1', weight: 15 },
        { from: 't2', to: 'p1', weight: 7 },
    ];

    for (const [prefixo, sinal, xs] of [
        ['s', 1, [7.5, 10, 12.5, 15, 17.5, 20, 22.5]],
        ['n', -1, [10, 12.5, 15, 17.5, 20]],
    ] as [string, number, number[]][]) {
        xs.forEach((x, i) => {
            const id = `${prefixo}${i + 1}`;
            nodes.push(vaga(id, x, sinal * RECUO_DUPLO));
            edges.push({ from: 't1', to: id, weight: Number((Math.abs(x - 9) + RECUO_DUPLO).toFixed(1)) });
        });
    }
    return { nodes, edges };
}

function patioComplexo(): Grafo {
    const nodes: No[] = [];
    const edges: Aresta[] = [];
    const posicao = (id: string): Ponto => nodes.find((no) => no.id === id)!.position;
    const liga = (a: string, b: string): void => {
        edges.push({ from: a, to: b, weight: Number(distancia(posicao(a), posicao(b)).toFixed(1)) });
    };

    const COLUNAS = [14, 32, 50, 62];
    nodes.push({ id: 'e1', role: 'source', position: { x: 0, y: 0 }, label: 'Entrada' });
    COLUNAS.forEach((x, i) => nodes.push({ id: `m${i + 1}`, role: 'transit', position: { x, y: 0 } }));

    const principal = ['e1', ...COLUNAS.map((_, i) => `m${i + 1}`)];
    principal.slice(0, -1).forEach((a, i) => {
        liga(a, principal[i + 1]!);
        liga(principal[i + 1]!, a);
    });

    const FUNDO = 42;
    const RUAS = [14, 32, 50];
    RUAS.forEach((x, i) => {
        const corrente = [`m${i + 1}`];
        [14, 28, FUNDO].forEach((y, j) => {
            nodes.push({ id: `r${i + 1}_${j + 1}`, role: 'transit', position: { x, y } });
            corrente.push(`r${i + 1}_${j + 1}`);
        });
        corrente.slice(0, -1).forEach((a, k) => liga(a, corrente[k + 1]!));
    });

    nodes.push({ id: 'f0', role: 'transit', position: { x: 0, y: FUNDO } });
    ['r3_3', 'r2_3', 'r1_3', 'f0'].forEach((a, i) => {
        liga(a, ['r2_3', 'r1_3', 'f0', 'e1'][i]!);
    });

    nodes.push({ id: 'p1', role: 'attractor', position: { x: 70, y: 0 }, label: 'Elevador' });
    liga('m4', 'p1');
    nodes.push({ id: 'p2', role: 'attractor', position: { x: 32, y: 48 }, label: 'Loja' });
    liga('r2_3', 'p2');

    const maisPerto = (candidatos: string[], alvo: Ponto): string =>
        candidatos.reduce((melhor, id) =>
            distancia(posicao(id), alvo) < distancia(posicao(melhor), alvo) ? id : melhor);

    let contador = 0;
    RUAS.forEach((x, i) => {
        const via = [`m${i + 1}`, `r${i + 1}_1`, `r${i + 1}_2`, `r${i + 1}_3`];
        for (const lado of [-1, 1]) {
            for (let k = 0; k < 12; k++) {
                const y = 5 + k * LARGURA;
                contador += 1;
                const id = `v${String(contador).padStart(3, '0')}`;
                nodes.push(vaga(id, x + lado * RECUO_UNICO, y));
                liga(maisPerto(via, { x, y }), id);
            }
        }
    });

    for (let k = 0; k < 18; k++) {
        const x = 5 + k * LARGURA;
        contador += 1;
        const id = `v${String(contador).padStart(3, '0')}`;
        nodes.push(vaga(id, x, -RECUO_DUPLO));
        liga(maisPerto(principal, { x, y: 0 }), id);
    }

    return { nodes, edges };
}

function vagasDoGrafo(grafo: Grafo, setorDe: (posicao: Ponto) => string): unknown[] {
    const contadores = new Map<string, number>();
    return grafo.nodes
        .filter((no) => no.role === 'candidate')
        .map((no) => {
            const letra = setorDe(no.position);
            const n = (contadores.get(letra) ?? 0) + 1;
            contadores.set(letra, n);
            const tipo = n <= 2 ? 'pcd' : n <= 4 ? 'idoso' : n === 11 ? 'moto' : n === 12 ? 'eletrico' : 'comum';
            return {
                no_id: no.id,
                numero: `${letra}-${String(n).padStart(2, '0')}`,
                tipo,
                rotacao_graus: rotacaoDaVaga(grafo, no),
            };
        });
}

async function entrar(): Promise<string> {
    try {
        await pedir('/donos', { method: 'POST', body: JSON.stringify(DONO) });
    } catch {
        // já existe, segue para o login
    }
    const sessao = await pedir<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: DONO.email, senha: DONO.senha }),
    });
    return sessao.token;
}

async function patio(nome: string, token: string): Promise<number> {
    const meus = await pedir<{ id: number; nome: string }[]>('/estacionamentos', {}, token);
    const achado = meus.find((e) => e.nome === nome);
    if (achado !== undefined) return achado.id;

    const criado = await pedir<{ id: number }>('/estacionamentos', {
        method: 'POST',
        body: JSON.stringify({ nome, cidade: 'Blumenau', estado: 'SC' }),
    }, token);
    return criado.id;
}

const token = await entrar();

for (const [nome, grafo, setor] of [
    ['Pátio Centro', patioSimples(), (p: Ponto) => (p.y > 0 ? 'S' : 'N')],
    ['Shopping Ponta Aguda', patioComplexo(), (p: Ponto) => {
        const rua = [['A', 14], ['B', 32], ['C', 50]].find(([, x]) => Math.abs(p.x - (x as number)) < 8);
        return (rua?.[0] as string) ?? 'D';
    }],
] as [string, Grafo, (p: Ponto) => string][]) {
    const id = await patio(nome, token);
    const topologia = await pedir<{ versao: number }>(
        `/estacionamentos/${id}/topologia`,
        { method: 'PUT', body: JSON.stringify(grafo) },
        token,
    );
    const vagas = vagasDoGrafo(grafo, setor);
    const gravadas = await pedir<unknown[]>(
        `/estacionamentos/${id}/vagas`,
        { method: 'PUT', body: JSON.stringify(vagas) },
        token,
    );
    const angulos = [...new Set(vagas.map((v) => (v as { rotacao_graus: number }).rotacao_graus))];
    console.log(
        `${nome} (id ${id}): versao ${topologia.versao}, ${gravadas.length} vagas, ` +
        `angulos ${angulos.sort((a, b) => a - b).join(', ')}`,
    );
}

console.log(`\nentre com ${DONO.email} / ${DONO.senha}`);
