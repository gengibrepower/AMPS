import imagemPadrao from '../../assets/images/capa-padrao.svg';
import { carregarMapaPublicado } from '../api';
import type { EnderecoWire, EstacionamentoNaBuscaWire } from '../api';
import { comoDadosDaVaga } from '../client-map/vagas';
import { desenharMiniatura } from '../graph/miniatura';
import { comoGrafo } from '../graph/tipos';

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

// Se o mapa não vier, fica a capa padrão: o card continua clicável, só sem
// a planta.
async function trocarPelaPlanta(planta: HTMLElement, id: number): Promise<void> {
    try {
        const mapa = await carregarMapaPublicado(id);
        const svg = desenharMiniatura(comoGrafo(mapa.grafo), mapa.vagas.map(comoDadosDaVaga));
        if (svg === null) return;
        planta.innerHTML = svg;
        planta.classList.add('com-planta');
    } catch {
        return;
    }
}

// Uma requisição de mapa por card, então só quando o card aparece: numa busca
// de 50 resultados, quem não rola não paga pelos de baixo.
const observador = typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver((entradas) => {
        for (const entrada of entradas) {
            if (!entrada.isIntersecting) continue;
            const planta = entrada.target as HTMLElement;
            observador?.unobserve(planta);
            void trocarPelaPlanta(planta, Number(planta.dataset['estacionamento']));
        }
    }, { rootMargin: '200px' });

export function criarCardDeEstacionamento(estacionamento: EstacionamentoNaBuscaWire): HTMLLIElement {
    const card = document.createElement('li');
    card.className = 'result-card';

    const planta = document.createElement('div');
    planta.className = 'result-card-planta';
    planta.dataset['estacionamento'] = String(estacionamento.id);
    const imagem = document.createElement('img');
    imagem.src = imagemPadrao;
    imagem.alt = '';
    planta.append(imagem);

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
    link.append(planta, corpo);
    card.append(link);

    if (observador === null) void trocarPelaPlanta(planta, estacionamento.id);
    else observador.observe(planta);
    return card;
}
