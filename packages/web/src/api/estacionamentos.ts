import { pedir, pedirAutenticado } from './http';

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

export function editarEstacionamento(
    id: number,
    dados: DadosEstacionamento,
): Promise<EstacionamentoWire> {
    return pedirAutenticado<EstacionamentoWire>(`/estacionamentos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
    });
}

// 204 sem corpo; o 422 vem quando alguma vaga ainda está ocupada ou reservada.
export function excluirEstacionamento(id: number): Promise<null> {
    return pedirAutenticado<null>(`/estacionamentos/${id}`, { method: 'DELETE' });
}

export function pesquisarEstacionamentos(q: string): Promise<readonly EstacionamentoWire[]> {
    return pedir<readonly EstacionamentoWire[]>(`/busca?q=${encodeURIComponent(q)}`);
}
