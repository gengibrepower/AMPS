import { lerHistorico } from '../historico';
import { criarCardDoHistorico } from '../historico/card';

const secaoDoHistorico = document.querySelector<HTMLElement>('#historico');
const listaDoHistorico = document.querySelector<HTMLUListElement>('#listaDoHistorico');

const itens = lerHistorico();

if (itens.length > 0) {
    for (const item of itens) {
        const card = criarCardDoHistorico(item);
        listaDoHistorico?.appendChild(card);
    }
    secaoDoHistorico?.classList.remove('disabled');
}
