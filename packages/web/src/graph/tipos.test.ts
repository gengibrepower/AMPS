import { describe, expect, it } from 'vitest';
import { comoStatusDeVaga } from './tipos';

describe('comoStatusDeVaga', () => {
    it('aceita os três status do banco', () => {
        expect(comoStatusDeVaga('livre')).toBe('livre');
        expect(comoStatusDeVaga('ocupada')).toBe('ocupada');
        expect(comoStatusDeVaga('reservada')).toBe('reservada');
    });

    it('trata valor desconhecido como ocupada, para não prometer vaga livre', () => {
        expect(comoStatusDeVaga('ocupado')).toBe('ocupada');
        expect(comoStatusDeVaga('')).toBe('ocupada');
        expect(comoStatusDeVaga(null)).toBe('ocupada');
        expect(comoStatusDeVaga(undefined)).toBe('ocupada');
    });
});
