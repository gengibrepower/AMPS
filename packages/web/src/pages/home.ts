import { pesquisarEstacionamentos } from '../api';
import { criarCardDeEstacionamento } from '../busca/card';
import { lerHistorico } from '../historico';
import { criarCardDoHistorico } from '../historico/card';

const secaoDoHistorico = document.querySelector<HTMLElement>('#historico');
const listaDoHistorico = document.querySelector<HTMLUListElement>('#listaDoHistorico');
const secaoDePatios = document.querySelector<HTMLElement>('#patios');
const listaDePatios = document.querySelector<HTMLUListElement>('#listaDePatios');

const itens = lerHistorico();

if (itens.length > 0) {
    for (const item of itens) {
        const card = criarCardDoHistorico(item);
        listaDoHistorico?.appendChild(card);
    }
    secaoDoHistorico?.classList.remove('disabled');
}

// A busca vazia já é "todos os publicados". Se a API não responder, a seção
// simplesmente não aparece: a busca continua ali em cima.
void (async () => {
    try {
        const patios = await pesquisarEstacionamentos('');
        if (patios.length === 0) return;
        listaDePatios?.replaceChildren(...patios.map(criarCardDeEstacionamento));
        secaoDePatios?.classList.remove('disabled');
    } catch {
        return;
    }
})();
