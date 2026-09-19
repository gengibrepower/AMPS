import { acharNo, mudarPeso, pesoNatural, renomearNo } from '../../graph/modelo';
import type { DadosDaVaga } from '../../graph/tipos';
import type { Estado } from '../estado';

export function renomear(estado: Estado, id: string, rotulo: string): boolean {
    const no = acharNo(estado.grafo(), id);
    if (no === null || (no.label ?? '') === rotulo.trim()) return false;

    estado.mudar({ grafo: renomearNo(estado.grafo(), id, rotulo), vagas: estado.vagas() });
    return true;
}

// `vagas` tem UNIQUE em (estacionamento_id, numero), e o 422 do trigger é rede
// de segurança, não fluxo normal: o número repetido morre aqui.
export function numeroLivre(
    vagas: readonly DadosDaVaga[],
    noId: string,
    numero: string,
): boolean {
    return !vagas.some((vaga) => vaga.noId !== noId && vaga.numero === numero);
}

// Campo a campo, o sensor incluído: comparar só o que o inspetor edita faria
// uma troca de sensor passar por "nada mudou" e sumir sem aviso.
function mesmaVaga(a: DadosDaVaga, b: DadosDaVaga): boolean {
    return a.numero === b.numero
        && a.tipo === b.tipo
        && a.rotacaoGraus === b.rotacaoGraus
        && a.sensor === b.sensor;
}

export function atualizarVaga(estado: Estado, nova: DadosDaVaga): boolean {
    const antiga = estado.vagas().find((vaga) => vaga.noId === nova.noId);
    if (antiga === undefined) return false;
    if (!numeroLivre(estado.vagas(), nova.noId, nova.numero)) return false;
    if (mesmaVaga(antiga, nova)) return false;

    estado.mudar({
        grafo: estado.grafo(),
        vagas: estado.vagas().map((vaga) => (vaga.noId === nova.noId ? nova : vaga)),
    });
    return true;
}

export function editarPeso(estado: Estado, de: string, para: string, peso: number): boolean {
    const atual = estado.grafo().edges.find((a) => a.from === de && a.to === para);
    if (atual === undefined || !Number.isFinite(peso) || peso < 0) return false;
    if (atual.weight === peso) return false;

    estado.mudar({ grafo: mudarPeso(estado.grafo(), de, para, peso), vagas: estado.vagas() });
    return true;
}

// Recálculo é ação explícita: o peso nasce da distância, mas mover um nó não o
// refaz sozinho, senão um ajuste deliberado — rampa, mão única — sumiria sem
// aviso. Este é o botão que o dono aperta quando de fato quer a distância.
export function recalcularPeso(estado: Estado, de: string, para: string): boolean {
    const natural = pesoNatural(estado.grafo(), de, para);
    return natural === null ? false : editarPeso(estado, de, para, natural);
}
