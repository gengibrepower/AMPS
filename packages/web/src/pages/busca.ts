import imagemPadrao from '../../assets/images/default-img.png';
import { ApiError, pesquisarEstacionamentos } from '../api';
import type { EnderecoWire, EstacionamentoWire } from '../api';
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

function criarCard(estacionamento: EstacionamentoWire): HTMLLIElement {
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

    corpo.append(titulo, local);
    card.append(imagem, corpo);
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
