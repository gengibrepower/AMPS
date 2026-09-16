import { ApiError, login } from './api';
import { saveSession } from './auth';
import { renderAccountPanel } from './script';
import { limparFormularioDepois, mostrarMensagem } from './ui';

const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
const emailInput = document.getElementById('email') as HTMLInputElement | null;
const senhaInput = document.getElementById('senha') as HTMLInputElement | null;
const loginMsg = document.getElementById('login-msg') as HTMLDivElement | null;

loginForm?.addEventListener('submit', async (evento: Event) => {
    evento.preventDefault();

    if (!emailInput || !senhaInput) return;

    const email = emailInput.value;
    const senha = senhaInput.value;

    if (!email || !senha) {
        mostrarMensagem(loginMsg, 'Preencha e-mail e senha para continuar.', 'error');
        return;
    }

    mostrarMensagem(loginMsg, 'Entrando...', 'info');

    try {
        saveSession(await login(email, senha));
        mostrarMensagem(loginMsg, 'Login realizado com sucesso!', 'success');
        limparFormularioDepois(loginForm, loginMsg, 800, renderAccountPanel);
    } catch (erro) {
        const credenciaisErradas = erro instanceof ApiError && erro.status === 401;
        mostrarMensagem(
            loginMsg,
            credenciaisErradas
                ? 'E-mail ou senha incorretos.'
                : erro instanceof ApiError ? erro.message : 'Não foi possível entrar.',
            'error',
        );
    }
});
