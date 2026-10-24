import { ApiError, carregarMetricas } from '../api';
import type { MetricasWire } from '../api';
import { clearSession, getSession, usuarioAtual } from '../auth';
import { enderecoEmLinha } from '../dom/endereco';
import { limparMensagem, mostrarMensagem } from '../dom/ui';

const bloqueio = document.getElementById('bloqueio') as HTMLElement | null;
const bloqueioTexto = document.getElementById('bloqueioTexto') as HTMLElement | null;
const bloqueioLink = document.getElementById('bloqueioLink') as HTMLAnchorElement | null;
const area = document.getElementById('area') as HTMLElement | null;
const conta = document.getElementById('conta') as HTMLElement | null;
const donoNome = document.getElementById('donoNome') as HTMLElement | null;
const sair = document.getElementById('sair') as HTMLButtonElement | null;
const atualizar = document.getElementById('atualizar') as HTMLButtonElement | null;
const mensagem = document.getElementById('mensagem') as HTMLElement | null;
const barraOcupacao = document.getElementById('barraOcupacao') as HTMLElement | null;
const semVagas = document.getElementById('semVagas') as HTMLElement | null;
const porTipo = document.getElementById('porTipo') as HTMLUListElement | null;
const desenho = document.getElementById('desenho') as HTMLElement | null;

const NOME_DO_TIPO: Readonly<Record<string, string>> = {
    comum: 'Comum',
    pcd: 'PCD',
    idoso: 'Idoso',
    moto: 'Moto',
    eletrico: 'Elétrico',
};

function idDaUrl(): number | null {
    const bruto = new URLSearchParams(window.location.search).get('estacionamento');
    const id = Number(bruto);
    return bruto !== null && Number.isInteger(id) && id > 0 ? id : null;
}

function escrever(id: string, texto: string): void {
    const alvo = document.getElementById(id);
    if (alvo) alvo.textContent = texto;
}

function porcentagem(fracao: number): string {
    return `${Math.round(fracao * 100)}%`;
}

function renderizarBarra(metricas: MetricasWire): void {
    if (!barraOcupacao) return;
    const { total, livre, ocupada, reservada } = metricas.vagas;

    barraOcupacao.classList.toggle('disabled', total === 0);
    semVagas?.classList.toggle('disabled', total > 0);

    const fatias = [
        { classe: 'fatia-livre', valor: livre, rotulo: 'livres' },
        { classe: 'fatia-ocupada', valor: ocupada, rotulo: 'ocupadas' },
        { classe: 'fatia-reservada', valor: reservada, rotulo: 'reservadas' },
    ].filter((fatia) => fatia.valor > 0);

    barraOcupacao.replaceChildren(
        ...fatias.map((fatia) => {
            const parte = document.createElement('span');
            parte.className = `fatia ${fatia.classe}`;
            parte.style.flexGrow = String(fatia.valor);
            parte.title = `${fatia.valor} ${fatia.rotulo}`;
            return parte;
        }),
    );
    barraOcupacao.setAttribute(
        'aria-label',
        `${livre} livres, ${ocupada} ocupadas e ${reservada} reservadas de ${total} vagas`,
    );
}

function renderizarTipos(metricas: MetricasWire): void {
    if (!porTipo) return;

    if (metricas.por_tipo.length === 0) {
        const vazio = document.createElement('li');
        vazio.className = 'vazio';
        vazio.textContent = 'Sem vagas cadastradas.';
        porTipo.replaceChildren(vazio);
        return;
    }

    porTipo.replaceChildren(
        ...metricas.por_tipo.map((linha) => {
            const item = document.createElement('li');
            item.className = 'tipo';

            const nome = document.createElement('span');
            nome.className = 'tipo-nome';
            nome.textContent = NOME_DO_TIPO[linha.tipo] ?? linha.tipo;

            const trilho = document.createElement('span');
            trilho.className = 'tipo-trilho';
            const cheio = document.createElement('span');
            cheio.className = 'tipo-cheio';
            cheio.style.width = porcentagem(linha.livres / linha.total);
            trilho.append(cheio);

            const valor = document.createElement('span');
            valor.className = 'tipo-valor';
            valor.textContent = `${linha.livres} de ${linha.total} livres`;

            item.append(nome, trilho, valor);
            return item;
        }),
    );
}

function renderizarDesenho(metricas: MetricasWire): void {
    if (!desenho) return;

    const linhas: readonly (readonly [string, number])[] = [
        ['Entradas', metricas.desenho.entradas],
        ['Pontos de interesse', metricas.desenho.pontos_de_interesse],
        ['Vagas desenhadas', metricas.desenho.vagas_desenhadas],
        ['Conexões', metricas.desenho.conexoes],
        ['Vagas com sensor', metricas.com_sensor],
        ['Versão do desenho', metricas.versao_desenho],
    ];

    desenho.replaceChildren(
        ...linhas.map(([rotulo, valor]) => {
            const linha = document.createElement('div');
            const termo = document.createElement('dt');
            termo.textContent = rotulo;
            const numero = document.createElement('dd');
            numero.textContent = String(valor);
            linha.append(termo, numero);
            return linha;
        }),
    );
}

function renderizar(metricas: MetricasWire): void {
    const { estacionamento, vagas, taxa_ocupacao } = metricas;

    document.title = `${estacionamento.nome} - AMPS`;
    escrever('patioNome', estacionamento.nome);
    escrever('patioEndereco', enderecoEmLinha(estacionamento.endereco));

    const etiqueta = document.getElementById('patioEtiqueta');
    if (etiqueta) {
        etiqueta.className = estacionamento.publicado ? 'etiqueta etiqueta-publicado' : 'etiqueta';
        etiqueta.textContent = estacionamento.publicado ? 'Publicado' : 'Rascunho';
    }
    const editor = document.getElementById('abrirEditor') as HTMLAnchorElement | null;
    if (editor) editor.href = `editor.html?estacionamento=${estacionamento.id}`;

    escrever('kpiTotal', String(vagas.total));
    escrever('kpiLivres', String(vagas.livre));
    escrever('kpiOcupadas', String(vagas.ocupada));
    escrever('kpiReservadas', String(vagas.reservada));
    escrever('kpiOcupacao', taxa_ocupacao === null ? '—' : porcentagem(taxa_ocupacao));

    renderizarBarra(metricas);
    renderizarTipos(metricas);
    renderizarDesenho(metricas);
}

function bloquear(texto: string, paraLogin: boolean): void {
    if (bloqueioTexto) bloqueioTexto.textContent = texto;
    if (bloqueioLink) {
        bloqueioLink.href = paraLogin ? '../index.html' : 'estacionamentos.html';
        bloqueioLink.textContent = paraLogin ? 'Ir para o login' : 'Voltar à lista';
    }
    bloqueio?.classList.remove('disabled');
    area?.classList.add('disabled');
    if (paraLogin) conta?.classList.add('disabled');
}

function relatar(erro: unknown): void {
    if (erro instanceof ApiError && erro.status === 401) {
        clearSession();
        bloquear('Sua sessão expirou. Entre de novo para continuar.', true);
        return;
    }
    if (erro instanceof ApiError && (erro.status === 403 || erro.status === 404)) {
        bloquear('Este estacionamento não é seu ou não existe.', false);
        return;
    }
    mostrarMensagem(mensagem, erro instanceof ApiError ? erro.message : 'Algo deu errado.', 'error');
}

async function carregar(id: number): Promise<void> {
    if (atualizar) atualizar.disabled = true;
    try {
        renderizar(await carregarMetricas(id));
        limparMensagem(mensagem);
        area?.classList.remove('disabled');
    } catch (erro) {
        relatar(erro);
    } finally {
        if (atualizar) atualizar.disabled = false;
    }
}

sair?.addEventListener('click', () => {
    clearSession();
    window.location.href = '../index.html';
});

const usuario = usuarioAtual();
const id = idDaUrl();

if (getSession() === null) {
    bloquear('Entre com uma conta de dono para ver o painel do pátio.', true);
} else if (usuario?.tipo_conta !== 'dono') {
    bloquear('Esta área é só para contas de dono.', true);
} else if (id === null) {
    if (donoNome) donoNome.textContent = usuario.nome;
    bloquear('Abra o painel a partir da lista de estacionamentos.', false);
} else {
    if (donoNome) donoNome.textContent = usuario.nome;
    atualizar?.addEventListener('click', () => void carregar(id));
    void carregar(id);
}
