import { projecaoNoSegmento } from './geometria';
import type { Caixa, Ponto } from './geometria';
import type { Aresta, Grafo, No } from './tipos';

export function acharNo(grafo: Grafo, id: string): No | null {
    return grafo.nodes.find((no) => no.id === id) ?? null;
}

// Mão dupla é um par de arestas opostas; o desenho precisa saber para separar
// as duas linhas em vez de empilhá-las.
export function temInversa(grafo: Grafo, aresta: Aresta): boolean {
    return grafo.edges.some((outra) => outra.from === aresta.to && outra.to === aresta.from);
}

export function chaveDaAresta(aresta: Aresta): string {
    return `${aresta.from}→${aresta.to}`;
}

// Caixa que envolve todos os nós, já contando a extensão das vagas. A folga
// cobre o que o desenho põe em volta dos outros nós — a largura do corredor,
// principalmente — para nada ficar cortado na borda.
export function caixaDoGrafo(grafo: Grafo, folga = 1): Caixa | null {
    if (grafo.nodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const no of grafo.nodes) {
        const meia = no.role === 'candidate'
            ? { x: no.dimensions.width / 2, y: no.dimensions.length / 2 }
            : { x: folga, y: folga };
        minX = Math.min(minX, no.position.x - meia.x);
        minY = Math.min(minY, no.position.y - meia.y);
        maxX = Math.max(maxX, no.position.x + meia.x);
        maxY = Math.max(maxY, no.position.y + meia.y);
    }
    return { minX, minY, maxX, maxY };
}

// Onde a vaga encosta no corredor. A vaga aparece uma vez só, na rua mais
// próxima dela: assim a fileira mostra quantas vagas aquela via de fato
// comporta, em vez de vagas penduradas num nó distante.
export interface Doca {
    readonly ponto: Ponto;
    readonly paraFora: Ponto;
    readonly maoDupla: boolean;
}

export function docaDaVaga(grafo: Grafo, vaga: No): Doca | null {
    let melhor: Doca | null = null;
    let menorDistancia = Infinity;

    for (const aresta of grafo.edges) {
        const de = acharNo(grafo, aresta.from);
        const para = acharNo(grafo, aresta.to);
        if (de === null || para === null) continue;
        if (de.role === 'candidate' || para.role === 'candidate') continue;

        const ponto = projecaoNoSegmento(vaga.position, de.position, para.position);
        const dx = vaga.position.x - ponto.x;
        const dy = vaga.position.y - ponto.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia >= menorDistancia || distancia === 0) continue;

        menorDistancia = distancia;
        melhor = {
            ponto,
            paraFora: { x: dx / distancia, y: dy / distancia },
            maoDupla: temInversa(grafo, aresta),
        };
    }
    return melhor;
}

// A vaga se deita perpendicular à rua em que encosta.
export function anguloDaVaga(grafo: Grafo, vaga: No): number | null {
    const doca = docaDaVaga(grafo, vaga);
    if (doca === null) return null;

    // O retângulo é desenhado com o comprimento no eixo y local.
    return Math.atan2(doca.paraFora.y, doca.paraFora.x) - Math.PI / 2;
}
