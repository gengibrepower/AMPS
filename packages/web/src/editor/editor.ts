import { ApiError, buscarEstacionamento, carregarMapa } from '../api';
import type { EstacionamentoWire, VagaWire } from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { criarCena } from '../graph/render/cena';
import type { Cena, ModoDaCena, Selecao } from '../graph/render/cena';
import { criarPalco } from '../graph/render/palco';
import type { Ponto } from '../graph/geometria';
import { acharNo } from '../graph/modelo';
import { comoGrafo, comoTipoDeVaga } from '../graph/tipos';
import type { DadosDaVaga, Papel } from '../graph/tipos';
import { criarEstado } from './estado';
import type { Instantaneo } from './estado';
import { apagarNo } from './tools/apagar';
import { apagarAresta, ligar } from './tools/aresta';
import { ferramentaDaTecla, papelDa } from './tools/ferramentas';
import type { Ferramenta } from './tools/ferramentas';
import { criarNoEm, moverNoPara } from './tools/no';

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
const alterado = document.getElementById('alterado') as HTMLElement | null;
const barraDeFerramentas = document.getElementById('ferramentas') as HTMLElement | null;
const botaoApagar = document.getElementById('apagar') as HTMLButtonElement | null;
const botaoDesfazer = document.getElementById('desfazer') as HTMLButtonElement | null;

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
    barraDeFerramentas?.classList.add('disabled');
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
        sensor: vaga.sensor,
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
    if (erro instanceof ApiError && (erro.status === 403 || erro.status === 404)) {
        bloquear('Este estacionamento não é seu ou não existe.');
        return;
    }
    bloquear(erro instanceof ApiError ? erro.message : 'Algo deu errado.');
}

const estado = criarEstado();
let escolhido: Selecao = null;
let ferramenta: Ferramenta = 'selecionar';

// Origem pendente da ferramenta de aresta: o primeiro nó clicado espera o
// segundo. Trocar de ferramenta ou apertar Esc esquece.
let origemDaAresta: string | null = null;

async function abrir(id: number, cena: Cena): Promise<void> {
    try {
        mostrarPatio(await buscarEstacionamento(id));

        const mapa = await carregarMapa(id);
        estado.carregar({ grafo: comoGrafo(mapa.grafo), vagas: mapa.vagas.map(comoDadosDaVaga) });
        cena.enquadrar();
        if (versao) versao.textContent = String(mapa.versao);
    } catch (erro) {
        relatar(erro);
    }
}

function mostrarSelecao(): void {
    if (!selecao) return;

    if (escolhido === null) {
        const nos = estado.grafo().nodes.length;
        selecao.textContent = nos === 0 ? 'pátio vazio' : `${nos} nós`;
        return;
    }
    if (escolhido.tipo === 'aresta') {
        selecao.textContent = `${escolhido.from} → ${escolhido.to}`;
        return;
    }
    const no = acharNo(estado.grafo(), escolhido.id);
    selecao.textContent = no === null
        ? escolhido.id
        : `${no.id} · ${ROTULO_DO_PAPEL[no.role]}`;
}

function mostrarBotoes(): void {
    if (botaoApagar) botaoApagar.disabled = escolhido === null;
    if (botaoDesfazer) botaoDesfazer.disabled = !estado.podeDesfazer();
    if (alterado) alterado.textContent = estado.sujo() ? 'sim' : 'não';
}

function modoDa(ferramenta: Ferramenta): ModoDaCena {
    if (ferramenta === 'selecionar') return 'selecionar';
    return ferramenta === 'aresta' ? 'ligar' : 'criar';
}

function escolherFerramenta(nova: Ferramenta, cena: Cena): void {
    ferramenta = nova;
    origemDaAresta = null;
    cena.modo(modoDa(nova));
    for (const botao of barraDeFerramentas?.querySelectorAll('[data-ferramenta]') ?? []) {
        botao.setAttribute('aria-pressed', String(botao.getAttribute('data-ferramenta') === nova));
    }
}

const id = idDaUrl();

if (getSession() === null || usuarioAtual()?.tipo_conta !== 'dono') {
    bloquear('Entre com uma conta de dono para abrir o editor.', true);
} else if (id === null) {
    bloquear('Abra o editor a partir da lista de estacionamentos.');
} else if (palcoDiv !== null) {
    const palco = criarPalco(palcoDiv);
    const cena = criarCena(palco);

    barraDeFerramentas?.classList.remove('disabled');

    palco.aoMoverPonteiro(mostrarCursor);
    palco.aoMudarZoom(mostrarZoom);

    estado.aoMudar((instantaneo: Instantaneo) => {
        cena.desenhar(instantaneo.grafo, instantaneo.vagas);
        mostrarSelecao();
        mostrarBotoes();
    });

    cena.aoSelecionar((atual) => {
        escolhido = atual;
        mostrarSelecao();
        mostrarBotoes();
    });

    // Criar não sai da ferramenta: uma fileira de vagas é o caso normal, e
    // voltar para o ponteiro a cada clique tornaria isso um suplício.
    cena.aoClicarNoVazio((metros) => {
        const papel = papelDa(ferramenta);
        if (papel === null) return;
        cena.selecionar({ tipo: 'no', id: criarNoEm(estado, papel, metros) });
    });

    // Clicar um nó com a ferramenta de aresta liga o anterior a ele e deixa
    // este como origem do próximo: a alameda sai de uma sequência de cliques.
    cena.aoClicarNoNo((noId) => {
        if (ferramenta !== 'aresta') return;
        origemDaAresta = ligar(estado, origemDaAresta, noId);
    });

    cena.aoArrastarNo((noId, metros) => {
        if (!moverNoPara(estado, noId, metros)) cena.desenhar(estado.grafo(), estado.vagas());
    });

    function apagarEscolhido(): void {
        if (escolhido === null) return;
        if (escolhido.tipo === 'no') apagarNo(estado, escolhido.id);
        else apagarAresta(estado, escolhido.from, escolhido.to);
    }

    botaoApagar?.addEventListener('click', apagarEscolhido);
    botaoDesfazer?.addEventListener('click', () => estado.desfazer());
    for (const botao of barraDeFerramentas?.querySelectorAll('[data-ferramenta]') ?? []) {
        botao.addEventListener('click', () => {
            const nome = botao.getAttribute('data-ferramenta');
            if (nome !== null) escolherFerramenta(nome as Ferramenta, cena);
        });
    }

    window.addEventListener('keydown', (evento: KeyboardEvent) => {
        if (evento.target instanceof HTMLInputElement) return;

        if (evento.key === 'Escape') {
            escolherFerramenta('selecionar', cena);
            cena.selecionar(null);
            return;
        }
        if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'z') {
            evento.preventDefault();
            estado.desfazer();
            return;
        }
        if (evento.key === 'Delete' || evento.key === 'Backspace') {
            evento.preventDefault();
            apagarEscolhido();
            return;
        }
        const arma = ferramentaDaTecla(evento.key);
        if (arma !== null) escolherFerramenta(arma, cena);
    });

    mostrarZoom(palco.zoom());
    mostrarBotoes();
    void abrir(id, cena);
}
