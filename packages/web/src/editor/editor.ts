import {
    ApiError,
    apagarVaga,
    buscarEstacionamento,
    carregarMapa,
    despublicar,
    gravarTopologia,
    gravarVagas,
    publicar,
} from '../api';
import type { EstacionamentoWire, VagaWire } from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { criarCena } from '../graph/render/cena';
import type { Cena, ModoDaCena, Selecao } from '../graph/render/cena';
import { criarPalco } from '../graph/render/palco';
import type { Ponto } from '../graph/geometria';
import { acharNo, pesoNatural } from '../graph/modelo';
import { GRAFO_VAZIO, comoGrafo, comoTipoDeVaga } from '../graph/tipos';
import type { DadosDaVaga, Papel, TipoDeVaga } from '../graph/tipos';
import { criarEstado } from './estado';
import type { Instantaneo } from './estado';
import { executar, planejar } from './gravacao';
import { apagarNo } from './tools/apagar';
import { apagarAresta, ligar } from './tools/aresta';
import { ferramentaDaTecla, papelDa } from './tools/ferramentas';
import type { Ferramenta } from './tools/ferramentas';
import {
    atualizarVaga,
    editarPeso,
    numeroLivre,
    recalcularPeso,
    renomear,
} from './tools/inspetor';
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

const inspetor = document.getElementById('inspetor') as HTMLElement | null;
const inspetorVazio = document.getElementById('inspetorVazio') as HTMLElement | null;
const inspetorNo = document.getElementById('inspetorNo') as HTMLElement | null;
const inspetorVaga = document.getElementById('inspetorVaga') as HTMLElement | null;
const inspetorAresta = document.getElementById('inspetorAresta') as HTMLElement | null;
const inspetorId = document.getElementById('inspetorId') as HTMLElement | null;
const inspetorPapel = document.getElementById('inspetorPapel') as HTMLElement | null;
const inspetorX = document.getElementById('inspetorX') as HTMLElement | null;
const inspetorY = document.getElementById('inspetorY') as HTMLElement | null;
const inspetorErro = document.getElementById('inspetorErro') as HTMLElement | null;
const campoRotulo = document.getElementById('campoRotulo') as HTMLInputElement | null;
const campoNumero = document.getElementById('campoNumero') as HTMLInputElement | null;
const campoTipo = document.getElementById('campoTipo') as HTMLSelectElement | null;
const campoRotacao = document.getElementById('campoRotacao') as HTMLInputElement | null;
const grausRapidos = document.getElementById('grausRapidos') as HTMLElement | null;
const arestaDe = document.getElementById('arestaDe') as HTMLElement | null;
const arestaPara = document.getElementById('arestaPara') as HTMLElement | null;
const campoPeso = document.getElementById('campoPeso') as HTMLInputElement | null;
const botaoRecalcular = document.getElementById('recalcular') as HTMLButtonElement | null;
const dicaPeso = document.getElementById('dicaPeso') as HTMLElement | null;
const botaoSalvar = document.getElementById('salvar') as HTMLButtonElement | null;
const avisoDeGravacao = document.getElementById('avisoDeGravacao') as HTMLElement | null;
const botaoPublicar = document.getElementById('publicar') as HTMLButtonElement | null;

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

// A coluna do banco é inteira e o desenho gira em [0, 360): 370° e -90° viram
// o mesmo ângulo em vez de recusa.
function emGrausInteiros(bruto: string): number {
    const numero = Math.round(Number(bruto.replace(',', '.')));
    if (!Number.isFinite(numero)) return 0;
    return ((numero % 360) + 360) % 360;
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
    inspetor?.classList.add('disabled');
    if (nomeDoPatio) nomeDoPatio.textContent = 'Editor de pátio';
}

function mostrarEtiqueta(): void {
    if (etiqueta) {
        etiqueta.textContent = publicado ? 'Publicado' : 'Rascunho';
        etiqueta.className = publicado ? 'etiqueta etiqueta-publicado' : 'etiqueta';
    }
    if (botaoPublicar) {
        botaoPublicar.disabled = gravando;
        botaoPublicar.textContent = publicado ? 'Despublicar' : 'Publicar';
    }
}

function mostrarPatio(estacionamento: EstacionamentoWire): void {
    if (nomeDoPatio) nomeDoPatio.textContent = estacionamento.nome;
    publicado = estacionamento.publicado;
    mostrarEtiqueta();
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
let gravando = false;
let publicado = false;
let ferramenta: Ferramenta = 'selecionar';

// Origem pendente da ferramenta de aresta: o primeiro nó clicado espera o
// segundo. Trocar de ferramenta ou apertar Esc esquece.
let origemDaAresta: string | null = null;

// O instantâneo que o servidor tem. É contra ele que o planner compara, e é
// ele que o salvar substitui quando dá certo.
let doServidor: Instantaneo = { grafo: GRAFO_VAZIO, vagas: [] };

async function salvar(id: number): Promise<void> {
    if (gravando || !estado.sujo()) return;

    const local = estado.atual();
    const passos = planejar(doServidor, local);
    if (passos.length === 0) {
        // Sujo sem nada a gravar é ida e volta: criar e desfazer deixa a pilha
        // com passos, mas o conteúdo volta a ser o do servidor.
        doServidor = local;
        estado.carregar(local);
        avisarGravacao('nada a salvar');
        return;
    }

    gravando = true;
    mostrarBotoes();
    avisarGravacao('');

    try {
        const nova = await executar(passos, {
            apagarVaga: async (noId) => {
                await apagarVaga(id, noId);
            },
            topologia: async (grafo) => (await gravarTopologia(id, grafo)).versao,
            vagas: async (vagas) => {
                await gravarVagas(id, vagas.map((vaga) => ({
                    no_id: vaga.noId,
                    numero: vaga.numero,
                    tipo: vaga.tipo,
                    rotacao_graus: vaga.rotacaoGraus,
                    sensor: vaga.sensor,
                })));
            },
        });

        // O que acabou de subir passa a ser o estado do servidor. `carregar`
        // zera a pilha, que é o que faz `sujo()` voltar a ser falso.
        doServidor = local;
        estado.carregar(local);
        if (nova !== null && versao) versao.textContent = String(nova);
        avisarGravacao('salvo');
    } catch (erro) {
        // Parou no passo que falhou: o que já subiu ficou, o resto não. Manter
        // o editor sujo é o certo — ainda há mudança por gravar.
        if (erro instanceof ApiError && erro.status === 401) {
            clearSession();
            bloquear('Sua sessão expirou.', true);
            return;
        }
        avisarGravacao(erro instanceof ApiError ? erro.message : 'não deu para salvar', true);
    } finally {
        gravando = false;
        mostrarBotoes();
    }
}

// Publicar valida o que está **no banco**, não o que está na tela: sem gravar
// antes, o dono publicaria um pátio diferente do que está vendo. Se o salvar
// falhar, não publica — o erro dele já foi mostrado.
async function publicarOuDespublicar(id: number, cena: Cena): Promise<void> {
    if (gravando) return;

    if (!publicado && estado.sujo()) {
        await salvar(id);
        if (estado.sujo()) return;
    }

    gravando = true;
    mostrarBotoes();
    avisarGravacao('');
    cena.recusar([]);

    try {
        const atual = publicado ? await despublicar(id) : await publicar(id);
        publicado = atual.publicado;
        avisarGravacao(publicado ? 'publicado' : 'despublicado');
    } catch (erro) {
        if (erro instanceof ApiError && erro.status === 401) {
            clearSession();
            bloquear('Sua sessão expirou.', true);
            return;
        }
        if (erro instanceof ApiError) {
            // A RN-11 recusa nomeando as vagas sem caminho. Marcá-las no
            // desenho é o que transforma a mensagem em algo acionável.
            cena.recusar(idsDasVagas(erro.vagas));
            avisarGravacao(erro.message, true);
        } else {
            avisarGravacao('não deu para publicar', true);
        }
    } finally {
        gravando = false;
        mostrarBotoes();
    }
}

// O erro nomeia vaga por `numero`; a cena conhece nó por `id`.
function idsDasVagas(numeros: readonly string[]): readonly string[] {
    const procurados = new Set(numeros);
    return estado.vagas()
        .filter((vaga) => procurados.has(vaga.numero))
        .map((vaga) => vaga.noId);
}

async function abrir(id: number, cena: Cena): Promise<void> {
    try {
        mostrarPatio(await buscarEstacionamento(id));

        const mapa = await carregarMapa(id);
        doServidor = { grafo: comoGrafo(mapa.grafo), vagas: mapa.vagas.map(comoDadosDaVaga) };
        estado.carregar(doServidor);
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

function vagaSelecionada(): DadosDaVaga | undefined {
    const atual = escolhido;
    if (atual?.tipo !== 'no') return undefined;
    return estado.vagas().find((vaga) => vaga.noId === atual.id);
}

function avisar(texto: string): void {
    if (inspetorErro) inspetorErro.textContent = texto;
}

// O inspetor é repintado a cada mudança, e um campo de digitação em foco é
// justamente o que o dono está escrevendo: sobrescrever ali apagaria a edição
// no meio. `select` não se digita, então acompanha o modelo sempre.
function preencher(campo: HTMLInputElement | HTMLSelectElement | null, valor: string): void {
    if (campo === null) return;
    if (campo instanceof HTMLInputElement && document.activeElement === campo) return;
    campo.value = valor;
}

function mostrarInspetor(): void {
    avisar('');

    const no = escolhido?.tipo === 'no' ? acharNo(estado.grafo(), escolhido.id) : null;
    const aresta = escolhido?.tipo === 'aresta' ? escolhido : null;

    inspetorVazio?.classList.toggle('disabled', no !== null || aresta !== null);
    inspetorNo?.classList.toggle('disabled', no === null);
    inspetorAresta?.classList.toggle('disabled', aresta === null);

    if (no !== null) {
        if (inspetorId) inspetorId.textContent = no.id;
        if (inspetorPapel) inspetorPapel.textContent = ROTULO_DO_PAPEL[no.role];
        if (inspetorX) inspetorX.textContent = emMetros(no.position.x);
        if (inspetorY) inspetorY.textContent = emMetros(no.position.y);
        preencher(campoRotulo, no.label ?? '');

        const vaga = vagaSelecionada();
        inspetorVaga?.classList.toggle('disabled', vaga === undefined);
        if (vaga !== undefined) {
            preencher(campoNumero, vaga.numero);
            preencher(campoTipo, vaga.tipo);
            preencher(campoRotacao, String(vaga.rotacaoGraus));
        }
    }

    if (aresta !== null) {
        if (arestaDe) arestaDe.textContent = aresta.from;
        if (arestaPara) arestaPara.textContent = aresta.to;

        const atual = estado.grafo().edges
            .find((cada) => cada.from === aresta.from && cada.to === aresta.to);
        preencher(campoPeso, atual === undefined ? '' : String(atual.weight));

        const natural = pesoNatural(estado.grafo(), aresta.from, aresta.to);
        if (dicaPeso) {
            dicaPeso.textContent = natural === null
                ? ''
                : `distância entre os nós: ${emMetros(natural)}`;
        }
    }
}

function mostrarBotoes(): void {
    if (botaoApagar) botaoApagar.disabled = escolhido === null;
    if (botaoDesfazer) botaoDesfazer.disabled = !estado.podeDesfazer();
    if (alterado) alterado.textContent = estado.sujo() ? 'sim' : 'não';
    if (botaoSalvar) {
        botaoSalvar.disabled = gravando || !estado.sujo();
        botaoSalvar.textContent = gravando ? 'Salvando…' : 'Salvar';
    }
    mostrarEtiqueta();
}

function avisarGravacao(texto: string, erro = false): void {
    if (!avisoDeGravacao) return;
    avisoDeGravacao.textContent = texto;
    avisoDeGravacao.className = erro ? 'aviso aviso-erro' : 'aviso';
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

    inspetor?.classList.remove('disabled');

    estado.aoMudar((instantaneo: Instantaneo) => {
        // Mexer no pátio invalida a recusa anterior: ela falava de um desenho
        // que não é mais este.
        cena.recusar([]);
        cena.desenhar(instantaneo.grafo, instantaneo.vagas);
        mostrarSelecao();
        mostrarBotoes();
        mostrarInspetor();
    });

    cena.aoSelecionar((atual) => {
        escolhido = atual;
        mostrarSelecao();
        mostrarBotoes();
        mostrarInspetor();
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

    // Os campos gravam no `change`, não a cada tecla: assim uma edição inteira
    // é um passo do desfazer, e não uma letra.
    //
    // Enter precisa de tratamento à parte. `change` só sai quando o campo perde
    // o foco, e fora de um <form> o Enter não faz nada — sem isto o dono digita,
    // aperta Enter e o editor ignora. Tirar o foco dispara o `change` de sempre,
    // então a gravação continua num caminho só.
    function aoConfirmar(campo: HTMLInputElement | null, aplicar: () => void): void {
        campo?.addEventListener('change', aplicar);
        campo?.addEventListener('keydown', (evento: KeyboardEvent) => {
            if (evento.key !== 'Enter') return;
            evento.preventDefault();
            campo.blur();
        });
    }

    aoConfirmar(campoRotulo, () => {
        if (escolhido?.tipo === 'no' && campoRotulo !== null) {
            renomear(estado, escolhido.id, campoRotulo.value);
        }
    });

    function editarVagaCom(campos: {
        numero?: string;
        tipo?: TipoDeVaga;
        rotacaoGraus?: number;
    }): void {
        const vaga = vagaSelecionada();
        if (vaga === undefined) return;

        const nova: DadosDaVaga = {
            ...vaga,
            ...(campos.numero === undefined ? {} : { numero: campos.numero }),
            ...(campos.tipo === undefined ? {} : { tipo: campos.tipo }),
            ...(campos.rotacaoGraus === undefined ? {} : { rotacaoGraus: campos.rotacaoGraus }),
        };

        // Repinta antes de avisar: `mostrarInspetor` limpa o erro ao entrar, e
        // na ordem inversa a mensagem morria no mesmo instante em que nascia.
        if (nova.numero.trim() === '') {
            mostrarInspetor();
            avisar('a vaga precisa de um número');
            return;
        }
        if (!numeroLivre(estado.vagas(), nova.noId, nova.numero)) {
            mostrarInspetor();
            avisar(`número ${nova.numero} já é de outra vaga`);
            return;
        }
        atualizarVaga(estado, nova);
    }

    aoConfirmar(campoNumero, () => {
        if (campoNumero !== null) editarVagaCom({ numero: campoNumero.value.trim() });
    });
    campoTipo?.addEventListener('change', () => {
        editarVagaCom({ tipo: comoTipoDeVaga(campoTipo.value) });
    });
    aoConfirmar(campoRotacao, () => {
        if (campoRotacao !== null) editarVagaCom({ rotacaoGraus: emGrausInteiros(campoRotacao.value) });
    });

    for (const botao of grausRapidos?.querySelectorAll('[data-graus]') ?? []) {
        botao.addEventListener('click', () => {
            const graus = Number(botao.getAttribute('data-graus'));
            if (Number.isInteger(graus)) editarVagaCom({ rotacaoGraus: graus });
        });
    }

    aoConfirmar(campoPeso, () => {
        if (escolhido?.tipo !== 'aresta' || campoPeso === null) return;
        const peso = Number(campoPeso.value.replace(',', '.'));
        if (!editarPeso(estado, escolhido.from, escolhido.to, peso)) {
            mostrarInspetor();
            avisar('peso deve ser um número não negativo');
        }
    });

    botaoRecalcular?.addEventListener('click', () => {
        if (escolhido?.tipo === 'aresta') recalcularPeso(estado, escolhido.from, escolhido.to);
    });

    botaoSalvar?.addEventListener('click', () => void salvar(id));
    botaoPublicar?.addEventListener('click', () => void publicarOuDespublicar(id, cena));
    botaoApagar?.addEventListener('click', apagarEscolhido);
    botaoDesfazer?.addEventListener('click', () => estado.desfazer());
    for (const botao of barraDeFerramentas?.querySelectorAll('[data-ferramenta]') ?? []) {
        botao.addEventListener('click', () => {
            const nome = botao.getAttribute('data-ferramenta');
            if (nome !== null) escolherFerramenta(nome as Ferramenta, cena);
        });
    }

    window.addEventListener('keydown', (evento: KeyboardEvent) => {
        // Ctrl+S antes do guarda de formulário: de dentro de um campo o atalho
        // abriria o "salvar página" do navegador, que é um diálogo modal em
        // cima do editor. Tirar o foco primeiro confirma a edição pendente,
        // que só grava no `change`.
        if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 's') {
            evento.preventDefault();
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            void salvar(id);
            return;
        }

        if (evento.target instanceof HTMLInputElement
            || evento.target instanceof HTMLSelectElement
            || evento.target instanceof HTMLTextAreaElement) return;

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
    mostrarInspetor();
    void abrir(id, cena);
}
