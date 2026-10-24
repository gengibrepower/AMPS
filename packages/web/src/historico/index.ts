import type { EstacionamentoWire } from '../api';

export interface ItemDoHistorico {
    readonly id: number;
    readonly nome: string;
    readonly local: string;
}

const STORAGE_KEY = 'amps:historico';
const LIMITE = 10;

function pareceItem(valor: unknown): valor is ItemDoHistorico {
    const item = valor as ItemDoHistorico | null;
    return (
        typeof item === 'object' && item !== null &&
        typeof item.id === 'number' &&
        typeof item.nome === 'string' &&
        typeof item.local === 'string'
    );
}

export function lerHistorico(): ItemDoHistorico[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
        const valor: unknown = JSON.parse(raw);
        return Array.isArray(valor) ? valor.filter(pareceItem) : [];
    } catch {
        return [];
    }
}

export function salvarHistorico(estacionamento: EstacionamentoWire): void {
    const { cidade, estado } = estacionamento.endereco;
    const novo: ItemDoHistorico = {
        id: estacionamento.id,
        nome: estacionamento.nome,
        local: [cidade, estado].filter(Boolean).join(' - '),
    };

    const outros = lerHistorico().filter((item) => item.id !== novo.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([novo, ...outros].slice(0, LIMITE)));
}
