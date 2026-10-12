import { authHeader } from '../auth';

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001';

export class ApiError extends Error {
    // `vagas` vem junto no 422 da publicação, nomeando as que não têm caminho.
    // É estruturado de propósito: interpretar a mensagem em português para
    // descobrir quais realçar quebraria ao primeiro ajuste de texto.
    constructor(
        readonly status: number,
        mensagem: string,
        readonly vagas: readonly string[] = [],
    ) {
        super(mensagem);
        this.name = 'ApiError';
    }
}

export async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    let resposta: Response;
    try {
        resposta = await fetch(`${BASE_URL}${caminho}`, {
            ...init,
            headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        });
    } catch {
        // fetch só rejeita quando a requisição nem chegou: API fora do ar, DNS, CORS.
        throw new ApiError(0, 'Não foi possível falar com o servidor.');
    }

    const corpo: unknown = await resposta.json().catch(() => null);

    if (!resposta.ok) {
        const falha = corpo as { erro?: string; vagas?: readonly string[] } | null;
        throw new ApiError(
            resposta.status,
            falha?.erro ?? `Erro ${resposta.status}.`,
            Array.isArray(falha?.vagas) ? falha.vagas : [],
        );
    }
    return corpo as T;
}

export function pedirAutenticado<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    return pedir<T>(caminho, {
        ...init,
        headers: { ...authHeader(), ...(init.headers ?? {}) },
    });
}
