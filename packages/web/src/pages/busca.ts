import imagemPadrao from '../../assets/images/capa-padrao.svg';
import { ApiError, pesquisarEstacionamentos } from '../api';
import type { EnderecoWire, EstacionamentoNaBuscaWire } from '../api';
import { limparMensagem, mostrarMensagem } from '../dom/ui';

const resultadoTitulo = document.querySelector<HTMLHeadingElement>('#resultadoTitulo');
const resultados = document.querySelector<HTMLUListElement>('#resultados');
const mensagem = document.querySelector<HTMLElement>('#mensagem');

const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const q = (params.get('q') ?? '').trim();

if (resultadoTitulo !== null) {
    if (q !== '') {
        resultadoTitulo.textContent = `Resultados para: ${q}`;
    } else {
        resultadoTitulo.textContent = 'Todos os estacionamentos';
    }
}

function localizacao(endereco: EnderecoWire): string {
    const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
    const cidade = [endereco.cidade, endereco.estado].filter(Boolean).join(' - ');
    return [rua, endereco.bairro, cidade].filter(Boolean).join(' · ');
}

function criarVagas(vagas: EstacionamentoNaBuscaWire['vagas']): HTMLParagraphElement {
    const linha = document.createElement('p');
    linha.className = 'result-card-vagas';

    const livres = document.createElement('strong');
    livres.className = vagas.livres === 0 ? 'vagas-livres lotado' : 'vagas-livres';
    livres.textContent = vagas.livres === 0
        ? 'Lotado'
        : `${vagas.livres} ${vagas.livres === 1 ? 'vaga livre' : 'vagas livres'}`;

    const total = document.createElement('span');
    total.className = 'vagas-total';
    total.textContent = vagas.livres === 0 ? `todas as ${vagas.total} ocupadas` : `de ${vagas.total}`;

    linha.append(livres, total);
    return linha;
}

function criarCard(estacionamento: EstacionamentoNaBuscaWire): HTMLLIElement {
    const card = document.createElement('li');
    card.className = 'result-card';

    const imagem = document.createElement('img');
    imagem.src = imagemPadrao;
    imagem.alt = '';

    const corpo = document.createElement('div');
    corpo.className = 'result-card-body';

    const titulo = document.createElement('h3');
    titulo.className = 'result-card-title';
    titulo.textContent = estacionamento.nome;

    const local = document.createElement('p');
    local.className = 'result-card-location';
    local.textContent = localizacao(estacionamento.endereco) || 'Endereço não informado';

    const link = document.createElement('a');
    link.className = 'result-card-link';
    link.href = `/client/estacionamento.html?id=${estacionamento.id}`;

    corpo.append(titulo, local, criarVagas(estacionamento.vagas));
    link.append(imagem, corpo);
    card.append(link);
    return card;
}

void (async () => {
    mostrarMensagem(mensagem, 'Carregando...', 'info');
    try {
        const listaEstacionamentos = await pesquisarEstacionamentos(q);
        resultados?.replaceChildren(...listaEstacionamentos.map(criarCard));
        if (listaEstacionamentos.length === 0) {
            mostrarMensagem(mensagem, 'Nenhum estacionamento encontrado.', 'info');
        } else {
            limparMensagem(mensagem);
        }
    } catch (erro) {
        mostrarMensagem(
            mensagem,
            erro instanceof ApiError ? erro.message : 'Algo deu errado.',
            'error',
        );
    }
})();
