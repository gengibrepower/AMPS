import { carregarMapaPublicado } from '../api';
import type { VagaPublicaWire } from '../api';
import { criarPalco } from '../graph/render/palco';
import { criarCena } from '../graph/render/cena';
import { comoGrafo, comoTipoDeVaga } from '../graph/tipos';
import type { DadosDaVaga } from '../graph/tipos';

const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const id = Number(params.get('id'));
const palcoDiv = document.getElementById('palco') as HTMLDivElement | null;

// A rota pública não manda o sensor, e o público não tem por que saber qual é.
function comoDadosDaVaga(vaga: VagaPublicaWire): DadosDaVaga {
    return {
        noId: vaga.no_id,
        numero: vaga.numero,
        tipo: comoTipoDeVaga(vaga.tipo),
        rotacaoGraus: vaga.rotacao_graus,
        sensor: null,
    };
}

if (!Number.isInteger(id) || id <= 0) {
    console.log('ERRO! id inválido');
} else if (palcoDiv !== null) {
    void (async () => {
        const mapa = await carregarMapaPublicado(id);
        const palco = criarPalco(palcoDiv);
        const cena = criarCena(palco);

        cena.desenhar(comoGrafo(mapa.grafo), mapa.vagas.map(comoDadosDaVaga));
        cena.enquadrar();
    })();
}
