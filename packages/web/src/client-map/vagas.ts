import type { VagaPublicaWire } from '../api';
import { comoStatusDeVaga, comoTipoDeVaga } from '../graph/tipos';
import type { DadosDaVaga } from '../graph/tipos';

// A rota pública não manda o sensor, e o público não tem por que saber qual é.
export function comoDadosDaVaga(vaga: VagaPublicaWire): DadosDaVaga {
    return {
        noId: vaga.no_id,
        numero: vaga.numero,
        tipo: comoTipoDeVaga(vaga.tipo),
        rotacaoGraus: vaga.rotacao_graus,
        sensor: null,
        status: comoStatusDeVaga(vaga.status),
    };
}
