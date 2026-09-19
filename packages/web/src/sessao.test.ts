import { describe, expect, it } from 'vitest';
import { areasDe, destinosDe } from './sessao';

describe('areasDe', () => {
    it('deslogado só busca', () => {
        expect(areasDe(null)).toEqual(['buscar']);
    });

    it('cliente busca e vê os carros', () => {
        expect(areasDe('common_user')).toEqual(['buscar', 'meusCarros']);
    });

    it('dono busca e vê os pátios', () => {
        expect(areasDe('dono')).toEqual(['buscar', 'meusPatios']);
    });

    it('p_admin vê o mesmo que cliente', () => {
        expect(areasDe('p_admin')).toEqual(areasDe('common_user'));
    });

    it('tipo desconhecido cai no mínimo, não no máximo', () => {
        expect(areasDe('tipo_que_ainda_nao_existe')).toEqual(['buscar']);
    });

    it('nunca promete o pátio a quem não é dono', () => {
        for (const tipo of [null, 'common_user', 'p_admin', 'qualquer']) {
            expect(areasDe(tipo)).not.toContain('meusPatios');
        }
    });
});

describe('destinosDe', () => {
    it('leva o dono ao hub do editor', () => {
        expect(destinosDe('dono').map((destino) => destino.href)).toEqual([
            'index.html',
            'owner/estacionamentos.html',
        ]);
    });

    it('dá rótulo e ícone a cada área', () => {
        for (const destino of destinosDe('common_user')) {
            expect(destino.rotulo).not.toBe('');
            expect(destino.icone).not.toBe('');
        }
    });
});
