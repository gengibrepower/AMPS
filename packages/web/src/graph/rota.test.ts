import { describe, expect, it } from 'vitest';
import { pontosDaRota } from './rota';
import type { Grafo } from './tipos';

// Rua reta de e1 a t2 no eixo y = 0; a vaga s1 fica ao norte, encostada nela
// entre os dois nós de via.
const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 't1', role: 'transit', position: { x: 10, y: 0 } },
        { id: 't2', role: 'transit', position: { x: 20, y: 0 } },
        { id: 's1', role: 'candidate', position: { x: 14, y: -6 }, dimensions: { width: 2.5, length: 5 } },
    ],
    edges: [
        { from: 'e1', to: 't1', weight: 10 },
        { from: 't1', to: 't2', weight: 10 },
        { from: 't1', to: 's1', weight: 10 },
    ],
};

describe('pontosDaRota', () => {
    it('na mão única corre pelo eixo e entra na vaga pela frente', () => {
        expect(pontosDaRota(GRAFO, ['e1', 't1', 's1'])).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 14, y: 0 },
            { x: 14, y: -3.5 },
        ]);
    });

    it('na mão dupla corre pela faixa da direita, nos dois sentidos', () => {
        const grafo: Grafo = {
            ...GRAFO,
            edges: [...GRAFO.edges, { from: 't1', to: 'e1', weight: 10 }],
        };

        expect(pontosDaRota(grafo, ['e1', 't1'])).toEqual([
            { x: 0, y: 1.6 },
            { x: 10, y: 1.6 },
        ]);
        expect(pontosDaRota(grafo, ['t1', 'e1'])).toEqual([
            { x: 10, y: -1.6 },
            { x: 0, y: -1.6 },
        ]);
    });

    it('dobra a esquina no cruzamento das duas faixas', () => {
        const grafo: Grafo = {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 10, y: 0 } },
                { id: 'c', role: 'transit', position: { x: 10, y: 10 } },
            ],
            edges: [
                { from: 'a', to: 'b', weight: 10 },
                { from: 'b', to: 'a', weight: 10 },
                { from: 'b', to: 'c', weight: 10 },
                { from: 'c', to: 'b', weight: 10 },
            ],
        };

        expect(pontosDaRota(grafo, ['a', 'b', 'c'])).toEqual([
            { x: 0, y: 1.6 },
            { x: 8.4, y: 1.6 },
            { x: 8.4, y: 10 },
        ]);
    });

    it('pula id que não está no grafo', () => {
        expect(pontosDaRota(GRAFO, ['e1', 'x9', 't1'])).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ]);
    });

    it('não repete ponto quando a vaga encosta exatamente num nó', () => {
        const grafo: Grafo = {
            ...GRAFO,
            nodes: GRAFO.nodes.map((no) =>
                no.id === 's1' ? { ...no, position: { x: 10, y: -6 } } : no,
            ),
        };

        expect(pontosDaRota(grafo, ['e1', 't1', 's1'])).toEqual([
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: -3.5 },
        ]);
    });
});
