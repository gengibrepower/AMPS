import { describe, expect, it } from 'vitest';
import {
    acharNo,
    anguloDaVaga,
    anguloDeDesenho,
    caixaDoGrafo,
    chaveDaAresta,
    docaDaVaga,
    temInversa,
} from './modelo';
import type { DadosDaVaga, Grafo, No } from './tipos';

const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 's1', role: 'candidate', position: { x: 5, y: 0 }, dimensions: { width: 2.5, length: 5 } },
        { id: 't1', role: 'transit', position: { x: 2, y: 3 } },
    ],
    edges: [
        { from: 'e1', to: 't1', weight: 3.6 },
        { from: 't1', to: 'e1', weight: 3.6 },
        { from: 't1', to: 's1', weight: 4.2 },
    ],
};

describe('acharNo', () => {
    it('acha pelo id', () => {
        expect(acharNo(GRAFO, 's1')?.role).toBe('candidate');
    });

    it('devolve null para id que não existe', () => {
        expect(acharNo(GRAFO, 'fantasma')).toBeNull();
    });
});

describe('temInversa', () => {
    it('reconhece o par de mão dupla', () => {
        expect(temInversa(GRAFO, { from: 'e1', to: 't1', weight: 3.6 })).toBe(true);
    });

    it('nega quando a volta não existe', () => {
        expect(temInversa(GRAFO, { from: 't1', to: 's1', weight: 4.2 })).toBe(false);
    });
});

describe('chaveDaAresta', () => {
    it('distingue ida de volta', () => {
        const ida = chaveDaAresta({ from: 'a', to: 'b', weight: 1 });
        const volta = chaveDaAresta({ from: 'b', to: 'a', weight: 1 });
        expect(ida).not.toBe(volta);
    });
});

describe('caixaDoGrafo', () => {
    it('inclui a extensão da vaga, não só o centro dela', () => {
        expect(caixaDoGrafo(GRAFO)).toEqual({ minX: -1, minY: -2.5, maxX: 6.25, maxY: 4 });
    });

    it('devolve null para grafo vazio', () => {
        expect(caixaDoGrafo({ nodes: [], edges: [] })).toBeNull();
    });
});

describe('anguloDaVaga', () => {
    const vaga = (x: number, y: number): No => ({
        id: 'v',
        role: 'candidate',
        position: { x, y },
        dimensions: { width: 2.5, length: 5 },
    });

    // Rua horizontal de a até b, com a vaga pendurada em b.
    function comRuaHorizontal(posicao: No): Grafo {
        return {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 10, y: 0 } },
                posicao,
            ],
            edges: [
                { from: 'a', to: 'b', weight: 10 },
                { from: 'b', to: posicao.id, weight: 5 },
            ],
        };
    }

    const graus = (radianos: number | null): number | null =>
        radianos === null ? null : Math.round((radianos * 180) / Math.PI);

    it('deita a vaga perpendicular à rua quando ela está abaixo', () => {
        expect(graus(anguloDaVaga(comRuaHorizontal(vaga(5, 6)), vaga(5, 6)))).toBe(0);
    });

    it('vira a vaga do outro lado quando ela está acima da rua', () => {
        expect(Math.abs(graus(anguloDaVaga(comRuaHorizontal(vaga(5, -6)), vaga(5, -6))) ?? 0))
            .toBe(180);
    });

    it('inclina quando a vaga passa do fim da rua e ancora na quina', () => {
        expect(graus(anguloDaVaga(comRuaHorizontal(vaga(14, 6)), vaga(14, 6)))).toBe(-34);
    });

    it('acompanha rua vertical', () => {
        const grafo: Grafo = {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 0, y: 10 } },
                vaga(6, 8),
            ],
            edges: [
                { from: 'a', to: 'b', weight: 10 },
                { from: 'b', to: 'v', weight: 6 },
            ],
        };
        expect(graus(anguloDaVaga(grafo, vaga(6, 8)))).toBe(-90);
    });

    it('ignora o quanto a vaga está adiantada ao longo da rua', () => {
        const atras = anguloDaVaga(comRuaHorizontal(vaga(3, 6)), vaga(3, 6));
        const adiante = anguloDaVaga(comRuaHorizontal(vaga(8, 6)), vaga(8, 6));
        expect(graus(atras)).toBe(graus(adiante));
    });

    it('devolve null para vaga sem acesso', () => {
        const solta: Grafo = { nodes: [vaga(1, 1)], edges: [] };
        expect(anguloDaVaga(solta, vaga(1, 1))).toBeNull();
    });
});

describe('caixaDoGrafo com folga', () => {
    it('a folga alarga os nós que não são vaga', () => {
        const apertada = caixaDoGrafo(GRAFO, 1);
        const larga = caixaDoGrafo(GRAFO, 3.5);
        expect(larga?.minX).toBeLessThan(apertada?.minX ?? 0);
    });
});

describe('docaDaVaga', () => {
    const vaga = (x: number, y: number): No => ({
        id: 'v',
        role: 'candidate',
        position: { x, y },
        dimensions: { width: 2.5, length: 5 },
    });

    // Duas ruas paralelas: uma de mão dupla em y=0 e uma de mão única em y=20.
    function comDuasRuas(posicao: No): Grafo {
        return {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 30, y: 0 } },
                { id: 'c', role: 'transit', position: { x: 0, y: 20 } },
                { id: 'd', role: 'transit', position: { x: 30, y: 20 } },
                posicao,
            ],
            edges: [
                { from: 'a', to: 'b', weight: 30 },
                { from: 'b', to: 'a', weight: 30 },
                { from: 'c', to: 'd', weight: 30 },
                { from: 'a', to: posicao.id, weight: 6 },
            ],
        };
    }

    it('encosta na rua mais próxima, não na do nó que liga a vaga', () => {
        const longe = vaga(15, 17);
        expect(docaDaVaga(comDuasRuas(longe), longe)?.ponto).toEqual({ x: 15, y: 20 });
    });

    it('aponta do meio-fio para a vaga', () => {
        const abaixo = vaga(15, 6);
        expect(docaDaVaga(comDuasRuas(abaixo), abaixo)?.paraFora).toEqual({ x: 0, y: 1 });
    });

    it('sabe quando a rua é de mão dupla', () => {
        const naDupla = vaga(15, 6);
        const naUnica = vaga(15, 17);
        expect(docaDaVaga(comDuasRuas(naDupla), naDupla)?.maoDupla).toBe(true);
        expect(docaDaVaga(comDuasRuas(naUnica), naUnica)?.maoDupla).toBe(false);
    });

    it('prende na ponta quando a vaga passa do fim da rua', () => {
        const passada = vaga(40, 6);
        expect(docaDaVaga(comDuasRuas(passada), passada)?.ponto).toEqual({ x: 30, y: 0 });
    });

    it('devolve null quando não há rua nenhuma', () => {
        const solta = vaga(1, 1);
        expect(docaDaVaga({ nodes: [solta], edges: [] }, solta)).toBeNull();
    });
});

describe('anguloDeDesenho', () => {
    const posicao: No = {
        id: 'v',
        role: 'candidate',
        position: { x: 5, y: 6 },
        dimensions: { width: 2.5, length: 5 },
    };

    const comRua: Grafo = {
        nodes: [
            { id: 'a', role: 'source', position: { x: 0, y: 0 } },
            { id: 'b', role: 'transit', position: { x: 10, y: 0 } },
            posicao,
        ],
        edges: [
            { from: 'a', to: 'b', weight: 10 },
            { from: 'b', to: 'v', weight: 6 },
        ],
    };

    const cadastrada = (rotacaoGraus: number): DadosDaVaga => ({
        noId: 'v',
        numero: 'A-01',
        tipo: 'comum',
        rotacaoGraus,
    });

    it('a rotação do banco manda quando a vaga está cadastrada', () => {
        expect(anguloDeDesenho(comRua, posicao, cadastrada(45))).toBeCloseTo(Math.PI / 4, 6);
    });

    it('zero no banco é zero, não é "deduza"', () => {
        expect(anguloDeDesenho(comRua, posicao, cadastrada(0))).toBe(0);
    });

    it('deduz pela rua enquanto a vaga não foi cadastrada', () => {
        expect(anguloDeDesenho(comRua, posicao, undefined)).toBe(anguloDaVaga(comRua, posicao));
    });

    it('cai em zero quando não há vaga cadastrada nem rua', () => {
        const solta: Grafo = { nodes: [posicao], edges: [] };
        expect(anguloDeDesenho(solta, posicao, undefined)).toBe(0);
    });
});
