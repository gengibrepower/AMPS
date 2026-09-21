import {
    ApiError,
    criarEstacionamento,
    editarEstacionamento,
    excluirEstacionamento,
    listarEstacionamentos,
} from '../api';
import type { DadosEstacionamento, EnderecoWire, EstacionamentoWire } from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { limparMensagem, mostrarMensagem } from '../ui';

const bloqueio = document.getElementById('bloqueio') as HTMLElement | null;
const bloqueioTexto = document.getElementById('bloqueioTexto') as HTMLElement | null;
const area = document.getElementById('area') as HTMLElement | null;
const conta = document.getElementById('conta') as HTMLElement | null;
const donoNome = document.getElementById('donoNome') as HTMLElement | null;
const sair = document.getElementById('sair') as HTMLButtonElement | null;
const abrirNovo = document.getElementById('abrirNovo') as HTMLButtonElement | null;
const cancelarPatio = document.getElementById('cancelarPatio') as HTMLButtonElement | null;
const salvarPatio = document.getElementById('salvarPatio') as HTMLButtonElement | null;
const formPatio = document.getElementById('formPatio') as HTMLFormElement | null;
const tituloForm = document.getElementById('tituloForm') as HTMLElement | null;
const mensagem = document.getElementById('mensagem') as HTMLElement | null;
const vazio = document.getElementById('vazio') as HTMLElement | null;
const lista = document.getElementById('lista') as HTMLUListElement | null;

const CAMPOS_ENDERECO = [
    'cep',
    'logradouro',
    'numero',
    'bairro',
    'complemento',
    'cidade',
    'estado',
] as const;

// O formulário serve os dois modos: `emEdicao` guarda qual pátio ele está
// alterando, e null quer dizer que ele vai criar um novo. `emExclusao` é o
// pátio cujo item trocou as ações pela confirmação — inline, porque um
// `confirm()` trava o navegador que o e2e dirige.
let patios: readonly EstacionamentoWire[] = [];
let emEdicao: number | null = null;
let emExclusao: number | null = null;

function campo(nome: string): string {
    const entrada = document.getElementById(nome) as HTMLInputElement | null;
    return entrada?.value.trim() ?? '';
}

function preencherCampo(nome: string, valor: string | null): void {
    const entrada = document.getElementById(nome) as HTMLInputElement | null;
    if (entrada) entrada.value = valor ?? '';
}

// "Rua XV, 1200 — Centro, Blumenau/SC", pulando o que não foi preenchido.
function enderecoEmLinha(endereco: EnderecoWire): string {
    const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
    const cidade = [endereco.cidade, endereco.estado].filter(Boolean).join('/');
    const local = [endereco.bairro, cidade].filter(Boolean).join(', ');
    return [rua, local].filter((parte) => parte !== '').join(' — ');
}

function botaoDeIcone(icone: string, rotulo: string, classe: string): HTMLButtonElement {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = classe;
    botao.title = rotulo;
    botao.setAttribute('aria-label', rotulo);

    const simbolo = document.createElement('span');
    simbolo.className = 'material-symbols-outlined';
    simbolo.textContent = icone;
    botao.append(simbolo);
    return botao;
}

function acoesDoItem(estacionamento: EstacionamentoWire): HTMLDivElement {
    const etiqueta = document.createElement('span');
    etiqueta.className = estacionamento.publicado ? 'etiqueta etiqueta-publicado' : 'etiqueta';
    etiqueta.textContent = estacionamento.publicado ? 'Publicado' : 'Rascunho';

    const abrir = document.createElement('a');
    abrir.className = 'abrir';
    abrir.href = `editor.html?estacionamento=${estacionamento.id}`;
    abrir.textContent = 'Abrir editor';

    const editar = botaoDeIcone('edit', 'Editar', 'botao-icone');
    editar.addEventListener('click', () => abrirFormulario(estacionamento));

    const excluir = botaoDeIcone('delete', 'Excluir', 'botao-icone botao-perigo');
    excluir.addEventListener('click', () => {
        emExclusao = estacionamento.id;
        limparMensagem(mensagem);
        renderizar();
    });

    const acoes = document.createElement('div');
    acoes.className = 'item-acoes';
    acoes.append(etiqueta, abrir, editar, excluir);
    return acoes;
}

function confirmacaoDoItem(estacionamento: EstacionamentoWire): HTMLDivElement {
    const pergunta = document.createElement('span');
    pergunta.className = 'confirmar-texto';
    pergunta.textContent = estacionamento.publicado
        ? 'Excluir? O pátio está publicado e sairá da busca.'
        : 'Excluir? O desenho e as vagas vão junto.';

    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'botao-texto';
    cancelar.textContent = 'Cancelar';
    cancelar.addEventListener('click', () => {
        emExclusao = null;
        renderizar();
    });

    const confirmar = document.createElement('button');
    confirmar.type = 'button';
    confirmar.className = 'botao-perigo-cheio';
    confirmar.textContent = 'Excluir';
    confirmar.addEventListener('click', () => {
        confirmar.disabled = true;
        void remover(estacionamento);
    });

    const acoes = document.createElement('div');
    acoes.className = 'item-acoes item-confirmar';
    acoes.append(pergunta, cancelar, confirmar);
    return acoes;
}

function itemDaLista(estacionamento: EstacionamentoWire): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'item';

    const info = document.createElement('div');

    const nome = document.createElement('p');
    nome.className = 'item-nome';
    nome.textContent = estacionamento.nome;
    info.append(nome);

    const linha = enderecoEmLinha(estacionamento.endereco);
    if (linha !== '') {
        const endereco = document.createElement('p');
        endereco.className = 'item-endereco';
        endereco.textContent = linha;
        info.append(endereco);
    }

    const acoes =
        emExclusao === estacionamento.id
            ? confirmacaoDoItem(estacionamento)
            : acoesDoItem(estacionamento);

    item.append(info, acoes);
    return item;
}

function renderizar(): void {
    if (!lista) return;
    lista.replaceChildren(...patios.map(itemDaLista));
    vazio?.classList.toggle('disabled', patios.length > 0);
}

function bloquear(texto: string): void {
    if (bloqueioTexto) bloqueioTexto.textContent = texto;
    bloqueio?.classList.remove('disabled');
    area?.classList.add('disabled');
    conta?.classList.add('disabled');
}

function abrirFormulario(estacionamento: EstacionamentoWire | null): void {
    emEdicao = estacionamento?.id ?? null;
    emExclusao = null;
    renderizar();

    formPatio?.reset();
    limparMensagem(mensagem);

    if (estacionamento !== null) {
        preencherCampo('nome', estacionamento.nome);
        for (const nomeDoCampo of CAMPOS_ENDERECO) {
            preencherCampo(nomeDoCampo, estacionamento.endereco[nomeDoCampo]);
        }
    }

    if (tituloForm) {
        tituloForm.textContent =
            estacionamento === null ? 'Novo estacionamento' : `Editando "${estacionamento.nome}"`;
    }
    if (salvarPatio) salvarPatio.textContent = estacionamento === null ? 'Criar' : 'Salvar';

    formPatio?.classList.remove('disabled');
    abrirNovo?.classList.add('disabled');
    (document.getElementById('nome') as HTMLInputElement | null)?.focus();
}

function fecharFormulario(): void {
    emEdicao = null;
    formPatio?.classList.add('disabled');
    abrirNovo?.classList.remove('disabled');
    formPatio?.reset();
    limparMensagem(mensagem);
}

function relatar(erro: unknown): void {
    if (erro instanceof ApiError && erro.status === 401) {
        clearSession();
        bloquear('Sua sessão expirou. Entre de novo para continuar.');
        return;
    }
    if (erro instanceof ApiError && erro.status === 403) {
        bloquear('Esta área é só para contas de dono.');
        return;
    }
    mostrarMensagem(mensagem, erro instanceof ApiError ? erro.message : 'Algo deu errado.', 'error');
}

async function carregar(): Promise<void> {
    try {
        patios = await listarEstacionamentos();
        renderizar();
    } catch (erro) {
        relatar(erro);
    }
}

async function remover(estacionamento: EstacionamentoWire): Promise<void> {
    try {
        await excluirEstacionamento(estacionamento.id);
        emExclusao = null;
        if (emEdicao === estacionamento.id) fecharFormulario();
        await carregar();
        mostrarMensagem(mensagem, `"${estacionamento.nome}" excluído.`, 'success');
    } catch (erro) {
        emExclusao = null;
        renderizar();
        relatar(erro);
    }
}

formPatio?.addEventListener('submit', async (evento: Event) => {
    evento.preventDefault();

    const nome = campo('nome');
    if (nome === '') {
        mostrarMensagem(mensagem, 'O nome é obrigatório.', 'error');
        return;
    }

    const endereco = Object.fromEntries(CAMPOS_ENDERECO.map((nomeDoCampo) => [nomeDoCampo, campo(nomeDoCampo)]));
    const dados = { nome, ...endereco } as DadosEstacionamento;
    const alvo = emEdicao;

    if (salvarPatio) salvarPatio.disabled = true;
    try {
        if (alvo === null) {
            await criarEstacionamento(dados);
        } else {
            await editarEstacionamento(alvo, dados);
        }
        fecharFormulario();
        await carregar();
        mostrarMensagem(mensagem, alvo === null ? `"${nome}" criado.` : `"${nome}" salvo.`, 'success');
    } catch (erro) {
        relatar(erro);
    } finally {
        if (salvarPatio) salvarPatio.disabled = false;
    }
});

abrirNovo?.addEventListener('click', () => abrirFormulario(null));
cancelarPatio?.addEventListener('click', () => fecharFormulario());

sair?.addEventListener('click', () => {
    clearSession();
    window.location.href = '../index.html';
});

const usuario = usuarioAtual();

if (getSession() === null) {
    bloquear('Entre com uma conta de dono para ver seus estacionamentos.');
} else if (usuario?.tipo_conta !== 'dono') {
    bloquear('Esta área é só para contas de dono.');
} else {
    if (donoNome) donoNome.textContent = usuario.nome;
    area?.classList.remove('disabled');
    void carregar();
}
