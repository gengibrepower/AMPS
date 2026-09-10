import { saveSession } from './auth';
import { renderAccountPanel } from './script';

// Login: confere se e-mail e senha foram preenchidos, salva a sessão e
// atualiza o painel de conta pra mostrar a tela de logado.
const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
const emailInput = document.getElementById('email') as HTMLInputElement | null;
const senhaInput = document.getElementById('senha') as HTMLInputElement | null;
const loginMsg = document.getElementById('login-msg') as HTMLDivElement | null;

loginForm?.addEventListener('submit', (evento: Event) => {
    evento.preventDefault();

    if (!emailInput || !senhaInput || !loginMsg) return;

    const emailValue = emailInput.value;
    const senhaValue = senhaInput.value;

    if (emailValue && senhaValue) {
        saveSession(emailValue);

        loginMsg.textContent = 'Login realizado com sucesso!';
        loginMsg.className = 'message msg-success';

        setTimeout(() => {
            loginForm.reset();
            loginMsg.textContent = '';
            loginMsg.className = 'message';
            renderAccountPanel();
        }, 800);
    } else {
        loginMsg.textContent = 'Preencha e-mail e senha para continuar.';
        loginMsg.className = 'message msg-error';
    }
});
