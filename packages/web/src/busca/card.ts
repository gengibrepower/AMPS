import imagemPadrao from '../../assets/images/capa-padrao.svg';
import { carregarMapaPublicado } from '../api';
import type { EnderecoWire, EstacionamentoNaBuscaWire } from '../api';
import { comoDadosDaVaga } from '../client-map/vagas';
import { desenharMostrador, estadoDaOcupacao } from '../dom/mostrador';
import { desenharMiniatura } from '../graph/miniatura';
import { comoGrafo } from '../graph/tipos';

function localizacao(endereco: EnderecoWire): string {
    const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
    const cidade = [endereco.cidade, endereco.estado].filter(Boolean).join(' - ');
    return [rua, endereco.bairro, cidade].filter(Boolean).join(' · ');
}

function criarVagas(vagas: EstacionamentoNaBuscaWire['vagas']): HTMLDivElement {
    const linha = document.createElement('div');
    linha.className = 'result-card-vagas';
    linha.innerHTML = desenharMostrador({ livres: vagas.livres, total: vagas.total, tamanho: 88 });

    const contagem = document.createElement('div');
    contagem.className = 'vagas-contagem';

    const numero = document.createElement('strong');
    numero.className = 'vagas-numero';
    numero.textContent = String(vagas.livres);

    const rotulo = document.createElement('span');
    rotulo.className = 'vagas-rotulo';
    rotulo.textContent = `${vagas.livres === 1 ? 'livre' : 'livres'} · de ${vagas.total}`;
    contagem.append(numero, rotulo);

    const estado = estadoDaOcupacao(vagas.livres, vagas.total);
    if (estado !== 'normal') {
        const escrito = document.createElement('span');
        escrito.className = `vagas-estado vagas-${estado}`;
        escrito.textContent = estado === 'lotado' ? 'Lotado' : 'Quase cheio';
        contagem.append(escrito);
    }

    linha.append(contagem);
    return linha;
}

// Se o mapa não vier, fica a capa padrão: o card continua clicável, só sem
// a planta.
async function trocarPelaPlanta(planta: HTMLElement, id: number): Promise<void> {
    try {
        const mapa = await carregarMapaPublicado(id);
        const svg = desenharMiniatura(comoGrafo(mapa.grafo), mapa.vagas.map(comoDadosDaVaga));
        if (svg === null) return;
        planta.querySelector('img')?.remove();
        planta.insertAdjacentHTML('afterbegin', svg);
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
    const lotado = estadoDaOcupacao(estacionamento.vagas.livres, estacionamento.vagas.total) === 'lotado';
    card.className = lotado ? 'result-card lotado' : 'result-card';

    const planta = document.createElement('div');
    planta.className = 'result-card-planta';
    planta.dataset['estacionamento'] = String(estacionamento.id);
    const imagem = document.createElement('img');
    imagem.src = imagemPadrao;
    imagem.alt = '';
    planta.append(imagem);
    if (lotado) {
        const etiqueta = document.createElement('span');
        etiqueta.className = 'result-card-etiqueta';
        etiqueta.textContent = 'Lotado';
        planta.append(etiqueta);
    }

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
    link.href = `/client/estacionamento-publicado.html?id=${estacionamento.id}`;

    corpo.append(titulo, local, criarVagas(estacionamento.vagas));
    link.append(planta, corpo);
    card.append(link);

    if (observador === null) void trocarPelaPlanta(planta, estacionamento.id);
    else observador.observe(planta);
    return card;
}
