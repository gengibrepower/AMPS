import { acharNo, removerNo } from '../../graph/modelo';
import type { Estado } from '../estado';

// Apagar o nó leva junto as arestas que tocavam nele e a linha de `vagas`. A
// ordem de gravação da fatia 5 depende disso: o trigger recusa tirar do grafo
// um nó que ainda tem vaga.
export function apagarNo(estado: Estado, id: string): boolean {
    if (acharNo(estado.grafo(), id) === null) return false;

    estado.mudar({
        grafo: removerNo(estado.grafo(), id),
        vagas: estado.vagas().filter((vaga) => vaga.noId !== id),
    });
    return true;
}
