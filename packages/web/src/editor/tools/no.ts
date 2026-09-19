import { encaixarPonto } from '../../graph/geometria';
import type { Ponto } from '../../graph/geometria';
import {
    acharNo,
    criarNo,
    moverNo,
    proximoNumeroDeVaga,
    rotacaoDaVaga,
} from '../../graph/modelo';
import type { Papel } from '../../graph/tipos';
import type { Estado } from '../estado';

// Criar vaga já grava a rotação. `vagas.rotacao_graus` é quem manda no desenho,
// então uma vaga cadastrada a 0° deita no sentido errado assim que a dedução
// pela rua para de valer.
export function criarNoEm(estado: Estado, papel: Papel, metros: Ponto): string {
    const { grafo, no } = criarNo(estado.grafo(), papel, encaixarPonto(metros));

    const vagas = no.role === 'candidate'
        ? [...estado.vagas(), {
            noId: no.id,
            numero: proximoNumeroDeVaga(estado.vagas()),
            tipo: 'comum' as const,
            rotacaoGraus: rotacaoDaVaga(grafo, no),
            sensor: null,
        }]
        : estado.vagas();

    estado.mudar({ grafo, vagas });
    return no.id;
}

export function moverNoPara(estado: Estado, id: string, metros: Ponto): boolean {
    const no = acharNo(estado.grafo(), id);
    const destino = encaixarPonto(metros);
    if (no === null || (no.position.x === destino.x && no.position.y === destino.y)) return false;

    estado.mudar({ grafo: moverNo(estado.grafo(), id, destino), vagas: estado.vagas() });
    return true;
}
