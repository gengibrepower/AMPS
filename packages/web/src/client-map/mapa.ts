import {
    ApiError,
    buscarEstacionamentoPublicado,
    carregarMapaPublicado,
    listarCarros,
    listarModelos,
    recomendarVaga,
} from '../api';
import type { CarroWire, ModeloWire } from '../api';
import { getSession } from '../auth';
import { criarPalco } from '../graph/render/palco';
import { criarCena } from '../graph/render/cena';
import type { Cena } from '../graph/render/cena';
import type { Cobertura } from '../graph/geometria';
import { comoGrafo } from '../graph/tipos';
import type { Grafo, Papel } from '../graph/tipos';
import { comoDadosDaVaga } from './vagas';
import { limparMensagem, mostrarMensagem } from '../dom/ui';
import { salvarHistorico } from '../historico';

const queryString = window.location.search;
const params = new URLSearchParams(queryString);
const id = Number(params.get('id'));
const palcoDiv = document.getElementById('palco') as HTMLDivElement | null;
const mensagem = document.querySelector<HTMLElement>('#mensagem');
const voltar = document.querySelector<HTMLAnchorElement>('#voltar');
const nomeDoPatio = document.querySelector<HTMLElement>('#nomeDoPatio');

const formVaga = document.querySelector<HTMLFormElement>('#formVaga');
const seletorDeCarro = document.querySelector<HTMLSelectElement>('#carro');
const seletorDeDestino = document.querySelector<HTMLSelectElement>('#destino');
const seletorDeEntrada = document.querySelector<HTMLSelectElement>('#entrada');
const botaoEncontrar = document.querySelector<HTMLButtonElement>('#encontrar');
const semConta = document.querySelector<HTMLElement>('#semConta');
const semCarro = document.querySelector<HTMLElement>('#semCarro');
const resultado = document.querySelector<HTMLElement>('#resultado');
const resultadoNumero = document.querySelector<HTMLElement>('#resultadoNumero');
const resultadoDetalhe = document.querySelector<HTMLElement>('#resultadoDetalhe');
const botaoLimpar = document.querySelector<HTMLButtonElement>('#limpar');
const avisoVaga = document.querySelector<HTMLElement>('#avisoVaga');
const painel = document.querySelector<HTMLElement>('.painel');

// O painel flutua sobre o canvas: à esquerda no desktop, embaixo no celular.
// O que ele cobre sai da conta do enquadramento, senão a vaga cai atrás dele.
function cobertura(): Cobertura {
    const sem = { topo: 0, direita: 0, base: 0, esquerda: 0 };
    if (painel === null || palcoDiv === null) return sem;
    const area = palcoDiv.getBoundingClientRect();
    const caixa = painel.getBoundingClientRect();
    if (caixa.width > area.width / 2) {
        return { ...sem, base: Math.max(0, area.bottom - caixa.top) };
    }
    return { ...sem, esquerda: Math.max(0, caixa.right - area.left) };
}

function opcao(valor: string, texto: string): HTMLOptionElement {
    const elemento = document.createElement('option');
    elemento.value = valor;
    elemento.textContent = texto;
    return elemento;
}

function preencherComNos(seletor: HTMLSelectElement | null, grafo: Grafo, papel: Papel): void {
    if (seletor === null) return;
    const nos = grafo.nodes.filter((no) => no.role === papel);
    seletor.replaceChildren(...nos.map((no) => opcao(no.id, no.label ?? no.id)));
}

function nomeDoCarro(carro: CarroWire, modelos: readonly ModeloWire[]): string {
    const modelo = modelos.find((item) => item.id === carro.modelo_id);
    return modelo === undefined ? carro.placa : `${carro.placa} · ${modelo.marca} ${modelo.nome}`;
}

function rotuloDoNo(grafo: Grafo, noId: string): string {
    const no = grafo.nodes.find((item) => item.id === noId);
    return no?.label ?? noId;
}

function bloquearFormulario(motivo: HTMLElement | null): void {
    motivo?.classList.remove('disabled');
    formVaga?.classList.add('disabled');
}

async function prepararCarros(): Promise<void> {
    if (getSession() === null) {
        bloquearFormulario(semConta);
        return;
    }

    const [carros, modelos] = await Promise.all([listarCarros(), listarModelos()]);
    if (carros.length === 0) {
        bloquearFormulario(semCarro);
        return;
    }
    seletorDeCarro?.replaceChildren(
        ...carros.map((carro) => opcao(String(carro.id), nomeDoCarro(carro, modelos))),
    );
}

function mostrarResultado(numero: string, detalhe: string): void {
    if (resultadoNumero) resultadoNumero.textContent = numero;
    if (resultadoDetalhe) resultadoDetalhe.textContent = detalhe;
    resultado?.classList.remove('disabled');
    formVaga?.classList.add('disabled');
    painel?.classList.add('com-resultado');
}

function esconderResultado(cena: Cena): void {
    cena.recomendar(null, []);
    resultado?.classList.add('disabled');
    formVaga?.classList.remove('disabled');
    painel?.classList.remove('com-resultado');
    limparMensagem(avisoVaga);
    cena.enquadrar(cobertura());
}

function ligarPainel(cena: Cena, grafo: Grafo): void {
    preencherComNos(seletorDeDestino, grafo, 'attractor');
    preencherComNos(seletorDeEntrada, grafo, 'source');

    // O detalhe do pátio linka cada destino direto para cá.
    const destino = params.get('destino');
    const conhecido = Array.from(seletorDeDestino?.options ?? []).some((item) => item.value === destino);
    if (seletorDeDestino && destino !== null && conhecido) seletorDeDestino.value = destino;

    botaoLimpar?.addEventListener('click', () => esconderResultado(cena));

    formVaga?.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        if (!seletorDeCarro || !seletorDeDestino || !seletorDeEntrada) return;

        limparMensagem(avisoVaga);
        if (botaoEncontrar) botaoEncontrar.disabled = true;
        try {
            const resposta = await recomendarVaga(id, {
                carroId: Number(seletorDeCarro.value),
                poi: seletorDeDestino.value,
                entrada: seletorDeEntrada.value,
            });

            if (resposta.vaga === null) {
                cena.recomendar(null, []);
                mostrarMensagem(
                    avisoVaga,
                    'Nenhuma vaga livre comporta esse carro agora. Tente de novo em alguns minutos.',
                    'error',
                );
                return;
            }

            cena.recomendar(resposta.vaga.no_id, resposta.rota?.nos ?? []);
            const entrada = rotuloDoNo(grafo, seletorDeEntrada.value);
            const distancia = resposta.rota === null
                ? ''
                : ` · cerca de ${Math.round(resposta.rota.peso_total)} m`;
            mostrarResultado(resposta.vaga.numero, `${entrada} até a vaga${distancia}`);
            cena.enquadrarRecomendacao(cobertura());
        } catch (erro) {
            mostrarMensagem(
                avisoVaga,
                erro instanceof ApiError ? erro.message : 'Não foi possível calcular a vaga.',
                'error',
            );
        } finally {
            if (botaoEncontrar) botaoEncontrar.disabled = false;
        }
    });
}

if (!Number.isInteger(id) || id <= 0) {
    if (nomeDoPatio) nomeDoPatio.textContent = 'Mapa do estacionamento';
    mostrarMensagem(
        mensagem,
        'Link inválido',
        'error',
    );
} else if (palcoDiv !== null) {
    void (async () => {
        try {
            if (voltar) voltar.href = `/client/estacionamento.html?id=${id}`;
            const [estacionamento, mapa] = await Promise.all([
                buscarEstacionamentoPublicado(id),
                carregarMapaPublicado(id),
            ]);
            document.title = `${estacionamento.nome} - Mapa - AMPS`;
            if (nomeDoPatio) nomeDoPatio.textContent = estacionamento.nome;

            const palco = criarPalco(palcoDiv);
            const cena = criarCena(palco);
            cena.modo('ligar');

            const grafo = comoGrafo(mapa.grafo);
            cena.desenhar(grafo, mapa.vagas.map(comoDadosDaVaga));
            cena.enquadrar();
            salvarHistorico(estacionamento);

            ligarPainel(cena, grafo);
            await prepararCarros();
            cena.enquadrar(cobertura());
        } catch (erro) {
            if (nomeDoPatio) nomeDoPatio.textContent = 'Mapa do estacionamento';
            mostrarMensagem(
                mensagem,
                erro instanceof ApiError ? erro.message : 'Algo deu errado.',
                'error',
            );
        }
    })();
}
