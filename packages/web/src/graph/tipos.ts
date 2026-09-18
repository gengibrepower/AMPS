import type { Ponto } from './geometria';

// As chaves são em inglês de propósito: este objeto vai para o Merlian como
// está, e qualquer chave a mais reprova a requisição inteira.
export type Papel = 'candidate' | 'source' | 'transit' | 'attractor';

export interface Dimensoes {
    readonly width: number;
    readonly length: number;
}

interface NoBase {
    readonly id: string;
    readonly position: Ponto;
    readonly label?: string;
}

// Só a vaga leva dimensions, como no discriminatedUnion do Merlian: assim
// "candidate sem dimensions" não chega a existir como valor.
export interface NoVaga extends NoBase {
    readonly role: 'candidate';
    readonly dimensions: Dimensoes;
}

export interface NoEntrada extends NoBase {
    readonly role: 'source';
}

export interface NoVia extends NoBase {
    readonly role: 'transit';
}

export interface NoPoi extends NoBase {
    readonly role: 'attractor';
}

export type No = NoVaga | NoEntrada | NoVia | NoPoi;

export interface Aresta {
    readonly from: string;
    readonly to: string;
    readonly weight: number;
}

export interface Grafo {
    readonly nodes: readonly No[];
    readonly edges: readonly Aresta[];
}

export const GRAFO_VAZIO: Grafo = { nodes: [], edges: [] };

// O banco garante a forma com JSON_SCHEMA_VALID; aqui só protege contra pátio
// sem topologia e contra JSON que não veio da nossa API.
export function comoGrafo(valor: unknown): Grafo {
    const bruto = valor as { nodes?: unknown; edges?: unknown } | null;
    if (bruto === null || typeof bruto !== 'object') return GRAFO_VAZIO;
    return {
        nodes: Array.isArray(bruto.nodes) ? (bruto.nodes as readonly No[]) : [],
        edges: Array.isArray(bruto.edges) ? (bruto.edges as readonly Aresta[]) : [],
    };
}
