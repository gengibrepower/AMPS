import { describe, expect, it } from 'vitest';
import { criarEstado } from '../estado';
import type { Estado } from '../estado';
import { apagarNo } from './apagar';
import { apagarAresta, ligar } from './aresta';
import { ferramentaDaTecla, papelDa } from './ferramentas';
import { criarNoEm, moverNoPara } from './no';
import { acharNo, rotacaoDaVaga } from '../../graph/modelo';
import type { Grafo } from '../../graph/tipos';

// Uma alameda de mão dupla no eixo x, com espaço para vaga dos dois lados.
const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 't1', role: 'transit', position: { x: 20, y: 0 } },
    ],
    edges: [
        { from: 'e1', to: 't1', weight: 20 },
        { from: 't1', to: 'e1', weight: 20 },
    ],
};

function comPatio(): Estado {
    const estado = criarEstado();
    estado.carregar({ grafo: GRAFO, vagas: [] });
    return estado;
}

describe('ferramentaDaTecla', () => {
    it('mapeia os atalhos do editor', () => {
        expect(ferramentaDaTecla('v')).toBe('selecionar');
        expect(ferramentaDaTecla('a')).toBe('aresta');
        expect(ferramentaDaTecla('1')).toBe('candidate');
        expect(ferramentaDaTecla('2')).toBe('source');
        expect(ferramentaDaTecla('3')).toBe('transit');
        expect(ferramentaDaTecla('4')).toBe('attractor');
    });

    it('aceita a maiúscula que o Shift manda', () => {
        expect(ferramentaDaTecla('V')).toBe('selecionar');
    });

    it('devolve null para tecla sem ferramenta', () => {
        expect(ferramentaDaTecla('q')).toBeNull();
    });

    it('só as ferramentas que criam nó têm papel', () => {
        expect(papelDa('selecionar')).toBeNull();
        expect(papelDa('aresta')).toBeNull();
        expect(papelDa('candidate')).toBe('candidate');
    });
});

describe('criarNoEm', () => {
    it('encaixa na grade de 1 m', () => {
        const estado = comPatio();
        const id = criarNoEm(estado, 'transit', { x: 7.4, y: -2.6 });
        expect(acharNo(estado.grafo(), id)?.position).toEqual({ x: 7, y: -3 });
    });

    // Sem isto a vaga nasce a 0° e deita no sentido errado, porque quem manda no
    // desenho é `vagas.rotacao_graus`, não a geometria.
    it('a vaga nasce já cadastrada, com a rotação da rua em que encosta', () => {
        const estado = comPatio();
        const id = criarNoEm(estado, 'candidate', { x: 8, y: 6 });

        const vaga = estado.vagas().find((cada) => cada.noId === id);
        expect(vaga).toBeDefined();
        expect(vaga?.rotacaoGraus).toBe(rotacaoDaVaga(estado.grafo(), acharNo(estado.grafo(), id)!));
    });

    it('vaga do outro lado da rua deita para o outro lado', () => {
        const estado = comPatio();
        const sul = criarNoEm(estado, 'candidate', { x: 8, y: 6 });
        const norte = criarNoEm(estado, 'candidate', { x: 8, y: -6 });

        const grau = (id: string): number | undefined =>
            estado.vagas().find((cada) => cada.noId === id)?.rotacaoGraus;
        expect(grau(sul)).toBe(0);
        expect(grau(norte)).toBe(180);
    });

    it('rua de pé deita a vaga de lado: a rotação não é sempre zero', () => {
        const estado = criarEstado();
        estado.carregar({
            grafo: {
                nodes: [
                    { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
                    { id: 't1', role: 'transit', position: { x: 0, y: 20 } },
                ],
                edges: [{ from: 'e1', to: 't1', weight: 20 }],
            },
            vagas: [],
        });

        const leste = criarNoEm(estado, 'candidate', { x: 6, y: 8 });
        expect(estado.vagas().find((cada) => cada.noId === leste)?.rotacaoGraus).toBe(270);
    });

    it('nó que não é vaga não ganha linha em vagas', () => {
        const estado = comPatio();
        criarNoEm(estado, 'transit', { x: 8, y: 6 });
        expect(estado.vagas()).toHaveLength(0);
    });

    it('cada vaga nova sai com um número livre', () => {
        const estado = comPatio();
        criarNoEm(estado, 'candidate', { x: 8, y: 6 });
        criarNoEm(estado, 'candidate', { x: 11, y: 6 });
        expect(estado.vagas().map((vaga) => vaga.numero)).toEqual(['1', '2']);
    });

    it('cada criação é um passo do desfazer', () => {
        const estado = comPatio();
        criarNoEm(estado, 'candidate', { x: 8, y: 6 });
        criarNoEm(estado, 'candidate', { x: 11, y: 6 });

        estado.desfazer();
        expect(estado.grafo().nodes).toHaveLength(3);
        expect(estado.vagas()).toHaveLength(1);

        estado.desfazer();
        expect(estado.grafo().nodes).toHaveLength(2);
        expect(estado.sujo()).toBe(false);
    });
});

describe('moverNoPara', () => {
    it('encaixa na grade e avisa que mexeu', () => {
        const estado = comPatio();
        expect(moverNoPara(estado, 't1', { x: 24.4, y: 0.4 })).toBe(true);
        expect(acharNo(estado.grafo(), 't1')?.position).toEqual({ x: 24, y: 0 });
    });

    // Arrasto que pousa no mesmo metro não é mudança: empilhar o instantâneo
    // ali gastaria um Ctrl+Z que não desfaz nada visível.
    it('arrasto que pousa no mesmo metro não vira passo de desfazer', () => {
        const estado = comPatio();
        expect(moverNoPara(estado, 't1', { x: 20.3, y: -0.2 })).toBe(false);
        expect(estado.podeDesfazer()).toBe(false);
        expect(estado.sujo()).toBe(false);
    });

    it('não mexe no peso das arestas', () => {
        const estado = comPatio();
        moverNoPara(estado, 't1', { x: 40, y: 0 });
        expect(estado.grafo().edges).toEqual(GRAFO.edges);
    });

    it('ignora id que não existe', () => {
        const estado = comPatio();
        expect(moverNoPara(estado, 'fantasma', { x: 1, y: 1 })).toBe(false);
    });
});

describe('apagarNo', () => {
    it('tira o nó, as arestas dele e a linha de vagas', () => {
        const estado = comPatio();
        const id = criarNoEm(estado, 'candidate', { x: 8, y: 6 });

        expect(apagarNo(estado, id)).toBe(true);
        expect(acharNo(estado.grafo(), id)).toBeNull();
        expect(estado.vagas()).toHaveLength(0);
    });

    it('não deixa aresta órfã para o trigger recusar', () => {
        const estado = comPatio();
        apagarNo(estado, 't1');

        const ids = new Set(estado.grafo().nodes.map((no) => no.id));
        expect(estado.grafo().edges.every((a) => ids.has(a.from) && ids.has(a.to))).toBe(true);
    });

    it('desfazer traz de volta o nó e a vaga juntos', () => {
        const estado = comPatio();
        const id = criarNoEm(estado, 'candidate', { x: 8, y: 6 });
        apagarNo(estado, id);
        estado.desfazer();

        expect(acharNo(estado.grafo(), id)).not.toBeNull();
        expect(estado.vagas().map((vaga) => vaga.noId)).toEqual([id]);
    });

    it('id que não existe não gasta um passo do desfazer', () => {
        const estado = comPatio();
        expect(apagarNo(estado, 'fantasma')).toBe(false);
        expect(estado.podeDesfazer()).toBe(false);
    });
});

describe('ligar', () => {
    // Um par de vias soltas, para a ferramenta ter o que ligar.
    function comVias(): Estado {
        const estado = criarEstado();
        estado.carregar({
            grafo: {
                nodes: [
                    { id: 't1', role: 'transit', position: { x: 0, y: 0 } },
                    { id: 't2', role: 'transit', position: { x: 10, y: 0 } },
                    { id: 't3', role: 'transit', position: { x: 20, y: 0 } },
                ],
                edges: [],
            },
            vagas: [],
        });
        return estado;
    }

    it('o primeiro clique só guarda a origem', () => {
        const estado = comVias();
        expect(ligar(estado, null, 't1')).toBe('t1');
        expect(estado.grafo().edges).toHaveLength(0);
        expect(estado.sujo()).toBe(false);
    });

    it('o segundo clique cria a rua de mão dupla', () => {
        const estado = comVias();
        ligar(estado, ligar(estado, null, 't1'), 't2');
        expect(estado.grafo().edges).toEqual([
            { from: 't1', to: 't2', weight: 10 },
            { from: 't2', to: 't1', weight: 10 },
        ]);
    });

    // É o que faz clicar t1, t2, t3 traçar a alameda inteira.
    it('encadeia: o destino vira a origem do clique seguinte', () => {
        const estado = comVias();
        let origem = ligar(estado, null, 't1');
        origem = ligar(estado, origem, 't2');
        origem = ligar(estado, origem, 't3');

        expect(origem).toBe('t3');
        expect(estado.grafo().edges).toHaveLength(4);
        expect(estado.grafo().edges.some((a) => a.from === 't2' && a.to === 't3')).toBe(true);
    });

    it('cada trecho é um passo do desfazer', () => {
        const estado = comVias();
        const origem = ligar(estado, ligar(estado, null, 't1'), 't2');
        ligar(estado, origem, 't3');

        estado.desfazer();
        expect(estado.grafo().edges).toHaveLength(2);
        estado.desfazer();
        expect(estado.grafo().edges).toHaveLength(0);
        expect(estado.sujo()).toBe(false);
    });

    it('clicar duas vezes no mesmo nó não cria laço nem gasta desfazer', () => {
        const estado = comVias();
        expect(ligar(estado, 't1', 't1')).toBe('t1');
        expect(estado.podeDesfazer()).toBe(false);
    });

    it('repetir uma ligação que já existe não gasta desfazer', () => {
        const estado = comVias();
        ligar(estado, ligar(estado, null, 't1'), 't2');
        ligar(estado, 't1', 't2');
        expect(estado.grafo().edges).toHaveLength(2);
    });

    it('ligar via a vaga cria só o acesso, de mão única', () => {
        const estado = comPatio();
        const vaga = criarNoEm(estado, 'candidate', { x: 8, y: 6 });
        ligar(estado, 't1', vaga);

        const novas = estado.grafo().edges.filter((a) => a.from === vaga || a.to === vaga);
        expect(novas).toEqual([{ from: 't1', to: vaga, weight: expect.any(Number) }]);
    });
});

describe('apagarAresta', () => {
    it('tira um sentido e deixa a rua de mão única', () => {
        const estado = comPatio();
        expect(apagarAresta(estado, 't1', 'e1')).toBe(true);
        expect(estado.grafo().edges).toEqual([{ from: 'e1', to: 't1', weight: 20 }]);
    });

    it('desfazer devolve o sentido apagado', () => {
        const estado = comPatio();
        apagarAresta(estado, 't1', 'e1');
        estado.desfazer();
        expect(estado.grafo().edges).toEqual(GRAFO.edges);
    });

    it('aresta que não existe não gasta um passo do desfazer', () => {
        const estado = comPatio();
        expect(apagarAresta(estado, 'e1', 'fantasma')).toBe(false);
        expect(estado.podeDesfazer()).toBe(false);
    });
});
