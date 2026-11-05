import '../dom/navegacao';
import portal from '../../assets/images/portal.svg?raw';
import { pesquisarEstacionamentos } from '../api';
import type { EstacionamentoNaBuscaWire } from '../api';
import { criarCardDeEstacionamento } from '../busca/card';
import { lerHistorico } from '../historico';
import { criarCardDoHistorico } from '../historico/card';
import { desenharMostrador } from '../dom/mostrador';

const secaoDoHistorico = document.querySelector<HTMLElement>('#historico');
const listaDoHistorico = document.querySelector<HTMLUListElement>('#listaDoHistorico');
const secaoDePatios = document.querySelector<HTMLElement>('#patios');
const listaDePatios = document.querySelector<HTMLUListElement>('#listaDePatios');
const faixa = document.querySelector<HTMLElement>('#faixa');

// A faixa soma as vagas de todos os pátios publicados: é o número real de
// agora, não um exemplo. O portal ao lado é ilustração.
function mostrarFaixa(patios: readonly EstacionamentoNaBuscaWire[]): void {
    const livres = patios.reduce((soma, patio) => soma + patio.vagas.livres, 0);
    const total = patios.reduce((soma, patio) => soma + patio.vagas.total, 0);
    if (faixa === null || total === 0) return;

    const mostrador = faixa.querySelector('#faixaMostrador');
    const numero = faixa.querySelector('#faixaNumero');
    const rotulo = faixa.querySelector('#faixaRotulo');
    const lugar = faixa.querySelector('#faixaPortal');
    if (mostrador !== null) mostrador.innerHTML = desenharMostrador({ livres, total, tamanho: 190, fundo: 'escuro' });
    if (numero !== null) numero.textContent = String(livres);
    if (rotulo !== null) {
        const vagas = livres === 1 ? 'vaga livre' : 'vagas livres';
        const onde = patios.length === 1 ? 'estacionamento' : 'estacionamentos';
        rotulo.textContent = `${vagas} agora em ${patios.length} ${onde}`;
    }
    if (lugar !== null) lugar.innerHTML = portal;
    faixa.classList.remove('disabled');
}

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
        mostrarFaixa(patios);
    } catch {
        return;
    }
})();
