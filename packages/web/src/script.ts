import { getSession, clearSession } from './auth';

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
const logoutButton = document.getElementById('logoutBtn') as HTMLButtonElement | null;

export type AccountView = 'login' | 'loggedIn' | 'forgot' | 'registerClient';

const views: Record<AccountView, HTMLElement | null> = {
    login: document.getElementById('accountLoggedOut'),
    loggedIn: document.getElementById('accountLoggedIn'),
    forgot: document.getElementById('accountForgotPassword'),
    registerClient: document.getElementById('accountRegisterClient'),
};

export function showAccountView(view: AccountView): void {
    for (const [nome, elemento] of Object.entries(views)) {
        elemento?.classList.toggle('disabled', nome !== view);
    }
}

export function renderAccountPanel(): void {
    const session = getSession();

    if (session) {
        const email = session.usuario.email;
        if (accountEmail) accountEmail.textContent = email;
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = email;
        showAccountView('loggedIn');
    } else {
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = 'Entrar';
        showAccountView('login');
    }
}

function toggleAccountContent(): void {
    renderAccountPanel();
    accountContent?.classList.toggle('disabled');
}

bottomAccountButton?.addEventListener('click', toggleAccountContent);

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
