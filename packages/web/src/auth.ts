// Sessão simples baseada em localStorage, usada tanto pela tela de login
// quanto pelo app (web/new-web v2) para saber se há um usuário logado.
// Não há backend ainda: isto é um "mock" de autenticação client-side.

export interface Session {
    email: string;
}

const STORAGE_KEY = "amps:session";

export function saveSession(email: string): void {
    const session: Session = { email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as Session;
    } catch {
        return null;
    }
}

export function clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn(): boolean {
    return getSession() !== null;
}
