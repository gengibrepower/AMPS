import { ApiError, criarEstacionamento, listarEstacionamentos } from '../api';
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
const cancelarNovo = document.getElementById('cancelarNovo') as HTMLButtonElement | null;
const salvarNovo = document.getElementById('salvarNovo') as HTMLButtonElement | null;
const formNovo = document.getElementById('formNovo') as HTMLFormElement | null;
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

function campo(nome: string): string {
    const entrada = document.getElementById(nome) as HTMLInputElement | null;
    return entrada?.value.trim() ?? '';
}

// "Rua XV, 1200 — Centro, Blumenau/SC", pulando o que não foi preenchido.
function enderecoEmLinha(endereco: EnderecoWire): string {
    const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
    const cidade = [endereco.cidade, endereco.estado].filter(Boolean).join('/');
    const local = [endereco.bairro, cidade].filter(Boolean).join(', ');
    return [rua, local].filter((parte) => parte !== '').join(' — ');
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

    const etiqueta = document.createElement('span');
    etiqueta.className = estacionamento.publicado ? 'etiqueta etiqueta-publicado' : 'etiqueta';
    etiqueta.textContent = estacionamento.publicado ? 'Publicado' : 'Rascunho';

    const abrir = document.createElement('a');
    abrir.className = 'abrir';
    abrir.href = `editor.html?estacionamento=${estacionamento.id}`;
    abrir.textContent = 'Abrir editor';

    const acoes = document.createElement('div');
    acoes.className = 'item-acoes';
    acoes.append(etiqueta, abrir);

    item.append(info, acoes);
    return item;
}

function renderizar(estacionamentos: readonly EstacionamentoWire[]): void {
    if (!lista) return;
    lista.replaceChildren(...estacionamentos.map(itemDaLista));
    vazio?.classList.toggle('disabled', estacionamentos.length > 0);
}

function bloquear(texto: string): void {
    if (bloqueioTexto) bloqueioTexto.textContent = texto;
    bloqueio?.classList.remove('disabled');
    area?.classList.add('disabled');
    conta?.classList.add('disabled');
}

function alternarFormulario(aberto: boolean): void {
    formNovo?.classList.toggle('disabled', !aberto);
    abrirNovo?.classList.toggle('disabled', aberto);
    if (aberto) {
        (document.getElementById('nome') as HTMLInputElement | null)?.focus();
    } else {
        formNovo?.reset();
        limparMensagem(mensagem);
    }
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
        renderizar(await listarEstacionamentos());
    } catch (erro) {
        relatar(erro);
    }
}

formNovo?.addEventListener('submit', async (evento: Event) => {
    evento.preventDefault();

    const nome = campo('nome');
    if (nome === '') {
        mostrarMensagem(mensagem, 'O nome é obrigatório.', 'error');
        return;
    }

    const endereco = Object.fromEntries(CAMPOS_ENDERECO.map((nomeDoCampo) => [nomeDoCampo, campo(nomeDoCampo)]));
    const dados = { nome, ...endereco } as DadosEstacionamento;

    if (salvarNovo) salvarNovo.disabled = true;
    try {
        await criarEstacionamento(dados);
        alternarFormulario(false);
        await carregar();
        mostrarMensagem(mensagem, `"${nome}" criado.`, 'success');
    } catch (erro) {
        relatar(erro);
    } finally {
        if (salvarNovo) salvarNovo.disabled = false;
    }
});

abrirNovo?.addEventListener('click', () => alternarFormulario(true));
cancelarNovo?.addEventListener('click', () => alternarFormulario(false));

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
