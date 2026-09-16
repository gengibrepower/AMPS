import { showAccountView } from './script';

const clientForm = document.getElementById('client-form') as HTMLFormElement | null;
const clientMsg = document.getElementById('client-msg') as HTMLDivElement | null;

clientForm?.addEventListener('submit', (evento: Event) => {
    evento.preventDefault();
    if (!clientMsg) return;

    clientMsg.textContent = 'Cliente cadastrado com sucesso! Faça login para continuar.';
    clientMsg.className = 'message msg-success';

    setTimeout(() => {
        clientForm.reset();
        clientMsg.textContent = '';
        clientMsg.className = 'message';
        showAccountView('login');
    }, 1200);
});
