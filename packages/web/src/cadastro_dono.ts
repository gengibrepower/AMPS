import { ApiError, cadastrarDono } from './api';
import { showAccountView } from './script';
import { limparFormularioDepois, mostrarMensagem } from './ui';

const ownerForm = document.getElementById('owner-form') as HTMLFormElement | null;
const ownerMsg = document.getElementById('owner-msg') as HTMLDivElement | null;
const nomeInput = document.getElementById('nome-dono') as HTMLInputElement | null;
const emailInput = document.getElementById('email-dono') as HTMLInputElement | null;
const cpfInput = document.getElementById('cpf-dono') as HTMLInputElement | null;
const razaoInput = document.getElementById('razao-dono') as HTMLInputElement | null;
const cnpjInput = document.getElementById('cnpj-dono') as HTMLInputElement | null;
const senhaInput = document.getElementById('senha-dono') as HTMLInputElement | null;

ownerForm?.addEventListener('submit', async (evento: Event) => {
    evento.preventDefault();

    if (!nomeInput || !emailInput || !cpfInput || !razaoInput || !cnpjInput || !senhaInput) return;

    mostrarMensagem(ownerMsg, 'Cadastrando...', 'info');

    try {
        await cadastrarDono({
            nome: nomeInput.value,
            email: emailInput.value,
            cpf: cpfInput.value,
            razao: razaoInput.value,
            cnpj: cnpjInput.value,
            senha: senhaInput.value,
        });
        mostrarMensagem(ownerMsg, 'Estacionamento cadastrado! Faça login para desenhar o pátio.', 'success');
        limparFormularioDepois(ownerForm, ownerMsg, 1200, () => showAccountView('login'));
    } catch (erro) {
        const jaExiste = erro instanceof ApiError && erro.status === 409;
        mostrarMensagem(
            ownerMsg,
            jaExiste
                ? 'Já existe uma conta com esse e-mail, CPF ou CNPJ.'
                : erro instanceof ApiError ? erro.message : 'Não foi possível cadastrar.',
            'error',
        );
    }
});
