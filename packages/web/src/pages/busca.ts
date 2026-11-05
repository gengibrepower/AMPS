import { ApiError, pesquisarEstacionamentos } from '../api';
import { criarCardDeEstacionamento } from '../busca/card';
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

void (async () => {
    mostrarMensagem(mensagem, 'Carregando...', 'info');
    try {
        const listaEstacionamentos = await pesquisarEstacionamentos(q);
        resultados?.replaceChildren(...listaEstacionamentos.map(criarCardDeEstacionamento));
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
