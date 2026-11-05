import {
    ApiError,
    buscarEstacionamentoPublicado,
    carregarMapaPublicado,
} from '../api';
import type { EnderecoWire } from '../api';
import { pontosDeInteresse, vagasLivres, vagasPorTipo } from '../client-map/resumo';
import type { PontoDeInteresse, VagasDoTipo } from '../client-map/resumo';
import { limparMensagem, mostrarMensagem } from '../dom/ui';
import { comoDadosDaVaga } from '../client-map/vagas';
import { desenharMiniatura } from '../graph/miniatura';
import { comoGrafo } from '../graph/tipos';
import { salvarHistorico } from '../historico';
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
const disponiveis = document.querySelector<HTMLElement>('#disponiveis');
const totalDeVagasLivres = document.querySelector<HTMLElement>('#totalDeVagasLivres');
const rotuloDoTotalLivres = document.querySelector<HTMLElement>('#rotuloDoTotalLivres');
const barraDeOcupacao = document.querySelector<HTMLElement>('#barraDeOcupacao');
const barraLivre = document.querySelector<HTMLElement>('#barraLivre');
const barraOcupada = document.querySelector<HTMLElement>('#barraOcupada');
const legendaLivres = document.querySelector<HTMLElement>('#legendaLivres');
const legendaOcupadas = document.querySelector<HTMLElement>('#legendaOcupadas');
const abrirNoMaps = document.querySelector<HTMLAnchorElement>('#abrirNoMaps');
const listaDeTipos = document.querySelector<HTMLUListElement>('#vagasPorTipo');
const secaoPois = document.querySelector<HTMLElement>('#secaoPois');
const listaDePontos = document.querySelector<HTMLUListElement>('#pontos');
const capaPlanta = document.querySelector<HTMLElement>('#capaPlanta');

function linhasDoEndereco(dados: EnderecoWire): string[] {
    const rua = [dados.logradouro, dados.numero].filter(Boolean).join(', ');
    const cidade = [dados.cidade, dados.estado].filter(Boolean).join(' - ');
    return [rua, dados.complemento, dados.bairro, cidade, dados.cep ? `CEP ${dados.cep}` : null]
        .filter((linha): linha is string => Boolean(linha));
}

function plural(quantidade: number, um: string, varios: string): string {
    return `${quantidade} ${quantidade === 1 ? um : varios}`;
}

function elemento<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    classe: string,
    texto?: string,
): HTMLElementTagNameMap[K] {
    const novo = document.createElement(tag);
    novo.className = classe;
    if (texto !== undefined) novo.textContent = texto;
    return novo;
}

function icone(nome: string): HTMLSpanElement {
    const span = elemento('span', 'material-symbols-outlined', nome);
    span.setAttribute('aria-hidden', 'true');
    return span;
}

// A amostra repete a tinta do mapa: o PCD azul daqui é o mesmo PCD azul que a
// pessoa vai procurar no canvas.
function linhaDoTipo({ tipo, quantidade, livres }: VagasDoTipo): HTMLLIElement {
    const linha = elemento('li', 'tipo');
    const amostra = elemento('i', `amostra amostra-${tipo}`);
    const nomeDoTipo = elemento('span', 'tipo-nome', ROTULOS[tipo]);

    const trilho = elemento('span', 'tipo-trilho');
    const cheio = elemento('span', 'tipo-cheio');
    cheio.style.width = `${quantidade === 0 ? 0 : (livres / quantidade) * 100}%`;
    trilho.append(cheio);

    const valor = elemento('span', 'tipo-valor', `${livres} de ${quantidade}`);
    linha.append(amostra, nomeDoTipo, trilho, valor);
    return linha;
}

function linhaDoDestino(estacionamentoId: number, ponto: PontoDeInteresse): HTMLLIElement {
    const linha = document.createElement('li');
    const link = elemento('a', 'destino');
    link.href = `/client/mapa.html?id=${estacionamentoId}&destino=${encodeURIComponent(ponto.id)}`;
    link.append(icone('near_me'), elemento('span', 'destino-nome', ponto.nome), icone('chevron_right'));
    linha.append(link);
    return linha;
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
            salvarHistorico(estacionamento);
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
            if (abrirNoMaps && linhas.length > 0) {
                const consulta = [estacionamento.nome, ...linhas].join(', ');
                abrirNoMaps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consulta)}`;
                abrirNoMaps.classList.remove('disabled');
            }

            const total = mapa.vagas.length;
            const livres = vagasLivres(mapa.vagas);
            const lotado = total > 0 && livres === 0;

            const ocupadas = total - livres;
            if (totalDeVagasLivres) totalDeVagasLivres.textContent = String(livres);
            if (rotuloDoTotalLivres) {
                rotuloDoTotalLivres.textContent = lotado
                    ? `Lotado · ${plural(total, 'vaga', 'vagas')}`
                    : `${livres === 1 ? 'livre' : 'livres'} de ${total}`;
            }
            disponiveis?.classList.toggle('lotado', lotado);

            if (barraLivre) barraLivre.style.flexGrow = String(livres);
            if (barraOcupada) barraOcupada.style.flexGrow = String(ocupadas);
            barraDeOcupacao?.setAttribute(
                'aria-label',
                `${plural(livres, 'vaga livre', 'vagas livres')} e ${plural(ocupadas, 'ocupada', 'ocupadas')}`,
            );
            barraDeOcupacao?.classList.toggle('disabled', total === 0);
            if (legendaLivres) legendaLivres.textContent = plural(livres, 'livre', 'livres');
            if (legendaOcupadas) legendaOcupadas.textContent = plural(ocupadas, 'ocupada', 'ocupadas');

            listaDeTipos?.replaceChildren(...vagasPorTipo(mapa.vagas).map(linhaDoTipo));

            const grafo = comoGrafo(mapa.grafo);
            const planta = desenharMiniatura(grafo, mapa.vagas.map(comoDadosDaVaga));
            if (capaPlanta && planta !== null) {
                capaPlanta.innerHTML = planta;
                capaPlanta.closest('.capa')?.classList.add('capa-com-planta');
            }

            const pontos = pontosDeInteresse(grafo);
            listaDePontos?.replaceChildren(
                ...pontos.map((ponto) => linhaDoDestino(estacionamento.id, ponto)),
            );
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
