import { comoTipoDeVaga } from '../graph/tipos';
import type { Grafo, TipoDeVaga } from '../graph/tipos';

export interface VagasDoTipo {
    readonly tipo: TipoDeVaga;
    readonly quantidade: number;
    readonly livres: number;
}

export interface PontoDeInteresse {
    readonly id: string;
    readonly nome: string;
}

const ORDEM: readonly TipoDeVaga[] = ['comum', 'pcd', 'idoso', 'moto', 'eletrico'];

export function vagasPorTipo(
    vagas: readonly { readonly tipo: string; readonly status?: string }[],
): readonly VagasDoTipo[] {
    const contagem = new Map<TipoDeVaga, { quantidade: number; livres: number }>();
    for (const vaga of vagas) {
        const tipo = comoTipoDeVaga(vaga.tipo);
        const atual = contagem.get(tipo) ?? { quantidade: 0, livres: 0 };
        atual.quantidade += 1;
        if (vaga.status === 'livre') atual.livres += 1;
        contagem.set(tipo, atual);
    }
    return ORDEM.flatMap((tipo) => {
        const atual = contagem.get(tipo);
        return atual === undefined ? [] : [{ tipo, ...atual }];
    });
}

export function pontosDeInteresse(grafo: Grafo): readonly PontoDeInteresse[] {
    return grafo.nodes
        .filter((no) => no.role === 'attractor')
        .map((no) => ({ id: no.id, nome: no.label?.trim() || 'Ponto sem nome' }));
}

export function vagasLivres(vagas: readonly { readonly status: string }[]): number {
    let contagem = 0;
    for (const vaga of vagas) {
        if (vaga.status === 'livre') {
            contagem += 1;
        }
    }
    return contagem;
}
