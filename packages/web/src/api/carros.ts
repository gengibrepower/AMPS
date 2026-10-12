import { pedir, pedirAutenticado } from './http';

export interface ModeloWire {
    readonly id: number;
    readonly marca: string;
    readonly nome: string;
}

export function listarModelos(): Promise<readonly ModeloWire[]> {
    return pedir<readonly ModeloWire[]>('/modelos');
}

export interface CarroWire {
    readonly id: number;
    readonly placa: string;
    readonly modelo_id: number;
    readonly proprietario: string;
}

export function cadastrarCarro(placa: string, modeloId: number): Promise<CarroWire> {
    return pedirAutenticado<CarroWire>('/carros', {
        method: 'POST',
        body: JSON.stringify({ placa, modelo_id: modeloId }),
    });
}

export function listarCarros(): Promise<readonly CarroWire[]> {
    return pedirAutenticado<readonly CarroWire[]>('/carros');
}

export function excluirCarro(id: number): Promise<void> {
    return pedirAutenticado<void>(`/carros/${id}`, {
        method: 'DELETE',
    });
}
