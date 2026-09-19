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

export function buscarEstacionamento(id: number): Promise<EstacionamentoWire> {
    return pedirAutenticado<EstacionamentoWire>(`/estacionamentos/${id}`);
}

export function criarEstacionamento(dados: DadosEstacionamento): Promise<EstacionamentoWire> {
    return pedirAutenticado<EstacionamentoWire>('/estacionamentos', {
        method: 'POST',
        body: JSON.stringify(dados),
    });
}

export interface VagaWire {
    readonly id: number;
    readonly no_id: string;
    readonly numero: string;
    readonly tipo: string;
    readonly rotacao_graus: number;
    readonly sensor: string | null;
    readonly status: string;
    readonly carro_id: number | null;
}

// O grafo vem como está no banco, na forma que o Merlian aceita: a API não
// transforma nada, e o front também não deve.
export interface MapaWire {
    readonly versao: number;
    readonly grafo: unknown;
    readonly vagas: readonly VagaWire[];
}

export function carregarMapa(estacionamentoId: number): Promise<MapaWire> {
    return pedirAutenticado<MapaWire>(`/estacionamentos/${estacionamentoId}/mapa`);
}

// O corpo do PUT de topologia **é** o grafo, na mesma forma que vai para o
// Merlian: nada de envelope.
export interface TopologiaResposta {
    readonly estacionamento_id: number;
    readonly versao: number;
}

export function gravarTopologia(
    estacionamentoId: number,
    grafo: unknown,
): Promise<TopologiaResposta> {
    return pedirAutenticado<TopologiaResposta>(`/estacionamentos/${estacionamentoId}/topologia`, {
        method: 'PUT',
        body: JSON.stringify(grafo),
    });
}

export interface VagaParaGravar {
    readonly no_id: string;
    readonly numero: string;
    readonly tipo: string;
    readonly rotacao_graus: number;
    readonly sensor: string | null;
}

export function gravarVagas(
    estacionamentoId: number,
    vagas: readonly VagaParaGravar[],
): Promise<readonly VagaWire[]> {
    return pedirAutenticado<readonly VagaWire[]>(`/estacionamentos/${estacionamentoId}/vagas`, {
        method: 'PUT',
        body: JSON.stringify(vagas),
    });
}

// 204 sem corpo; o 422 vem quando a vaga não está livre. O `no_id` é escapado
// porque nada garante que ele seja seguro numa URL: os que o editor gera são,
// mas pátio importado traz o id que quiser.
export function apagarVaga(estacionamentoId: number, noId: string): Promise<null> {
    const caminho = `/estacionamentos/${estacionamentoId}/vagas/${encodeURIComponent(noId)}`;
    return pedirAutenticado<null>(caminho, { method: 'DELETE' });
}
