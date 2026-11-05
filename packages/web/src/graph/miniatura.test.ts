import { describe, expect, it } from 'vitest';
import { desenharMiniatura } from './miniatura';
import { FUNDO_POR_TIPO, OCUPADA_FUNDO } from './render/tinta';
import { GRAFO_VAZIO } from './tipos';
import type { DadosDaVaga, Grafo } from './tipos';

const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 't1', role: 'transit', position: { x: 10, y: 0 } },
        { id: 'p1', role: 'attractor', position: { x: 20, y: 0 } },
        { id: 's1', role: 'candidate', position: { x: 4, y: -6 }, dimensions: { width: 2.5, length: 5 } },
        { id: 's2', role: 'candidate', position: { x: 7, y: -6 }, dimensions: { width: 2.5, length: 5 } },
    ],
    edges: [
        { from: 'e1', to: 't1', weight: 10 },
        { from: 't1', to: 'e1', weight: 10 },
        { from: 't1', to: 'p1', weight: 10 },
        { from: 't1', to: 's1', weight: 6 },
        { from: 't1', to: 's2', weight: 6 },
    ],
};

const VAGAS: readonly DadosDaVaga[] = [
    { noId: 's1', numero: 'A-01', tipo: 'pcd', rotacaoGraus: 0, sensor: null, status: 'livre' },
    { noId: 's2', numero: 'A-02', tipo: 'comum', rotacaoGraus: 0, sensor: null, status: 'ocupada' },
];

function contar(svg: string, padrao: RegExp): number {
    return svg.match(padrao)?.length ?? 0;
}

describe('desenharMiniatura', () => {
    it('sem nó não há o que desenhar', () => {
        expect(desenharMiniatura(GRAFO_VAZIO, [])).toBeNull();
    });

    it('desenha cada corredor uma vez, mesmo na mão dupla, e ignora o acesso à vaga', () => {
        const svg = desenharMiniatura(GRAFO, VAGAS)!;
        expect(contar(svg, /<line /g)).toBe(2);
        expect(svg).toContain('stroke-width="6.4"');
        expect(svg).toContain('stroke-width="3.2"');
    });

    it('pinta a vaga pelo tipo e a ocupada por cima do tipo', () => {
        const svg = desenharMiniatura(GRAFO, VAGAS)!;
        expect(contar(svg, /<rect [^>]*transform=/g)).toBe(2);
        expect(svg).toContain(`fill="${FUNDO_POR_TIPO['pcd']}"`);
        expect(svg).toContain(`fill="${OCUPADA_FUNDO}"`);
    });

    it('marca entrada e ponto de interesse, e não escreve rótulo nenhum', () => {
        const svg = desenharMiniatura(GRAFO, VAGAS)!;
        expect(contar(svg, /<circle /g)).toBe(2);
        expect(svg).not.toContain('A-01');
        expect(svg).not.toContain('<text');
    });

    it('mostra o pátio inteiro, sem cortar a borda', () => {
        expect(desenharMiniatura(GRAFO, VAGAS)).toContain('preserveAspectRatio="xMidYMid meet"');
    });
});
