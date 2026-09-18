import { ApiError, carregarMapa, listarEstacionamentos } from '../api';
import type { EstacionamentoWire, VagaWire } from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { criarCena } from '../graph/render/cena';
import type { Cena, Selecao } from '../graph/render/cena';
import { criarPalco } from '../graph/render/palco';
import type { Ponto } from '../graph/geometria';
import { acharNo } from '../graph/modelo';
import { GRAFO_VAZIO, comoGrafo, comoTipoDeVaga } from '../graph/tipos';
import type { DadosDaVaga, Grafo, Papel } from '../graph/tipos';

const quadro = document.getElementById('quadro') as HTMLElement | null;
const palcoDiv = document.getElementById('palco') as HTMLDivElement | null;
const bloqueio = document.getElementById('bloqueio') as HTMLElement | null;
const bloqueioTexto = document.getElementById('bloqueioTexto') as HTMLElement | null;
const bloqueioSaida = document.getElementById('bloqueioSaida') as HTMLElement | null;
const nomeDoPatio = document.getElementById('nomeDoPatio') as HTMLElement | null;
const etiqueta = document.getElementById('etiqueta') as HTMLElement | null;
const cursorX = document.getElementById('cursorX') as HTMLElement | null;
const cursorY = document.getElementById('cursorY') as HTMLElement | null;
const nivelZoom = document.getElementById('nivelZoom') as HTMLElement | null;
const versao = document.getElementById('versao') as HTMLElement | null;
const selecao = document.getElementById('selecao') as HTMLElement | null;

const ROTULO_DO_PAPEL: Record<Papel, string> = {
    candidate: 'vaga',
    source: 'entrada',
    transit: 'via',
    attractor: 'POI',
};

function emMetros(valor: number): string {
    return `${valor.toFixed(2).replace('.', ',')} m`;
}

function mostrarCursor(metros: Ponto | null): void {
    if (cursorX) cursorX.textContent = metros === null ? '—' : emMetros(metros.x);
    if (cursorY) cursorY.textContent = metros === null ? '—' : emMetros(metros.y);
}

function mostrarZoom(zoom: number): void {
    if (nivelZoom) nivelZoom.textContent = `${Math.round(zoom * 100)}%`;
}

function bloquear(texto: string, comSaida = false): void {
    if (bloqueioTexto) bloqueioTexto.textContent = texto;
    bloqueio?.classList.remove('disabled');
    bloqueioSaida?.classList.toggle('disabled', !comSaida);
    quadro?.classList.add('disabled');
    if (nomeDoPatio) nomeDoPatio.textContent = 'Editor de pátio';
}

function mostrarPatio(estacionamento: EstacionamentoWire): void {
    if (nomeDoPatio) nomeDoPatio.textContent = estacionamento.nome;
    if (!etiqueta) return;
    etiqueta.textContent = estacionamento.publicado ? 'Publicado' : 'Rascunho';
    etiqueta.className = estacionamento.publicado ? 'etiqueta etiqueta-publicado' : 'etiqueta';
}

function comoDadosDaVaga(vaga: VagaWire): DadosDaVaga {
    return {
        noId: vaga.no_id,
        numero: vaga.numero,
        tipo: comoTipoDeVaga(vaga.tipo),
        rotacaoGraus: vaga.rotacao_graus,
    };
}

function idDaUrl(): number | null {
    const bruto = new URLSearchParams(window.location.search).get('estacionamento');
    const id = Number(bruto);
    return bruto !== null && Number.isInteger(id) && id > 0 ? id : null;
}

function relatar(erro: unknown): void {
    if (erro instanceof ApiError && erro.status === 401) {
        clearSession();
        bloquear('Sua sessão expirou.', true);
        return;
    }
    bloquear(erro instanceof ApiError ? erro.message : 'Algo deu errado.');
}

// Ainda não existe GET /estacionamentos/:id; o nome sai da lista do dono, que
// de quebra confirma que o pátio é dele.
async function abrir(id: number, cena: Cena): Promise<void> {
    try {
        const meus = await listarEstacionamentos();
        const estacionamento = meus.find((candidato) => candidato.id === id);
        if (estacionamento === undefined) {
            bloquear('Estacionamento não encontrado na sua conta.');
            return;
        }
        mostrarPatio(estacionamento);

        const mapa = await carregarMapa(id);
        grafoAtual = comoGrafo(mapa.grafo);
        cena.desenhar(grafoAtual, mapa.vagas.map(comoDadosDaVaga));
        cena.enquadrar();
        if (versao) versao.textContent = String(mapa.versao);

        mostrarSelecao(null);
    } catch (erro) {
        relatar(erro);
    }
}

let grafoAtual: Grafo = GRAFO_VAZIO;

function mostrarSelecao(escolhido: Selecao): void {
    if (!selecao) return;

    if (escolhido === null) {
        const nos = grafoAtual.nodes.length;
        selecao.textContent = nos === 0 ? 'pátio vazio' : `${nos} nós`;
        return;
    }
    if (escolhido.tipo === 'aresta') {
        selecao.textContent = `${escolhido.from} → ${escolhido.to}`;
        return;
    }
    const no = acharNo(grafoAtual, escolhido.id);
    selecao.textContent = no === null
        ? escolhido.id
        : `${no.id} · ${ROTULO_DO_PAPEL[no.role]}`;
}

const id = idDaUrl();

if (getSession() === null || usuarioAtual()?.tipo_conta !== 'dono') {
    bloquear('Entre com uma conta de dono para abrir o editor.', true);
} else if (id === null) {
    bloquear('Abra o editor a partir da lista de estacionamentos.');
} else if (palcoDiv !== null) {
    const palco = criarPalco(palcoDiv);
    const cena = criarCena(palco);

    palco.aoMoverPonteiro(mostrarCursor);
    palco.aoMudarZoom(mostrarZoom);
    cena.aoSelecionar((escolhido) => mostrarSelecao(escolhido));
    window.addEventListener('keydown', (evento: KeyboardEvent) => {
        if (evento.key === 'Escape') cena.selecionar(null);
    });

    mostrarZoom(palco.zoom());
    void abrir(id, cena);
}
