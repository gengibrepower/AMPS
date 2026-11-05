import { describe, expect, it } from 'vitest';
import type { DadosDaVaga } from '../tipos';
import { fundoDaVaga, numeroDaVaga } from './nos';
import {
    FUNDO_POR_TIPO,
    NUMERO_DA_VAGA,
    NUMERO_DA_VAGA_OCUPADA,
    OCUPADA_FUNDO,
    VAGA_FUNDO,
} from './tinta';

const vaga = (extra: Partial<DadosDaVaga> = {}): DadosDaVaga => ({
    noId: 'v1',
    numero: 'A-01',
    tipo: 'comum',
    rotacaoGraus: 0,
    sensor: null,
    ...extra,
});

describe('fundoDaVaga', () => {
    it('pinta ocupada e reservada com a cor de indisponível', () => {
        expect(fundoDaVaga(vaga({ status: 'ocupada' }))).toBe(OCUPADA_FUNDO);
        expect(fundoDaVaga(vaga({ status: 'reservada' }))).toBe(OCUPADA_FUNDO);
    });

    it('deixa a vaga livre com a cor do tipo', () => {
        expect(fundoDaVaga(vaga({ status: 'livre' }))).toBe(VAGA_FUNDO);
        expect(fundoDaVaga(vaga({ status: 'livre', tipo: 'pcd' }))).toBe(FUNDO_POR_TIPO.pcd);
    });

    it('deixa a vaga do editor, que não tem status, com a cor do tipo', () => {
        expect(fundoDaVaga(vaga())).toBe(VAGA_FUNDO);
        expect(fundoDaVaga(vaga({ tipo: 'idoso' }))).toBe(FUNDO_POR_TIPO.idoso);
    });

    it('dá prioridade ao status sobre o tipo', () => {
        expect(fundoDaVaga(vaga({ status: 'ocupada', tipo: 'pcd' }))).toBe(OCUPADA_FUNDO);
    });
});

describe('numeroDaVaga', () => {
    it('clareia o número sobre a vaga ocupada ou reservada, que é preta', () => {
        expect(numeroDaVaga(vaga({ status: 'ocupada' }))).toBe(NUMERO_DA_VAGA_OCUPADA);
        expect(numeroDaVaga(vaga({ status: 'reservada' }))).toBe(NUMERO_DA_VAGA_OCUPADA);
    });

    it('mantém o número escuro na vaga livre e na do editor', () => {
        expect(numeroDaVaga(vaga({ status: 'livre', tipo: 'pcd' }))).toBe(NUMERO_DA_VAGA);
        expect(numeroDaVaga(vaga())).toBe(NUMERO_DA_VAGA);
    });
});
