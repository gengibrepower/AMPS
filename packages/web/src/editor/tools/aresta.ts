import { criarAresta, removerAresta } from '../../graph/modelo';
import type { Estado } from '../estado';

// A rua se desenha em cadeia: o destino vira a origem do clique seguinte, então
// clicar t1, t2, t3 traça a alameda inteira sem voltar ao primeiro nó a cada
// trecho. Devolve a nova origem pendente.
export function ligar(estado: Estado, origem: string | null, destino: string): string {
    if (origem === null || origem === destino) return destino;

    const grafo = criarAresta(estado.grafo(), origem, destino);
    if (grafo !== estado.grafo()) estado.mudar({ grafo, vagas: estado.vagas() });
    return destino;
}

export function apagarAresta(estado: Estado, de: string, para: string): boolean {
    const grafo = removerAresta(estado.grafo(), de, para);
    if (grafo.edges.length === estado.grafo().edges.length) return false;

    estado.mudar({ grafo, vagas: estado.vagas() });
    return true;
}
