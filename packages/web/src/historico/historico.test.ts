import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstacionamentoWire } from '../api';
import { lerHistorico, salvarHistorico } from './index';

const CHAVE = 'amps:historico';

function gavetaEmMemoria(): Storage {
    const dados = new Map<string, string>();
    return {
        get length() { return dados.size; },
        clear: () => dados.clear(),
        getItem: (chave) => dados.get(chave) ?? null,
        key: (indice) => [...dados.keys()][indice] ?? null,
        removeItem: (chave) => { dados.delete(chave); },
        setItem: (chave, valor) => { dados.set(chave, valor); },
    };
}

const patio = (id: number, nome = `Pátio ${id}`): EstacionamentoWire => ({
    id,
    nome,
    publicado: true,
    endereco: {
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: 'Blumenau',
        estado: 'SC',
        cep: null,
    },
});

beforeEach(() => {
    vi.stubGlobal('localStorage', gavetaEmMemoria());
});

describe('lerHistorico', () => {
    it('devolve lista vazia quando nada foi gravado', () => {
        expect(lerHistorico()).toEqual([]);
    });

    it('devolve lista vazia quando o texto guardado não é JSON', () => {
        localStorage.setItem(CHAVE, '{quebrado');
        expect(lerHistorico()).toEqual([]);
    });

    it('devolve lista vazia quando o JSON não é uma lista', () => {
        localStorage.setItem(CHAVE, JSON.stringify({ id: 1 }));
        expect(lerHistorico()).toEqual([]);
    });

    it('descarta itens com formato errado e mantém os bons', () => {
        localStorage.setItem(CHAVE, JSON.stringify([
            { id: 1, nome: 'Bom', local: 'Blumenau - SC' },
            { id: '2', nome: 'Id em texto', local: '' },
            null,
        ]));
        expect(lerHistorico()).toEqual([{ id: 1, nome: 'Bom', local: 'Blumenau - SC' }]);
    });
});

describe('salvarHistorico', () => {
    it('grava id, nome e local, sem o resto do estacionamento', () => {
        salvarHistorico(patio(7, 'Pátio Centro'));
        expect(lerHistorico()).toEqual([{ id: 7, nome: 'Pátio Centro', local: 'Blumenau - SC' }]);
    });

    it('põe o mais recente no topo', () => {
        salvarHistorico(patio(1));
        salvarHistorico(patio(2));
        expect(lerHistorico().map((item) => item.id)).toEqual([2, 1]);
    });

    it('reabrir o mesmo pátio leva ele ao topo sem repetir', () => {
        salvarHistorico(patio(1));
        salvarHistorico(patio(2));
        salvarHistorico(patio(1));
        expect(lerHistorico().map((item) => item.id)).toEqual([1, 2]);
    });

    it('guarda só os 10 mais recentes', () => {
        for (let id = 1; id <= 12; id++) salvarHistorico(patio(id));
        const ids = lerHistorico().map((item) => item.id);
        expect(ids).toHaveLength(10);
        expect(ids[0]).toBe(12);
        expect(ids).not.toContain(1);
        expect(ids).not.toContain(2);
    });

    it('recomeça do zero quando o que estava guardado era lixo', () => {
        localStorage.setItem(CHAVE, 'lixo');
        salvarHistorico(patio(3));
        expect(lerHistorico().map((item) => item.id)).toEqual([3]);
    });
});
