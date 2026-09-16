const forgotForm = document.getElementById('forgot-form') as HTMLFormElement | null;
const emailRecuperacaoInput = document.getElementById('email-recuperacao') as HTMLInputElement | null;
const forgotMsg = document.getElementById('forgot-msg') as HTMLDivElement | null;

forgotForm?.addEventListener('submit', (evento: Event) => {
    evento.preventDefault();

    if (!emailRecuperacaoInput || !forgotMsg) return;

    const email = emailRecuperacaoInput.value;
    forgotMsg.textContent = `Um link de recuperação foi enviado para: ${email}`;
    forgotMsg.className = 'message msg-info';
    forgotForm.reset();
});
