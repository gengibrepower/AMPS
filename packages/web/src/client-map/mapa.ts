import { ApiError, buscarEstacionamentoPublicado, carregarMapaPublicado } from '../api';
import type { VagaPublicaWire } from '../api';
import { criarPalco } from '../graph/render/palco';
import { criarCena } from '../graph/render/cena';
import { comoGrafo, comoStatusDeVaga, comoTipoDeVaga } from '../graph/tipos';
import type { DadosDaVaga } from '../graph/tipos';
import { mostrarMensagem } from '../dom/ui';

const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const id = Number(params.get('id'));
const palcoDiv = document.getElementById('palco') as HTMLDivElement | null;
const mensagem = document.querySelector<HTMLElement>('#mensagem');
const voltar = document.querySelector<HTMLAnchorElement>('#voltar');
const nomeDoPatio = document.querySelector<HTMLElement>('#nomeDoPatio');

// A rota pública não manda o sensor, e o público não tem por que saber qual é.
function comoDadosDaVaga(vaga: VagaPublicaWire): DadosDaVaga {
    return {
        noId: vaga.no_id,
        numero: vaga.numero,
        tipo: comoTipoDeVaga(vaga.tipo),
        rotacaoGraus: vaga.rotacao_graus,
        sensor: null,
        status: comoStatusDeVaga(vaga.status),
    };
}

if (!Number.isInteger(id) || id <= 0) {
    if (nomeDoPatio) nomeDoPatio.textContent = 'Mapa do estacionamento';
    mostrarMensagem(
        mensagem,
        'Link inválido',
        'error',
    );
} else if (palcoDiv !== null) {
    void (async () => {
        try {
            if (voltar) voltar.href = `/client/estacionamento.html?id=${id}`;
            const [estacionamento, mapa] = await Promise.all([
                buscarEstacionamentoPublicado(id),
                carregarMapaPublicado(id),
            ]);
            document.title = `${estacionamento.nome} - Mapa - AMPS`;
            if (nomeDoPatio) nomeDoPatio.textContent = estacionamento.nome;

            const palco = criarPalco(palcoDiv);
            const cena = criarCena(palco);
            cena.modo('ligar');

            cena.desenhar(comoGrafo(mapa.grafo), mapa.vagas.map(comoDadosDaVaga));
            cena.enquadrar();
        } catch (erro) {
            if (nomeDoPatio) nomeDoPatio.textContent = 'Mapa do estacionamento';
            mostrarMensagem(
                mensagem,
                erro instanceof ApiError ? erro.message : 'Algo deu errado.',
                'error',
            );
        }
    })();
}
