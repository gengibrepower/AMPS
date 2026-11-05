import { getSession, clearSession } from '../auth';
import { destinosDe } from '../auth/sessao';
import type { Destino } from '../auth/sessao';

export const menuButton = document.getElementById('menu-button') as HTMLButtonElement | null;
export const closeSidebarButton = document.getElementById('close-sidebar-button') as HTMLButtonElement | null;
const sidebarNav = document.querySelector('nav.sidebar-nav');

export function toggleSidebar(): void {
    document.body.classList.toggle('navBar');
    sidebarNav?.classList.toggle('disabled');
}

menuButton?.addEventListener('click', toggleSidebar);
closeSidebarButton?.addEventListener('click', toggleSidebar);

const bottomAccountButton = document.getElementById('navConta') as HTMLButtonElement | null;
const sidebarAccountButton = document.getElementById('sidebarAccountBtn') as HTMLButtonElement | null;
const sidebarAccountLabel = document.getElementById('sidebarAccountLabel') as HTMLElement | null;
const accountContent = document.getElementById('accountPanel') as HTMLDivElement | null;
const closeLoginButton = document.getElementById('closeLogin') as HTMLButtonElement | null;
const accountEmail = document.getElementById('accountEmail') as HTMLElement | null;
const navLista = document.getElementById('navLista') as HTMLUListElement | null;
const bottomHomeButton = document.getElementById('navHome') as HTMLButtonElement | null;
const bottomAreaButton = document.getElementById('navArea') as HTMLButtonElement | null;
const bottomAreaIcon = document.getElementById('navAreaIcone') as HTMLElement | null;
const bottomAreaLabel = document.getElementById('navAreaRotulo') as HTMLElement | null;
const logoutButton = document.getElementById('logoutBtn') as HTMLButtonElement | null;
const cabecalhoConta = document.getElementById('cabecalhoConta') as HTMLElement | null;

let destinoDaBarra = '/index.html';

export type AccountView = 'login' | 'loggedIn' | 'registerClient' | 'registerOwner';

const views: Record<AccountView, HTMLElement | null> = {
    login: document.getElementById('accountLoggedOut'),
    loggedIn: document.getElementById('accountLoggedIn'),
    registerClient: document.getElementById('accountRegisterClient'),
    registerOwner: document.getElementById('accountRegisterOwner'),
};

export function showAccountView(view: AccountView): void {
    for (const [nome, elemento] of Object.entries(views)) {
        elemento?.classList.toggle('disabled', nome !== view);
    }
}

function itemDeNavegacao(destino: Destino): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'nav-item nav-item-area';

    const icone = document.createElement('span');
    icone.className = 'material-symbols-sharp';
    icone.textContent = destino.icone;

    const link = document.createElement('a');
    link.href = destino.href;
    if (destino.href === paginaAtual()) link.setAttribute('aria-current', 'page');
    link.append(icone, destino.rotulo);

    item.append(link);
    return item;
}

// A barra de baixo tem três lugares fixos; o do meio é a área da conta, e some
// para quem só pode buscar.
function renderBarraDeBaixo(destinos: readonly Destino[]): void {
    const destino = destinos.find((candidato) => candidato.area !== 'buscar');

    bottomAreaButton?.classList.toggle('disabled', destino === undefined);
    if (!destino) return;

    if (bottomAreaIcon) bottomAreaIcon.textContent = destino.icone;
    if (bottomAreaLabel) bottomAreaLabel.textContent = destino.rotulo;
    bottomAreaButton?.setAttribute('aria-label', destino.rotulo);
    destinoDaBarra = destino.href;
}

function paginaAtual(): string {
    return window.location.pathname === '/' ? '/index.html' : window.location.pathname;
}

function iniciais(nome: string): string {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    const primeira = partes[0]?.[0] ?? '';
    const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
    return (primeira + ultima).toUpperCase();
}

function sair(): void {
    clearSession();
    window.location.href = '/index.html';
}

function iconeDeMaterial(nome: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'material-symbols-sharp';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = nome;
    return span;
}

function renderCabecalho(nome: string | null): void {
    if (!cabecalhoConta) return;

    if (nome === null) {
        if (accountContent) {
            const entrar = document.createElement('button');
            entrar.type = 'button';
            entrar.className = 'botao-entrar';
            entrar.textContent = 'Entrar';
            entrar.addEventListener('click', toggleAccountContent);
            cabecalhoConta.replaceChildren(entrar);
        } else {
            const entrar = document.createElement('a');
            entrar.href = '/index.html#entrar';
            entrar.className = 'botao-entrar';
            entrar.textContent = 'Entrar';
            cabecalhoConta.replaceChildren(entrar);
        }
        return;
    }

    const chip = document.createElement('a');
    chip.className = 'conta-chip';
    chip.href = '/client/perfil.html';
    chip.title = 'Meu perfil';

    const rotulo = document.createElement('span');
    rotulo.className = 'conta-nome';
    rotulo.textContent = nome;

    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = iniciais(nome);

    chip.append(rotulo, avatar);

    const botaoSair = document.createElement('button');
    botaoSair.type = 'button';
    botaoSair.id = 'sair';
    botaoSair.className = 'botao-sair';
    botaoSair.setAttribute('aria-label', 'Sair');
    botaoSair.title = 'Sair';
    botaoSair.append(iconeDeMaterial('logout'));
    botaoSair.addEventListener('click', sair);

    cabecalhoConta.replaceChildren(chip, botaoSair);
}

function renderNavegacao(tipo: string | null): void {
    const destinos = destinosDe(tipo);

    for (const antigo of navLista?.querySelectorAll('.nav-item-area') ?? []) {
        antigo.remove();
    }
    navLista?.prepend(...destinos.map(itemDeNavegacao));

    renderBarraDeBaixo(destinos);
}

export function renderAccountPanel(): void {
    const session = getSession();

    // Logado, o nome já está no chip do cabeçalho; o item da sidebar só
    // existe para quem ainda precisa entrar.
    const itemDaConta = sidebarAccountButton?.closest('li');
    if (itemDaConta) itemDaConta.hidden = session !== null;

    if (session) {
        if (accountEmail) accountEmail.textContent = session.usuario.email;
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = session.usuario.nome;
        showAccountView('loggedIn');
    } else {
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = 'Entrar';
        showAccountView('login');
    }

    renderNavegacao(session?.usuario.tipo_conta ?? null);
    renderCabecalho(session?.usuario.nome ?? null);
}

function toggleAccountContent(): void {
    renderAccountPanel();
    accountContent?.classList.toggle('disabled');
}

bottomAccountButton?.addEventListener('click', toggleAccountContent);

bottomHomeButton?.addEventListener('click', () => {
    window.location.href = '/index.html';
});

bottomAreaButton?.addEventListener('click', () => {
    window.location.href = destinoDaBarra;
});

sidebarAccountButton?.addEventListener('click', () => {
    if (!accountContent) {
        window.location.href = getSession() ? '/client/perfil.html' : '/index.html#entrar';
        return;
    }
    toggleSidebar();
    toggleAccountContent();
});

closeLoginButton?.addEventListener('click', () => {
    accountContent?.classList.add('disabled');
});

logoutButton?.addEventListener('click', () => {
    clearSession();
    window.location.reload();
});

const navegacao: ReadonlyArray<readonly [string, AccountView]> = [
    ['linkRegisterClient', 'registerClient'],
    ['linkRegisterOwner', 'registerOwner'],
    ['linkBackToLoginFromOwner', 'login'],
    ['linkBackToLoginFromRegister', 'login'],
];

for (const [id, destino] of navegacao) {
    document.getElementById(id)?.addEventListener('click', (evento: Event) => {
        evento.preventDefault();
        showAccountView(destino);
    });
}

renderAccountPanel();

if (window.location.hash === '#entrar' && accountContent && !getSession()) {
    accountContent.classList.remove('disabled');
    history.replaceState(null, '', window.location.pathname + window.location.search);
}
