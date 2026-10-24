import { comoTipoDeVaga } from '../graph/tipos';
import type { Grafo, TipoDeVaga } from '../graph/tipos';

export interface VagasDoTipo {
    readonly tipo: TipoDeVaga;
    readonly quantidade: number;
}

const ORDEM: readonly TipoDeVaga[] = ['comum', 'pcd', 'idoso', 'moto', 'eletrico'];

export function vagasPorTipo(vagas: readonly { readonly tipo: string }[]): readonly VagasDoTipo[] {
    const contagem = new Map<TipoDeVaga, number>();
    for (const vaga of vagas) {
        const tipo = comoTipoDeVaga(vaga.tipo);
        contagem.set(tipo, (contagem.get(tipo) ?? 0) + 1);
    }
    return ORDEM.flatMap((tipo) => {
        const quantidade = contagem.get(tipo);
        return quantidade === undefined ? [] : [{ tipo, quantidade }];
    });
}

export function pontosDeInteresse(grafo: Grafo): readonly string[] {
    return grafo.nodes
        .filter((no) => no.role === 'attractor')
        .map((no) => no.label?.trim() || 'Ponto sem nome');
}
