import type { LoginResposta, UsuarioWire } from './api';

export type Session = LoginResposta;

const STORAGE_KEY = 'amps:session';

function pareceSessao(valor: unknown): valor is Session {
    const s = valor as Session | null;
    return (
        typeof s === 'object' && s !== null &&
        typeof s.token === 'string' &&
        typeof s.usuario === 'object' && s.usuario !== null &&
        typeof s.usuario.email === 'string'
    );
}

export function saveSession(session: Session): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const valor: unknown = JSON.parse(raw);
        // Sessões gravadas pela versão antiga (só { email }) não têm token: descarta.
        return pareceSessao(valor) ? valor : null;
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

export function usuarioAtual(): UsuarioWire | null {
    return getSession()?.usuario ?? null;
}

export function authHeader(): Record<string, string> {
    const session = getSession();
    return session ? { Authorization: `Bearer ${session.token}` } : {};
}
