import { describe, expect, it } from 'vitest';
import {
    ajusteParaCaixa,
    direcao,
    distancia,
    encaixar,
    encaixarNaTela,
    encaixarPonto,
    pontosAoLongo,
    projecaoNoSegmento,
    faixaVisivel,
    metrosParaPixels,
    pixelsParaMetros,
    recuoNaCaixa,
    segmento,
} from './geometria';

describe('conversão de unidade', () => {
    it('vai e volta sem perder o valor', () => {
        expect(pixelsParaMetros(metrosParaPixels(2.5))).toBe(2.5);
    });

    it('uma vaga de 2,5 m não vira 2,5 px', () => {
        expect(metrosParaPixels(2.5)).toBeGreaterThan(2.5);
    });
});

describe('faixaVisivel', () => {
    it('estica até o múltiplo do passo para fora dos dois lados', () => {
        expect(faixaVisivel(30, 100, 20, 5)).toEqual({ de: 0, ate: 10 });
    });

    it('funciona à esquerda da origem, onde o floor muda de sinal', () => {
        expect(faixaVisivel(-90, 100, 20, 5)).toEqual({ de: -5, ate: 5 });
    });

    it('devolve a faixa exata quando a borda cai no passo', () => {
        expect(faixaVisivel(0, 200, 20, 5)).toEqual({ de: 0, ate: 10 });
    });

    it('cobre menos metros quando o zoom aumenta', () => {
        const perto = faixaVisivel(0, 400, 80, 1);
        const longe = faixaVisivel(0, 400, 10, 1);
        expect(perto.ate).toBeLessThan(longe.ate);
    });
});

describe('segmento da aresta', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };

    it('recua as duas pontas para a seta encostar no nó', () => {
        expect(segmento(a, b, 2, 3, 0)).toEqual({ de: { x: 2, y: 0 }, para: { x: 7, y: 0 } });
    });

    it('joga a volta para o outro lado da ida', () => {
        const ida = segmento(a, b, 0, 0, 1);
        const volta = segmento(b, a, 0, 0, 1);
        expect(ida.de.y).toBe(-volta.de.y);
        expect(ida.de.y).not.toBe(0);
    });

    it('colapsa no meio quando os recuos comem o traço inteiro', () => {
        const curto = segmento(a, { x: 3, y: 0 }, 2, 2, 0);
        expect(curto.de).toEqual(curto.para);
        expect(curto.de).toEqual({ x: 1.5, y: 0 });
    });

    it('não quebra com os dois nós no mesmo ponto', () => {
        expect(segmento(a, a, 1, 1, 1)).toEqual({ de: a, para: a });
    });
});

describe('recuoNaCaixa', () => {
    // Vaga de 2,5 x 5 m: meia largura 1,25 e meio comprimento 2,5.
    it('para na lateral quando a aresta chega de lado', () => {
        expect(recuoNaCaixa(1.25, 2.5, { x: 1, y: 0 })).toBe(1.25);
    });

    it('para na frente quando a aresta chega pela ponta', () => {
        expect(recuoNaCaixa(1.25, 2.5, { x: 0, y: 1 })).toBe(2.5);
    });

    it('na diagonal usa a borda que aparece primeiro', () => {
        const meio = Math.SQRT1_2;
        expect(recuoNaCaixa(1.25, 2.5, { x: meio, y: meio })).toBeCloseTo(1.25 / meio, 6);
    });

    it('não quebra com direção nula', () => {
        expect(recuoNaCaixa(1.25, 2.5, { x: 0, y: 0 })).toBe(0);
    });
});

describe('direcao', () => {
    it('devolve vetor unitário', () => {
        expect(direcao({ x: 0, y: 0 }, { x: 0, y: 4 })).toEqual({ x: 0, y: 1 });
    });

    it('devolve zero para o mesmo ponto', () => {
        expect(direcao({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ x: 0, y: 0 });
    });
});

describe('ajusteParaCaixa', () => {
    const caixa = { minX: 0, minY: 0, maxX: 20, maxY: 10 };

    it('centraliza a caixa na tela', () => {
        const ajuste = ajusteParaCaixa(caixa, 1000, 600, 60, 0.2, 8);
        const centro = {
            x: metrosParaPixels(10) * ajuste.zoom + ajuste.x,
            y: metrosParaPixels(5) * ajuste.zoom + ajuste.y,
        };
        expect(centro).toEqual({ x: 500, y: 300 });
    });

    it('aperta o zoom até a caixa caber com margem', () => {
        const ajuste = ajusteParaCaixa(caixa, 300, 300, 20, 0.2, 8);
        expect(metrosParaPixels(20) * ajuste.zoom).toBeLessThanOrEqual(300 - 40);
    });

    it('respeita o teto de zoom com caixa minúscula', () => {
        const ponto = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
        expect(ajusteParaCaixa(ponto, 1000, 600, 60, 0.2, 8).zoom).toBe(1);
    });
});

describe('pontosAoLongo', () => {
    const de = { x: 0, y: 0 };

    it('espaça os pontos e sobra margem igual nas duas pontas', () => {
        const pontos = pontosAoLongo(de, { x: 10, y: 0 }, 4);
        expect(pontos).toEqual([{ x: 3, y: 0 }, { x: 7, y: 0 }]);
    });

    it('põe um ponto no meio quando o traço é mais curto que o passo', () => {
        expect(pontosAoLongo(de, { x: 3, y: 0 }, 4)).toEqual([{ x: 1.5, y: 0 }]);
    });

    it('acompanha a diagonal', () => {
        const pontos = pontosAoLongo(de, { x: 0, y: 8 }, 4);
        expect(pontos).toEqual([{ x: 0, y: 2 }, { x: 0, y: 6 }]);
    });

    it('não devolve nada para traço de comprimento zero', () => {
        expect(pontosAoLongo(de, de, 4)).toEqual([]);
    });
});

describe('projecaoNoSegmento', () => {
    const de = { x: 0, y: 0 };
    const para = { x: 10, y: 0 };

    it('cai perpendicular quando o ponto está ao lado do meio', () => {
        expect(projecaoNoSegmento({ x: 4, y: 7 }, de, para)).toEqual({ x: 4, y: 0 });
    });

    it('prende na ponta quando o ponto passa do fim', () => {
        expect(projecaoNoSegmento({ x: 30, y: 3 }, de, para)).toEqual({ x: 10, y: 0 });
    });

    it('prende no começo quando o ponto fica atrás', () => {
        expect(projecaoNoSegmento({ x: -5, y: 3 }, de, para)).toEqual({ x: 0, y: 0 });
    });

    it('devolve a própria ponta para segmento de comprimento zero', () => {
        expect(projecaoNoSegmento({ x: 2, y: 2 }, de, de)).toEqual(de);
    });
});

describe('encaixar', () => {
    it('leva ao metro mais perto', () => {
        expect(encaixar(7.4)).toBe(7);
        expect(encaixar(7.6)).toBe(8);
    });

    it('arredonda para longe do zero nos negativos, como no positivo', () => {
        expect(encaixar(-7.6)).toBe(-8);
    });

    it('aceita passo menor que o metro', () => {
        expect(encaixar(7.4, 0.5)).toBe(7.5);
    });

    it('não mexe no valor com passo inválido', () => {
        expect(encaixar(7.4, 0)).toBe(7.4);
    });

    it('encaixa os dois eixos do ponto', () => {
        expect(encaixarPonto({ x: 2.2, y: -0.7 })).toEqual({ x: 2, y: -1 });
    });
});

describe('distancia', () => {
    it('mede o triângulo 3-4-5', () => {
        expect(distancia({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
    });
});

describe('encaixarNaTela', () => {
    const origem = { x: 80, y: 80 };

    it('devolve a tela do metro inteiro mais perto', () => {
        // 1 m são 20 px; com zoom 2, 41 px além da origem é 1,025 m.
        expect(encaixarNaTela({ x: origem.x + 41, y: origem.y }, origem, 2)).toEqual({
            x: origem.x + 40,
            y: origem.y,
        });
    });

    it('encaixa em metro, não em pixel: o passo na tela acompanha o zoom', () => {
        const perto = encaixarNaTela({ x: origem.x + 141, y: origem.y }, origem, 4);
        const longe = encaixarNaTela({ x: origem.x + 141, y: origem.y }, origem, 1);
        expect(perto.x - origem.x).toBe(160);
        expect(longe.x - origem.x).toBe(140);
    });

    it('vale à esquerda da origem', () => {
        expect(encaixarNaTela({ x: origem.x - 41, y: origem.y }, origem, 2).x).toBe(origem.x - 40);
    });

    it('não divide por zero quando o palco ainda não tem escala', () => {
        const tela = { x: 5, y: 5 };
        expect(encaixarNaTela(tela, origem, 0)).toEqual(tela);
    });
});
