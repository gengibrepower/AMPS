/**
 * O que os seeders compartilham: o cliente HTTP da API e a geometria do pátio.
 *
 * A rotação de cada vaga é deduzida da rua em que ela encosta e GRAVADA — é o
 * que a ferramenta de criar vaga faz. Sem isso a vaga nasce a 0° e deita no
 * sentido errado, porque `vagas.rotacao_graus` manda no desenho.
 */

export const API = process.env['SEED_API_URL'] ?? 'http://localhost:3001';

export const LARGURA = 2.5;
export const COMPRIMENTO = 5;

export interface Ponto {
    x: number;
    y: number;
}

export type Papel = 'source' | 'transit' | 'attractor' | 'candidate';

export interface No {
    id: string;
    role: Papel;
    position: Ponto;
    label?: string;
    dimensions?: { width: number; length: number };
}

export interface Aresta {
    from: string;
    to: string;
    weight: number;
}

export interface Grafo {
    nodes: No[];
    edges: Aresta[];
}

export async function pedir<T>(rota: string, opcoes: RequestInit = {}, token?: string): Promise<T> {
    const resposta = await fetch(`${API}${rota}`, {
        ...opcoes,
        headers: {
            'content-type': 'application/json',
            ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
            ...(opcoes.headers ?? {}),
        },
    });
    if (!resposta.ok) {
        const corpo = await resposta.text();
        throw new Error(`${opcoes.method ?? 'GET'} ${rota}: ${resposta.status} ${corpo}`);
    }
    if (resposta.status === 204) return null as T;
    return (await resposta.json()) as T;
}

export function distancia(a: Ponto, b: Ponto): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function projecaoNoSegmento(ponto: Ponto, de: Ponto, para: Ponto): Ponto {
    const dx = para.x - de.x;
    const dy = para.y - de.y;
    const quadrado = dx * dx + dy * dy;
    if (quadrado === 0) return de;
    const t = Math.min(1, Math.max(0, ((ponto.x - de.x) * dx + (ponto.y - de.y) * dy) / quadrado));
    return { x: de.x + dx * t, y: de.y + dy * t };
}

/** Mesma regra do desenho: perpendicular à rua em que a vaga encosta. */
export function rotacaoDaVaga(grafo: Grafo, vaga: No): number {
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

export function vaga(id: string, x: number, y: number): No {
    return {
        id,
        role: 'candidate',
        position: { x, y },
        dimensions: { width: LARGURA, length: COMPRIMENTO },
    };
}

/**
 * Monta um grafo acumulando nós e arestas, com o peso saindo da distância —
 * que é como o editor cria a aresta antes de alguém editar o peso na mão.
 */
export class Desenho {
    readonly nodes: No[] = [];
    readonly edges: Aresta[] = [];

    no(id: string, role: Papel, x: number, y: number, label?: string): string {
        this.nodes.push({ id, role, position: { x, y }, ...(label === undefined ? {} : { label }) });
        return id;
    }

    vaga(id: string, x: number, y: number): string {
        this.nodes.push(vaga(id, x, y));
        return id;
    }

    posicao(id: string): Ponto {
        const no = this.nodes.find((item) => item.id === id);
        if (no === undefined) throw new Error(`nó ${id} não existe`);
        return no.position;
    }

    /** Peso explícito só quando o dono teria mexido nele: rampa, mão difícil. */
    liga(de: string, para: string, peso?: number): void {
        this.edges.push({
            from: de,
            to: para,
            weight: peso ?? Number(distancia(this.posicao(de), this.posicao(para)).toFixed(1)),
        });
    }

    ligaNosDoisSentidos(de: string, para: string): void {
        this.liga(de, para);
        this.liga(para, de);
    }

    corrente(ids: readonly string[]): void {
        ids.slice(0, -1).forEach((id, i) => this.ligaNosDoisSentidos(id, ids[i + 1]!));
    }

    maisPerto(candidatos: readonly string[], alvo: Ponto): string {
        return candidatos.reduce((melhor, id) =>
            distancia(this.posicao(id), alvo) < distancia(this.posicao(melhor), alvo) ? id : melhor);
    }

    grafo(): Grafo {
        return { nodes: this.nodes, edges: this.edges };
    }
}
