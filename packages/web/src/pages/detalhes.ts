import {
    ApiError,
    buscarEstacionamentoPublicado,
    carregarMapaPublicado,
} from '../api';
import type { EnderecoWire } from '../api';
import { pontosDeInteresse, vagasPorTipo } from '../client-map/resumo';
import { limparMensagem, mostrarMensagem } from '../dom/ui';
import { comoGrafo } from '../graph/tipos';
import type { TipoDeVaga } from '../graph/tipos';

const ROTULOS: Record<TipoDeVaga, string> = {
    comum: 'Comum',
    pcd: 'PCD',
    idoso: 'Idoso',
    moto: 'Moto',
    eletrico: 'Elétrico',
};

const params = new URLSearchParams(window.location.search);
const id = Number(params.get('id'));

const mensagem = document.querySelector<HTMLElement>('#mensagem');
const detalhes = document.querySelector<HTMLElement>('#detalhes');
const nome = document.querySelector<HTMLElement>('#nome');
const local = document.querySelector<HTMLElement>('#local');
const endereco = document.querySelector<HTMLUListElement>('#endereco');
const verMapa = document.querySelector<HTMLAnchorElement>('#verMapa');
const totalDeVagas = document.querySelector<HTMLElement>('#totalDeVagas');
const rotuloDoTotal = document.querySelector<HTMLElement>('#rotuloDoTotal');
const listaDeTipos = document.querySelector<HTMLUListElement>('#vagasPorTipo');
const secaoPois = document.querySelector<HTMLElement>('#secaoPois');
const listaDePontos = document.querySelector<HTMLUListElement>('#pontos');

function linhasDoEndereco(dados: EnderecoWire): string[] {
    const rua = [dados.logradouro, dados.numero].filter(Boolean).join(', ');
    const cidade = [dados.cidade, dados.estado].filter(Boolean).join(' - ');
    return [rua, dados.complemento, dados.bairro, cidade, dados.cep ? `CEP ${dados.cep}` : null]
        .filter((linha): linha is string => Boolean(linha));
}

function itemDaLista(texto: string): HTMLLIElement {
    const item = document.createElement('li');
    item.textContent = texto;
    return item;
}

if (!Number.isInteger(id) || id <= 0) {
    mostrarMensagem(mensagem, 'Link inválido.', 'error');
} else {
    void (async () => {
        mostrarMensagem(mensagem, 'Carregando...', 'info');
        try {
            const [estacionamento, mapa] = await Promise.all([
                buscarEstacionamentoPublicado(id),
                carregarMapaPublicado(id),
            ]);

            document.title = `${estacionamento.nome} - AMPS`;
            if (nome) nome.textContent = estacionamento.nome;

            const { bairro, cidade, estado } = estacionamento.endereco;
            if (local) {
                local.textContent = [bairro, [cidade, estado].filter(Boolean).join(' - ')]
                    .filter(Boolean)
                    .join(' · ');
            }

            const linhas = linhasDoEndereco(estacionamento.endereco);
            endereco?.replaceChildren(
                ...(linhas.length > 0 ? linhas : ['Endereço não informado']).map(itemDaLista),
            );

            if (verMapa) verMapa.href = `/client/mapa.html?id=${estacionamento.id}`;

            const total = mapa.vagas.length;
            if (totalDeVagas) totalDeVagas.textContent = String(total);
            if (rotuloDoTotal) rotuloDoTotal.textContent = total === 1 ? 'vaga' : 'vagas';
            listaDeTipos?.replaceChildren(
                ...vagasPorTipo(mapa.vagas).map(({ tipo, quantidade }) =>
                    itemDaLista(`${ROTULOS[tipo]}: ${quantidade}`),
                ),
            );

            const pontos = pontosDeInteresse(comoGrafo(mapa.grafo));
            listaDePontos?.replaceChildren(...pontos.map(itemDaLista));
            secaoPois?.classList.toggle('disabled', pontos.length === 0);

            limparMensagem(mensagem);
            detalhes?.classList.remove('disabled');
        } catch (erro) {
            mostrarMensagem(
                mensagem,
                erro instanceof ApiError ? erro.message : 'Algo deu errado.',
                'error',
            );
        }
    })();
}
