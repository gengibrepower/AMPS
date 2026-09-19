import { describe, expect, it } from 'vitest';
import { criarEstado } from '../estado';
import type { Estado } from '../estado';
import {
    atualizarVaga,
    editarPeso,
    numeroLivre,
    recalcularPeso,
    renomear,
} from './inspetor';
import { acharNo } from '../../graph/modelo';
import type { DadosDaVaga, Grafo } from '../../graph/tipos';

const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 't1', role: 'transit', position: { x: 10, y: 0 } },
        { id: 's1', role: 'candidate', position: { x: 4, y: 6 }, dimensions: { width: 2.5, length: 5 } },
        { id: 's2', role: 'candidate', position: { x: 8, y: 6 }, dimensions: { width: 2.5, length: 5 } },
    ],
    edges: [
        { from: 'e1', to: 't1', weight: 10 },
        { from: 't1', to: 'e1', weight: 10 },
    ],
};

const VAGAS: readonly DadosDaVaga[] = [
    { noId: 's1', numero: 'A-01', tipo: 'comum', rotacaoGraus: 0, sensor: 'esp32-01' },
    { noId: 's2', numero: 'A-02', tipo: 'pcd', rotacaoGraus: 180, sensor: null },
];

function comPatio(): Estado {
    const estado = criarEstado();
    estado.carregar({ grafo: GRAFO, vagas: VAGAS });
    return estado;
}

const daVaga = (estado: Estado, noId: string): DadosDaVaga | undefined =>
    estado.vagas().find((vaga) => vaga.noId === noId);

describe('renomear', () => {
    it('grava o rótulo e vira um passo do desfazer', () => {
        const estado = comPatio();
        expect(renomear(estado, 'e1', 'Portaria')).toBe(true);
        expect(acharNo(estado.grafo(), 'e1')?.label).toBe('Portaria');

        estado.desfazer();
        expect(acharNo(estado.grafo(), 'e1')?.label).toBeUndefined();
    });

    it('rótulo igual ao que já está não gasta desfazer', () => {
        const estado = comPatio();
        renomear(estado, 'e1', 'Portaria');
        expect(renomear(estado, 'e1', '  Portaria  ')).toBe(false);
    });

    it('ignora nó que não existe', () => {
        const estado = comPatio();
        expect(renomear(estado, 'fantasma', 'x')).toBe(false);
        expect(estado.podeDesfazer()).toBe(false);
    });
});

describe('numeroLivre', () => {
    it('o número da própria vaga continua livre para ela', () => {
        expect(numeroLivre(VAGAS, 's1', 'A-01')).toBe(true);
    });

    it('o número de outra vaga não está livre', () => {
        expect(numeroLivre(VAGAS, 's1', 'A-02')).toBe(false);
    });
});

describe('atualizarVaga', () => {
    it('troca número, tipo e rotação de uma vez', () => {
        const estado = comPatio();
        const nova: DadosDaVaga = {
            noId: 's1', numero: 'B-09', tipo: 'moto', rotacaoGraus: 45, sensor: 'esp32-01',
        };
        expect(atualizarVaga(estado, nova)).toBe(true);
        expect(daVaga(estado, 's1')).toEqual(nova);
    });

    // O PUT /vagas é upsert da linha inteira: vaga que volte sem sensor apaga
    // em silêncio o pareamento que já estava gravado.
    it('o sensor sobrevive à edição', () => {
        const estado = comPatio();
        atualizarVaga(estado, { ...VAGAS[0]!, numero: 'B-09' });
        expect(daVaga(estado, 's1')?.sensor).toBe('esp32-01');
    });

    it('recusa número que já é de outra vaga', () => {
        const estado = comPatio();
        expect(atualizarVaga(estado, { ...VAGAS[0]!, numero: 'A-02' })).toBe(false);
        expect(daVaga(estado, 's1')?.numero).toBe('A-01');
        expect(estado.podeDesfazer()).toBe(false);
    });

    it('não mexe na outra vaga', () => {
        const estado = comPatio();
        atualizarVaga(estado, { ...VAGAS[0]!, tipo: 'eletrico' });
        expect(daVaga(estado, 's2')).toEqual(VAGAS[1]);
    });

    // Nada troca sensor hoje, mas comparar só o que o inspetor edita deixaria
    // a troca passar por "nada mudou".
    it('troca de sensor conta como mudança', () => {
        const estado = comPatio();
        expect(atualizarVaga(estado, { ...VAGAS[0]!, sensor: 'esp32-09' })).toBe(true);
        expect(daVaga(estado, 's1')?.sensor).toBe('esp32-09');
    });

    it('edição que não muda nada não gasta desfazer', () => {
        const estado = comPatio();
        expect(atualizarVaga(estado, { ...VAGAS[0]! })).toBe(false);
        expect(estado.sujo()).toBe(false);
    });

    it('ignora vaga que não existe', () => {
        const estado = comPatio();
        expect(atualizarVaga(estado, { ...VAGAS[0]!, noId: 'fantasma' })).toBe(false);
    });

    it('desfazer devolve a vaga inteira como estava', () => {
        const estado = comPatio();
        atualizarVaga(estado, { ...VAGAS[0]!, numero: 'B-09', tipo: 'moto', rotacaoGraus: 45 });
        estado.desfazer();
        expect(daVaga(estado, 's1')).toEqual(VAGAS[0]);
    });
});

describe('editarPeso', () => {
    const peso = (estado: Estado): number | undefined =>
        estado.grafo().edges.find((a) => a.from === 'e1' && a.to === 't1')?.weight;

    it('grava o peso à mão', () => {
        const estado = comPatio();
        expect(editarPeso(estado, 'e1', 't1', 42.5)).toBe(true);
        expect(peso(estado)).toBe(42.5);
    });

    it('não deixa peso negativo nem NaN', () => {
        const estado = comPatio();
        expect(editarPeso(estado, 'e1', 't1', -1)).toBe(false);
        expect(editarPeso(estado, 'e1', 't1', Number.NaN)).toBe(false);
        expect(peso(estado)).toBe(10);
    });

    it('peso igual ao que já está não gasta desfazer', () => {
        const estado = comPatio();
        expect(editarPeso(estado, 'e1', 't1', 10)).toBe(false);
    });

    it('ignora aresta que não existe', () => {
        const estado = comPatio();
        expect(editarPeso(estado, 'e1', 's1', 5)).toBe(false);
    });
});

describe('recalcularPeso', () => {
    // Mover um nó não refaz o peso sozinho; este é o botão que o dono aperta.
    it('traz o peso de volta para a distância entre os nós', () => {
        const estado = comPatio();
        editarPeso(estado, 'e1', 't1', 99);

        expect(recalcularPeso(estado, 'e1', 't1')).toBe(true);
        expect(estado.grafo().edges.find((a) => a.from === 'e1' && a.to === 't1')?.weight).toBe(10);
    });

    it('não gasta desfazer quando o peso já é a distância', () => {
        const estado = comPatio();
        expect(recalcularPeso(estado, 'e1', 't1')).toBe(false);
    });

    it('ignora aresta que não existe', () => {
        const estado = comPatio();
        expect(recalcularPeso(estado, 'e1', 'fantasma')).toBe(false);
    });
});
