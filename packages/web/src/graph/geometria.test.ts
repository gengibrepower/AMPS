import { describe, expect, it } from 'vitest';
import { faixaVisivel, metrosParaPixels, pixelsParaMetros } from './geometria';

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
