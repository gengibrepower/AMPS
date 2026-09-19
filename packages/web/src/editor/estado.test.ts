import { describe, expect, it } from 'vitest';
import { criarEstado } from './estado';
import type { Instantaneo } from './estado';
import type { Grafo } from '../graph/tipos';

const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 't1', role: 'transit', position: { x: 5, y: 0 } },
    ],
    edges: [{ from: 'e1', to: 't1', weight: 5 }],
};

const DO_SERVIDOR: Instantaneo = { grafo: GRAFO, vagas: [] };

function comVia(x: number): Instantaneo {
    return {
        grafo: {
            nodes: [...GRAFO.nodes, { id: 't2', role: 'transit', position: { x, y: 0 } }],
            edges: GRAFO.edges,
        },
        vagas: [],
    };
}

describe('carregar', () => {
    it('começa limpo e sem nada para desfazer', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        expect(estado.sujo()).toBe(false);
        expect(estado.podeDesfazer()).toBe(false);
        expect(estado.grafo()).toBe(GRAFO);
    });

    it('recarregar joga fora o que havia para desfazer', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        estado.mudar(comVia(9));
        estado.carregar(DO_SERVIDOR);
        expect(estado.podeDesfazer()).toBe(false);
        expect(estado.sujo()).toBe(false);
    });
});

describe('mudar e desfazer', () => {
    it('desfazer devolve o instantâneo anterior', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        estado.mudar(comVia(9));
        expect(estado.grafo().nodes).toHaveLength(3);

        expect(estado.desfazer()).toBe(true);
        expect(estado.grafo().nodes).toHaveLength(2);
    });

    it('volta passo a passo, na ordem inversa', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        estado.mudar(comVia(9));
        estado.mudar(comVia(20));

        estado.desfazer();
        expect(estado.grafo().nodes[2]?.position.x).toBe(9);
        estado.desfazer();
        expect(estado.grafo().nodes).toHaveLength(2);
    });

    it('desfazer no fundo da pilha não faz nada e avisa', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        expect(estado.desfazer()).toBe(false);
        expect(estado.grafo()).toBe(GRAFO);
    });

    // Sem a cópia, desfazer devolveria o mesmo objeto que a ferramenta mexeu.
    it('o instantâneo guardado é uma cópia, não o objeto vivo', () => {
        const estado = criarEstado();
        const mutavel = { grafo: structuredClone(GRAFO), vagas: [] };
        estado.carregar(mutavel);
        estado.mudar(comVia(9));

        (mutavel.grafo.nodes[0] as { id: string }).id = 'estragado';
        estado.desfazer();
        expect(estado.grafo().nodes[0]?.id).toBe('e1');
    });
});

describe('sujo', () => {
    it('fica sujo na primeira mudança', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        estado.mudar(comVia(9));
        expect(estado.sujo()).toBe(true);
    });

    it('desfazer tudo limpa: pilha vazia é o que o servidor mandou', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        estado.mudar(comVia(9));
        estado.mudar(comVia(20));
        estado.desfazer();
        expect(estado.sujo()).toBe(true);
        estado.desfazer();
        expect(estado.sujo()).toBe(false);
    });

    // Passado o limite, o instantâneo mais antigo cai e não há mais como provar
    // que o editor voltou ao começo.
    it('continua sujo quando a pilha estourou, mesmo desfazendo tudo', () => {
        const estado = criarEstado();
        estado.carregar(DO_SERVIDOR);
        for (let i = 0; i < 120; i++) estado.mudar(comVia(i));
        while (estado.desfazer()) { /* volta até o fundo */ }
        expect(estado.sujo()).toBe(true);
    });
});

describe('aoMudar', () => {
    it('avisa em carregar, em mudar e em desfazer', () => {
        const estado = criarEstado();
        const vistos: number[] = [];
        estado.aoMudar((instantaneo) => vistos.push(instantaneo.grafo.nodes.length));

        estado.carregar(DO_SERVIDOR);
        estado.mudar(comVia(9));
        estado.desfazer();
        expect(vistos).toEqual([2, 3, 2]);
    });
});
