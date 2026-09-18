import { authHeader } from './auth';

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3001';

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

function pedirAutenticado<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    return pedir<T>(caminho, {
        ...init,
        headers: { ...authHeader(), ...(init.headers ?? {}) },
    });
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

export interface EnderecoWire {
    readonly cep: string | null;
    readonly logradouro: string | null;
    readonly numero: string | null;
    readonly bairro: string | null;
    readonly complemento: string | null;
    readonly cidade: string | null;
    readonly estado: string | null;
}

export interface EstacionamentoWire {
    readonly id: number;
    readonly nome: string;
    readonly publicado: boolean;
    readonly endereco: EnderecoWire;
}

// Campo vazio é o mesmo que ausente para a API, que grava null.
export interface DadosEstacionamento {
    readonly nome: string;
    readonly cep: string;
    readonly logradouro: string;
    readonly numero: string;
    readonly bairro: string;
    readonly complemento: string;
    readonly cidade: string;
    readonly estado: string;
}

export function listarEstacionamentos(): Promise<readonly EstacionamentoWire[]> {
    return pedirAutenticado<readonly EstacionamentoWire[]>('/estacionamentos');
}

export function criarEstacionamento(dados: DadosEstacionamento): Promise<EstacionamentoWire> {
    return pedirAutenticado<EstacionamentoWire>('/estacionamentos', {
        method: 'POST',
        body: JSON.stringify(dados),
    });
}
