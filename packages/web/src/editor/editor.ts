import { ApiError, listarEstacionamentos } from '../api';
import type { EstacionamentoWire } from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { criarPalco } from '../graph/render/palco';
import type { Ponto } from '../graph/geometria';

const quadro = document.getElementById('quadro') as HTMLElement | null;
const palcoDiv = document.getElementById('palco') as HTMLDivElement | null;
const bloqueio = document.getElementById('bloqueio') as HTMLElement | null;
const nomeDoPatio = document.getElementById('nomeDoPatio') as HTMLElement | null;
const etiqueta = document.getElementById('etiqueta') as HTMLElement | null;
const cursorX = document.getElementById('cursorX') as HTMLElement | null;
const cursorY = document.getElementById('cursorY') as HTMLElement | null;
const nivelZoom = document.getElementById('nivelZoom') as HTMLElement | null;

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

function bloquear(texto: string): void {
    if (bloqueio) bloqueio.textContent = texto;
    bloqueio?.classList.remove('disabled');
    quadro?.classList.add('disabled');
    if (nomeDoPatio) nomeDoPatio.textContent = 'Editor de pátio';
}

function mostrarPatio(estacionamento: EstacionamentoWire): void {
    if (nomeDoPatio) nomeDoPatio.textContent = estacionamento.nome;
    if (!etiqueta) return;
    etiqueta.textContent = estacionamento.publicado ? 'Publicado' : 'Rascunho';
    etiqueta.className = estacionamento.publicado ? 'etiqueta etiqueta-publicado' : 'etiqueta';
}

function idDaUrl(): number | null {
    const bruto = new URLSearchParams(window.location.search).get('estacionamento');
    const id = Number(bruto);
    return bruto !== null && Number.isInteger(id) && id > 0 ? id : null;
}

// Ainda não existe GET /estacionamentos/:id; o nome sai da lista do dono, que
// de quebra confirma que o pátio é dele.
async function carregarPatio(id: number): Promise<void> {
    try {
        const meus = await listarEstacionamentos();
        const estacionamento = meus.find((candidato) => candidato.id === id);
        if (estacionamento === undefined) {
            bloquear('Estacionamento não encontrado na sua conta.');
            return;
        }
        mostrarPatio(estacionamento);
    } catch (erro) {
        if (erro instanceof ApiError && erro.status === 401) {
            clearSession();
            bloquear('Sua sessão expirou. Entre de novo para continuar.');
            return;
        }
        bloquear(erro instanceof ApiError ? erro.message : 'Algo deu errado.');
    }
}

const id = idDaUrl();

if (getSession() === null || usuarioAtual()?.tipo_conta !== 'dono') {
    bloquear('Entre com uma conta de dono para abrir o editor.');
} else if (id === null) {
    bloquear('Abra o editor a partir da lista de estacionamentos.');
} else if (palcoDiv !== null) {
    const palco = criarPalco(palcoDiv);
    palco.aoMoverPonteiro(mostrarCursor);
    palco.aoMudarZoom(mostrarZoom);
    mostrarZoom(palco.zoom());
    void carregarPatio(id);
}
