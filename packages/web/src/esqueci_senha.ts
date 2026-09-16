import { mostrarMensagem } from './ui';

const forgotForm = document.getElementById('forgot-form') as HTMLFormElement | null;
const forgotMsg = document.getElementById('forgot-msg') as HTMLDivElement | null;

// Não existe endpoint de recuperação de senha na API ainda.
forgotForm?.addEventListener('submit', (evento: Event) => {
    evento.preventDefault();
    mostrarMensagem(forgotMsg, 'Recuperação de senha ainda não está disponível.', 'info');
});
