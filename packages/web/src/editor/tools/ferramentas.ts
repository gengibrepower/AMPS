import type { Papel } from '../../graph/tipos';

// A ferramenta aponta, liga dois nós, ou arma a criação de um papel de nó.
// Guardar o papel como a própria ferramenta evita um segundo mapa entre atalho
// e tipo.
export type Ferramenta = 'selecionar' | 'aresta' | Papel;

const POR_TECLA: Record<string, Ferramenta> = {
    v: 'selecionar',
    a: 'aresta',
    '1': 'candidate',
    '2': 'source',
    '3': 'transit',
    '4': 'attractor',
};

export function ferramentaDaTecla(tecla: string): Ferramenta | null {
    return POR_TECLA[tecla.toLowerCase()] ?? null;
}

export function papelDa(ferramenta: Ferramenta): Papel | null {
    return ferramenta === 'selecionar' || ferramenta === 'aresta' ? null : ferramenta;
}
