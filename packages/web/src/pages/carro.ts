import {
    ApiError,
    cadastrarCarro,
    excluirCarro,
    listarCarros,
    listarModelos,
    type CarroWire,
    type ModeloWire,
} from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { limparMensagem, mostrarMensagem } from '../ui';

const bloqueio = document.querySelector<HTMLElement>('#bloqueio');
const bloqueioTexto = document.querySelector<HTMLElement>('#bloqueioTexto');
const area = document.querySelector<HTMLElement>('#area');
const usuarioNome = document.querySelector<HTMLElement>('#usuarioNome');
const conta = document.querySelector<HTMLElement>('#conta');

const sair = document.querySelector<HTMLButtonElement>('#sair');
const abrirNovo = document.querySelector<HTMLButtonElement>('#abrirNovo');
const cancelarNovo = document.querySelector<HTMLButtonElement>('#cancelarNovo');
const salvarNovo = document.querySelector<HTMLButtonElement>('#salvarNovo');

const formNovo = document.querySelector<HTMLFormElement>('#formNovo');
const placa = document.querySelector<HTMLInputElement>('#placa');
const modelo = document.querySelector<HTMLSelectElement>('#modelo');

const mensagem = document.querySelector<HTMLElement>('#mensagem');
const vazio = document.querySelector<HTMLElement>('#vazio');
const lista = document.querySelector<HTMLUListElement>('#lista');

function abrirFormulario(): void {
    formNovo?.classList.remove('disabled');
    abrirNovo?.classList.add('disabled');
    limparMensagem(mensagem);
    placa?.focus();
}

function fecharFormulario(): void {
    formNovo?.classList.add('disabled');
    abrirNovo?.classList.remove('disabled');
    formNovo?.reset();
    limparMensagem(mensagem);
}

abrirNovo?.addEventListener('click', abrirFormulario);
cancelarNovo?.addEventListener('click', fecharFormulario);

async function carregarModelos(): Promise<readonly ModeloWire[]> {
    const modelos = await listarModelos();
    modelosDisponiveis = modelos;

    if (modelo === null) return modelos;

    modelo.innerHTML = '<option value="">Selecione um modelo</option>';

    for (const item of modelos) {
        const option = document.createElement('option');
        option.value = String(item.id);
        option.textContent = `${item.marca} ${item.nome}`;
        modelo.appendChild(option);
    }

    return modelos;
}

let modelosDisponiveis: readonly ModeloWire[] = [];

function renderizarCarros(carros: readonly CarroWire[]): void {
    if (lista === null || vazio === null) return;

    lista.innerHTML = '';

    if (carros.length === 0) {
        vazio.classList.remove('disabled');
        return;
    }

    vazio.classList.add('disabled');

    for (const carro of carros) {
        const modeloCarro = modelosDisponiveis.find(
            (item) => item.id === carro.modelo_id,
        );

        const item = document.createElement('li');
        item.className = 'item';

        const conteudo = document.createElement('div');

        const placaCarro = document.createElement('p');
        placaCarro.className = 'item-nome';
        placaCarro.textContent = carro.placa;
        const descricao = document.createElement('p');
        descricao.className = 'item-endereco';

        if (modeloCarro !== undefined) {
            descricao.textContent = `${modeloCarro.marca} ${modeloCarro.nome}`;
        } else {
            descricao.textContent = `Modelo #${carro.modelo_id}`;
        }

        conteudo.append(placaCarro, descricao);

        const botaoExcluir = document.createElement('button');
        botaoExcluir.type = 'button';
        botaoExcluir.className = 'botao-texto';
        botaoExcluir.textContent = 'Excluir';
        botaoExcluir.addEventListener('click', async () => {
            const confirmou = window.confirm(
                `Deseja realmente excluir o carro ${carro.placa}?`,
            );

            if (!confirmou) return;

            botaoExcluir.disabled = true;

            try {
                await excluirCarro(carro.id);
                await carregarCarros();
                mostrarMensagem(mensagem, 'Carro excluído com sucesso.', 'success');
            } catch (erro) {
                botaoExcluir.disabled = false;
                relatar(erro);
            }
        });
        
        item.append(conteudo, botaoExcluir);
        lista.appendChild(item);
    }
}

async function carregarCarros(): Promise<void> {
    const carros = await listarCarros();
    renderizarCarros(carros);
}

function bloquear(texto: string): void {
    if (bloqueioTexto !== null) {
        bloqueioTexto.textContent = texto;
    }

    bloqueio?.classList.remove('disabled');
    area?.classList.add('disabled');
    conta?.classList.add('disabled');
}

function relatar(erro: unknown): void {
    if (erro instanceof ApiError && erro.status === 401) {
        clearSession();
        bloquear('Sua sessão expirou. Entre de novo para continuar.');
        return;
    }

    mostrarMensagem(
        mensagem,
        erro instanceof ApiError ? erro.message : 'Algo deu errado.',
        'error',
    );
}

formNovo?.addEventListener('submit', async (event) => {
    event.preventDefault();
    limparMensagem(mensagem);

    const placaDigitada = placa?.value.trim() ?? '';
    const modeloId = Number(modelo?.value);

    if (placaDigitada === '' || !Number.isInteger(modeloId) || modeloId <= 0) {
        mostrarMensagem(mensagem, 'Preencha a placa e selecione um modelo.', 'error');
        return;
    }

    if (salvarNovo !== null) {
        salvarNovo.disabled = true;
    }

    try {
        await cadastrarCarro(placaDigitada, modeloId);

        fecharFormulario();
        mostrarMensagem(mensagem, 'Carro cadastrado com sucesso.', 'success');

        await carregarCarros();
    } catch (erro) {
        relatar(erro);
    } finally {
        if (salvarNovo !== null) {
            salvarNovo.disabled = false;
        }
    }
});

sair?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'index.html';
});

const usuario = usuarioAtual();

if (getSession() === null) {
    bloquear('Entre com sua conta para ver seus carros.');
} else {
    if (usuarioNome !== null && usuario !== null) {
        usuarioNome.textContent = usuario.nome;
    }

    area?.classList.remove('disabled');

    void (async () => {
        try {
            await carregarModelos();
            await carregarCarros();
        } catch (erro) {
            relatar(erro);
        }
    })();
}