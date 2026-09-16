const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

export interface UsuarioWire {
    readonly id: number;
    readonly nome: string;
    readonly email: string;
    readonly tipo_conta: string;
}

export interface LoginResposta {
    readonly token: string;
    readonly usuario: UsuarioWire;
}

export class ApiError extends Error {
    constructor(readonly status: number, mensagem: string) {
        super(mensagem);
        this.name = 'ApiError';
    }
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
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
        const erro = (corpo as { erro?: string } | null)?.erro;
        throw new ApiError(resposta.status, erro ?? `Erro ${resposta.status}.`);
    }
    return corpo as T;
}

export interface CadastroCliente {
    readonly nome: string;
    readonly email: string;
    readonly cpf: string;
    readonly senha: string;
}

export function login(email: string, senha: string): Promise<LoginResposta> {
    return pedir<LoginResposta>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
    });
}

export function cadastrarCliente(dados: CadastroCliente): Promise<UsuarioWire> {
    return pedir<UsuarioWire>('/usuarios', {
        method: 'POST',
        body: JSON.stringify(dados),
    });
}
