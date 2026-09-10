import { showAccountView } from './script';

// Cadastro de cliente: monta os dados do formulário, mostra uma mensagem
// de sucesso e volta pra tela de login dentro do próprio painel.
interface ClienteData {
    nome: string;
    email: string;
    cpf: string;
    senha: string;
}

const clientForm = document.getElementById('client-form') as HTMLFormElement | null;
const clientMsg = document.getElementById('client-msg') as HTMLDivElement | null;

clientForm?.addEventListener('submit', (evento: Event) => {
    evento.preventDefault();
    if (!clientMsg) return;

    const nome = (document.getElementById('nome-cli') as HTMLInputElement).value;
    const email = (document.getElementById('email-cli') as HTMLInputElement).value;
    const cpf = (document.getElementById('cpf-cli') as HTMLInputElement).value;
    const senha = (document.getElementById('senha-cli') as HTMLInputElement).value;

    const novoCliente: ClienteData = { nome, email, cpf, senha };
    console.log('Dados do Cliente enviados:', novoCliente);

    clientMsg.textContent = 'Cliente cadastrado com sucesso! Faça login para continuar.';
    clientMsg.className = 'message msg-success';

    setTimeout(() => {
        clientForm.reset();
        clientMsg.textContent = '';
        clientMsg.className = 'message';
        showAccountView('login');
    }, 1200);
});
