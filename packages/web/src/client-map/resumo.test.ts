import { describe, expect, it } from 'vitest';
import { pontosDeInteresse, vagasLivres, vagasPorTipo } from './resumo';
import type { Grafo } from '../graph/tipos';

describe('vagasPorTipo', () => {
    it('conta por tipo na ordem fixa, sem os tipos ausentes', () => {
        const vagas = [{ tipo: 'pcd' }, { tipo: 'comum' }, { tipo: 'comum' }, { tipo: 'moto' }];

        expect(vagasPorTipo(vagas)).toEqual([
            { tipo: 'comum', quantidade: 2 },
            { tipo: 'pcd', quantidade: 1 },
            { tipo: 'moto', quantidade: 1 },
        ]);
    });

    it('trata tipo desconhecido como comum, igual ao desenho', () => {
        expect(vagasPorTipo([{ tipo: 'vip' }])).toEqual([{ tipo: 'comum', quantidade: 1 }]);
    });

    it('devolve lista vazia sem vagas', () => {
        expect(vagasPorTipo([])).toEqual([]);
    });
});

describe('pontosDeInteresse', () => {
    const grafo: Grafo = {
        nodes: [
            { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
            { id: 'p1', role: 'attractor', label: 'Entrada do shopping', position: { x: 4, y: 0 } },
            { id: 'p2', role: 'attractor', label: '   ', position: { x: 8, y: 0 } },
            { id: 'p3', role: 'attractor', position: { x: 9, y: 0 } },
        ],
        edges: [],
    };

    it('lista só os POIs, com o rótulo do dono', () => {
        expect(pontosDeInteresse(grafo)[0]).toBe('Entrada do shopping');
    });

    it('dá nome a POI sem rótulo ou com rótulo em branco', () => {
        expect(pontosDeInteresse(grafo).slice(1)).toEqual(['Ponto sem nome', 'Ponto sem nome']);
    });
});

describe('vagasLivres', () => {
    it('conta só as livres, deixando ocupada e reservada de fora', () => {
        const vagas = [
            { status: 'livre' },
            { status: 'ocupada' },
            { status: 'livre' },
            { status: 'reservada' },
        ];

        expect(vagasLivres(vagas)).toBe(2);
    });

    it('não conta status desconhecido como livre', () => {
        expect(vagasLivres([{ status: 'livr' }, { status: '' }])).toBe(0);
    });

    it('devolve zero sem vagas', () => {
        expect(vagasLivres([])).toBe(0);
    });
});
