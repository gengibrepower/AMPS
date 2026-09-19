import { acharNo, mesmaVaga, mesmoGrafo } from '../graph/modelo';
import type { DadosDaVaga, Grafo } from '../graph/tipos';
import type { Instantaneo } from './estado';

// Um passo por requisição, na ordem em que os triggers de `03_integridade.sql`
// exigem. Quem executa só percorre a lista.
export type Passo =
    | { readonly tipo: 'apagarVaga'; readonly noId: string }
    | { readonly tipo: 'topologia'; readonly grafo: Grafo }
    | { readonly tipo: 'vagas'; readonly vagas: readonly DadosDaVaga[] };

function ehCandidate(grafo: Grafo, noId: string): boolean {
    return acharNo(grafo, noId)?.role === 'candidate';
}

/**
 * A ordem não é preferência, é o que o banco impõe:
 *
 * 1. `DELETE` das vagas que sumiram — o trigger recusa tirar do grafo um nó
 *    que ainda tem vaga, então a linha sai antes do nó.
 * 2. `PUT /topologia` — `vagas_valida_no_insert` exige que o `no_id` já seja um
 *    `candidate` **no grafo gravado**, então o grafo entra antes das vagas.
 * 3. `PUT /vagas` com o resto.
 *
 * Cada passo só aparece se houve mudança, e a comparação é estrutural: o MySQL
 * reordena as chaves do JSON e comparar string acusaria mudança sempre.
 */
export function planejar(servidor: Instantaneo, local: Instantaneo): readonly Passo[] {
    const passos: Passo[] = [];

    const aindaExiste = new Set(local.vagas.map((vaga) => vaga.noId));
    for (const vaga of servidor.vagas) {
        if (!aindaExiste.has(vaga.noId)) passos.push({ tipo: 'apagarVaga', noId: vaga.noId });
    }

    if (!mesmoGrafo(servidor.grafo, local.grafo)) {
        passos.push({ tipo: 'topologia', grafo: local.grafo });
    }

    const noServidor = new Map(servidor.vagas.map((vaga) => [vaga.noId, vaga]));
    const mudadas = local.vagas.filter((vaga) => {
        // Vaga pendurada em nó que não é `candidate` é exatamente o que o
        // trigger recusa com 422. Não deveria existir, e não vai daqui.
        if (!ehCandidate(local.grafo, vaga.noId)) return false;

        const antiga = noServidor.get(vaga.noId);
        return antiga === undefined || !mesmaVaga(antiga, vaga);
    });
    if (mudadas.length > 0) passos.push({ tipo: 'vagas', vagas: mudadas });

    return passos;
}

export interface Gravador {
    apagarVaga(noId: string): Promise<void>;
    topologia(grafo: Grafo): Promise<number>;
    vagas(vagas: readonly DadosDaVaga[]): Promise<void>;
}

// Percorre os passos em ordem e para no primeiro erro: seguir depois de um
// passo que falhou gravaria metade da mudança, que é pior do que não gravar.
// Devolve a versão nova quando a topologia foi junto.
export async function executar(
    passos: readonly Passo[],
    gravador: Gravador,
): Promise<number | null> {
    let versao: number | null = null;

    for (const passo of passos) {
        if (passo.tipo === 'apagarVaga') await gravador.apagarVaga(passo.noId);
        else if (passo.tipo === 'topologia') versao = await gravador.topologia(passo.grafo);
        else await gravador.vagas(passo.vagas);
    }
    return versao;
}
