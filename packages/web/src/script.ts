import { getSession, clearSession } from './auth';
import { destinosDe } from './sessao';
import type { Destino } from './sessao';

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

let destinoDaBarra = 'index.html';

export type AccountView = 'login' | 'loggedIn' | 'forgot' | 'registerClient' | 'registerOwner';

const views: Record<AccountView, HTMLElement | null> = {
    login: document.getElementById('accountLoggedOut'),
    loggedIn: document.getElementById('accountLoggedIn'),
    forgot: document.getElementById('accountForgotPassword'),
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
    icone.className = 'material-symbols-outlined';
    icone.textContent = destino.icone;

    const link = document.createElement('a');
    link.href = destino.href;
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

    if (session) {
        if (accountEmail) accountEmail.textContent = session.usuario.email;
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = session.usuario.nome;
        showAccountView('loggedIn');
    } else {
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = 'Entrar';
        showAccountView('login');
    }

    renderNavegacao(session?.usuario.tipo_conta ?? null);
}

function toggleAccountContent(): void {
    renderAccountPanel();
    accountContent?.classList.toggle('disabled');
}

bottomAccountButton?.addEventListener('click', toggleAccountContent);

bottomHomeButton?.addEventListener('click', () => {
    window.location.href = 'index.html';
});

bottomAreaButton?.addEventListener('click', () => {
    window.location.href = destinoDaBarra;
});

sidebarAccountButton?.addEventListener('click', () => {
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
    ['linkForgotPassword', 'forgot'],
    ['linkRegisterClient', 'registerClient'],
    ['linkRegisterOwner', 'registerOwner'],
    ['linkBackToLoginFromOwner', 'login'],
    ['linkBackToLoginFromForgot', 'login'],
    ['linkBackToLoginFromRegister', 'login'],
];

for (const [id, destino] of navegacao) {
    document.getElementById(id)?.addEventListener('click', (evento: Event) => {
        evento.preventDefault();
        showAccountView(destino);
    });
}

renderAccountPanel();
