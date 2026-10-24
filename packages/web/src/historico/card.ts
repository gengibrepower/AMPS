import type { ItemDoHistorico } from './index';

function icone(nome: string, classe: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = `material-symbols-outlined ${classe}`;
    span.setAttribute('aria-hidden', 'true');
    span.textContent = nome;
    return span;
}

export function criarCardDoHistorico(item: ItemDoHistorico): HTMLLIElement {
    const card = document.createElement('li');
    card.className = 'historico-card';

    const link = document.createElement('a');
    link.className = 'historico-link';
    link.href = `/client/estacionamento.html?id=${item.id}`;

    const texto = document.createElement('span');
    texto.className = 'historico-texto';

    const nome = document.createElement('span');
    nome.className = 'historico-nome';
    nome.textContent = item.nome;

    const local = document.createElement('span');
    local.className = 'historico-local';
    local.textContent = item.local || 'Endereço não informado';

    texto.append(nome, local);
    link.append(texto, icone('chevron_right', 'historico-seta'));
    card.append(link);
    return card;
}
