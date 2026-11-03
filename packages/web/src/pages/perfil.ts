import {
    ApiError,
    alterarSenha,
    atualizarPerfil,
    carregarPerfil,
    type UsuarioWire,
} from '../api';
import { clearSession, getSession, saveSession } from '../auth';
import { limparMensagem, mostrarMensagem } from '../dom/ui';

const bloqueio = document.querySelector<HTMLElement>('#bloqueio');
const bloqueioTexto = document.querySelector<HTMLElement>('#bloqueioTexto');
const area = document.querySelector<HTMLElement>('#area');
const usuarioNome = document.querySelector<HTMLElement>('#usuarioNome');
const conta = document.querySelector<HTMLElement>('#conta');
const sair = document.querySelector<HTMLButtonElement>('#sair');

const formDados = document.querySelector<HTMLFormElement>('#formDados');
const nome = document.querySelector<HTMLInputElement>('#nome');
const email = document.querySelector<HTMLInputElement>('#email');
const salvarDados = document.querySelector<HTMLButtonElement>('#salvarDados');
const mensagemDados = document.querySelector<HTMLElement>('#mensagemDados');

const formSenha = document.querySelector<HTMLFormElement>('#formSenha');
const senhaAtual = document.querySelector<HTMLInputElement>('#senhaAtual');
const senhaNova = document.querySelector<HTMLInputElement>('#senhaNova');
const senhaConfirmacao = document.querySelector<HTMLInputElement>('#senhaConfirmacao');
const salvarSenha = document.querySelector<HTMLButtonElement>('#salvarSenha');
const mensagemSenha = document.querySelector<HTMLElement>('#mensagemSenha');

function bloquear(texto: string): void {
    if (bloqueioTexto !== null) {
        bloqueioTexto.textContent = texto;
    }

    bloqueio?.classList.remove('disabled');
    area?.classList.add('disabled');
    conta?.classList.add('disabled');
}

function relatar(erro: unknown, alvo: HTMLElement | null): void {
    if (erro instanceof ApiError && erro.status === 401) {
        clearSession();
        bloquear('Sua sessão expirou. Entre de novo para continuar.');
        return;
    }

    if (erro instanceof ApiError && erro.status === 409) {
        mostrarMensagem(alvo, 'Este e-mail já pertence a outra conta.', 'error');
        return;
    }

    if (erro instanceof ApiError && erro.status === 422) {
        mostrarMensagem(alvo, 'A senha atual está incorreta.', 'error');
        return;
    }

    mostrarMensagem(
        alvo,
        erro instanceof ApiError ? erro.message : 'Algo deu errado.',
        'error',
    );
}

function preencher(usuario: UsuarioWire): void {
    if (nome !== null) nome.value = usuario.nome;
    if (email !== null) email.value = usuario.email;
    if (usuarioNome !== null) usuarioNome.textContent = usuario.nome;
}

function guardarNaSessao(usuario: UsuarioWire): void {
    const sessao = getSession();
    if (sessao !== null) {
        saveSession({ ...sessao, usuario });
    }
}

formDados?.addEventListener('submit', async (event) => {
    event.preventDefault();
    limparMensagem(mensagemDados);

    const nomeDigitado = nome?.value.trim() ?? '';
    const emailDigitado = email?.value.trim() ?? '';

    if (nomeDigitado === '' || emailDigitado === '') {
        mostrarMensagem(mensagemDados, 'Preencha o nome e o e-mail.', 'error');
        return;
    }

    if (salvarDados !== null) salvarDados.disabled = true;

    try {
        const usuario = await atualizarPerfil(nomeDigitado, emailDigitado);
        preencher(usuario);
        guardarNaSessao(usuario);
        mostrarMensagem(mensagemDados, 'Dados atualizados com sucesso.', 'success');
    } catch (erro) {
        relatar(erro, mensagemDados);
    } finally {
        if (salvarDados !== null) salvarDados.disabled = false;
    }
});

formSenha?.addEventListener('submit', async (event) => {
    event.preventDefault();
    limparMensagem(mensagemSenha);

    const atual = senhaAtual?.value ?? '';
    const nova = senhaNova?.value ?? '';
    const confirmacao = senhaConfirmacao?.value ?? '';

    if (atual === '' || nova === '' || confirmacao === '') {
        mostrarMensagem(mensagemSenha, 'Preencha todos os campos de senha.', 'error');
        return;
    }

    if (nova !== confirmacao) {
        mostrarMensagem(mensagemSenha, 'A confirmação não confere com a nova senha.', 'error');
        return;
    }

    if (salvarSenha !== null) salvarSenha.disabled = true;

    try {
        await alterarSenha(atual, nova);
        formSenha.reset();
        mostrarMensagem(mensagemSenha, 'Senha alterada com sucesso.', 'success');
    } catch (erro) {
        relatar(erro, mensagemSenha);
    } finally {
        if (salvarSenha !== null) salvarSenha.disabled = false;
    }
});

sair?.addEventListener('click', () => {
    clearSession();
    window.location.href = '../index.html';
});

if (getSession() === null) {
    bloquear('Entre com sua conta para ver seu perfil.');
} else {
    area?.classList.remove('disabled');

    void (async () => {
        try {
            preencher(await carregarPerfil());
        } catch (erro) {
            relatar(erro, mensagemDados);
        }
    })();
}