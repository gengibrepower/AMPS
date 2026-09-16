import { ApiError, cadastrarCliente } from './api';
import { showAccountView } from './script';
import { limparFormularioDepois, mostrarMensagem } from './ui';

const clientForm = document.getElementById('client-form') as HTMLFormElement | null;
const clientMsg = document.getElementById('client-msg') as HTMLDivElement | null;
const nomeInput = document.getElementById('nome-cli') as HTMLInputElement | null;
const emailInput = document.getElementById('email-cli') as HTMLInputElement | null;
const cpfInput = document.getElementById('cpf-cli') as HTMLInputElement | null;
const senhaInput = document.getElementById('senha-cli') as HTMLInputElement | null;

clientForm?.addEventListener('submit', async (evento: Event) => {
    evento.preventDefault();

    if (!nomeInput || !emailInput || !cpfInput || !senhaInput) return;

    mostrarMensagem(clientMsg, 'Cadastrando...', 'info');

    try {
        await cadastrarCliente({
            nome: nomeInput.value,
            email: emailInput.value,
            cpf: cpfInput.value,
            senha: senhaInput.value,
        });
        mostrarMensagem(clientMsg, 'Cliente cadastrado com sucesso! Faça login para continuar.', 'success');
        limparFormularioDepois(clientForm, clientMsg, 1200, () => showAccountView('login'));
    } catch (erro) {
        const jaExiste = erro instanceof ApiError && erro.status === 409;
        mostrarMensagem(
            clientMsg,
            jaExiste
                ? 'Já existe uma conta com esse e-mail ou CPF.'
                : erro instanceof ApiError ? erro.message : 'Não foi possível cadastrar.',
            'error',
        );
    }
});
