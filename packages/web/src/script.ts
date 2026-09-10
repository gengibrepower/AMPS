import { getSession, clearSession } from './auth';

// Definição de elementos da sidebar
export const menuButton = document.getElementById('menu-button') as HTMLButtonElement | null;
export const closeSidebarButton = document.getElementById('close-sidebar-button') as HTMLButtonElement | null;
const sidebarNav = document.querySelector('nav.sidebar-nav');

// Interação da sidebar
export function toggleSidebar(): void {
    document.body.classList.toggle('navBar');
    sidebarNav?.classList.toggle('disabled');
}

menuButton?.addEventListener('click', toggleSidebar);
closeSidebarButton?.addEventListener('click', toggleSidebar);

// Definição de elementos para painel de conta
const bottomAccountButton = document.getElementById('navConta') as HTMLButtonElement | null;
const sidebarAccountButton = document.getElementById('sidebarAccountBtn') as HTMLButtonElement | null;
const sidebarAccountLabel = document.getElementById('sidebarAccountLabel') as HTMLElement | null;
const accountContent = document.getElementById('accountPanel') as HTMLDivElement | null;
const closeLoginButton = document.getElementById('closeLogin') as HTMLButtonElement | null;
const accountEmail = document.getElementById('accountEmail') as HTMLElement | null;
const logoutButton = document.getElementById('logoutBtn') as HTMLButtonElement | null;

type AccountView = 'login' | 'loggedIn' | 'forgot' | 'registerClient';

const viewLogin = document.getElementById('accountLoggedOut');
const viewLoggedIn = document.getElementById('accountLoggedIn');
const viewForgot = document.getElementById('accountForgotPassword');
const viewRegisterClient = document.getElementById('accountRegisterClient');

// Exibe apenas a tela selecionada no painel
export function showAccountView(view: AccountView): void {
    viewLogin?.classList.add('disabled');
    viewLoggedIn?.classList.add('disabled');
    viewForgot?.classList.add('disabled');
    viewRegisterClient?.classList.add('disabled');

    if (view === 'login') {
        viewLogin?.classList.remove('disabled');
    } else if (view === 'loggedIn') {
        viewLoggedIn?.classList.remove('disabled');
    } else if (view === 'forgot') {
        viewForgot?.classList.remove('disabled');
    } else if (view === 'registerClient') {
        viewRegisterClient?.classList.remove('disabled');
    }
}

// Verifica sessão salva, caso exista, exibe os dados
// Caso não exista, exibe tela de login
export function renderAccountPanel(): void {
    const session = getSession();

    if (session) {
        if (accountEmail) accountEmail.textContent = session.email;
        if (sidebarAccountLabel) sidebarAccountLabel.textContent = session.email;
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

// Botão mobile
bottomAccountButton?.addEventListener('click', toggleAccountContent);

// Botão desktop
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

// Define links para trocar telas dentro do painel
const linkForgotPassword = document.getElementById('linkForgotPassword') as HTMLAnchorElement | null;
const linkRegisterClient = document.getElementById('linkRegisterClient') as HTMLAnchorElement | null;
const linkBackToLoginFromForgot = document.getElementById('linkBackToLoginFromForgot') as HTMLAnchorElement | null;
const linkBackToLoginFromRegister = document.getElementById('linkBackToLoginFromRegister') as HTMLAnchorElement | null;

linkForgotPassword?.addEventListener('click', (evento: Event) => {
    evento.preventDefault();
    showAccountView('forgot');
});

linkRegisterClient?.addEventListener('click', (evento: Event) => {
    evento.preventDefault();
    showAccountView('registerClient');
});

linkBackToLoginFromForgot?.addEventListener('click', (evento: Event) => {
    evento.preventDefault();
    showAccountView('login');
});

linkBackToLoginFromRegister?.addEventListener('click', (evento: Event) => {
    evento.preventDefault();
    showAccountView('login');
});

renderAccountPanel();
