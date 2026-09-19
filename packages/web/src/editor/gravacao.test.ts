import { describe, expect, it } from 'vitest';
import { executar, planejar } from './gravacao';
import type { Gravador, Passo } from './gravacao';
import type { Instantaneo } from './estado';
import type { DadosDaVaga, Grafo } from '../graph/tipos';

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
        { from: 't1', to: 's1', weight: 7 },
        { from: 't1', to: 's2', weight: 6 },
    ],
};

const vaga = (noId: string, numero: string): DadosDaVaga => ({
    noId,
    numero,
    tipo: 'comum',
    rotacaoGraus: 0,
    sensor: null,
});

const SERVIDOR: Instantaneo = { grafo: GRAFO, vagas: [vaga('s1', 'A-01'), vaga('s2', 'A-02')] };

// O MySQL devolve o mesmo grafo com as chaves em outra ordem e os arrays
// embaralhados: nada disso é mudança.
const REEMBARALHADO: Grafo = {
    edges: [...GRAFO.edges].reverse(),
    nodes: [...GRAFO.nodes].reverse(),
};

describe('planejar', () => {
    it('sem mudança não pede requisição nenhuma', () => {
        expect(planejar(SERVIDOR, SERVIDOR)).toEqual([]);
    });

    it('ordem das chaves e dos arrays não é mudança', () => {
        expect(planejar(SERVIDOR, { ...SERVIDOR, grafo: REEMBARALHADO })).toEqual([]);
    });

    it('mover um nó manda só a topologia', () => {
        const movido: Grafo = {
            nodes: GRAFO.nodes.map((no) => (no.id === 't1' ? { ...no, position: { x: 20, y: 0 } } : no)),
            edges: GRAFO.edges,
        };
        expect(planejar(SERVIDOR, { ...SERVIDOR, grafo: movido })).toEqual([
            { tipo: 'topologia', grafo: movido },
        ]);
    });

    it('trocar o peso de uma aresta conta como mudança de topologia', () => {
        const outroPeso: Grafo = {
            nodes: GRAFO.nodes,
            edges: GRAFO.edges.map((a) => (a.from === 'e1' ? { ...a, weight: 99 } : a)),
        };
        expect(planejar(SERVIDOR, { ...SERVIDOR, grafo: outroPeso })).toHaveLength(1);
    });

    it('renomear o rótulo conta como mudança de topologia', () => {
        const comRotulo: Grafo = {
            nodes: GRAFO.nodes.map((no) => (no.id === 'e1' ? { ...no, label: 'Portaria' } : no)),
            edges: GRAFO.edges,
        };
        expect(planejar(SERVIDOR, { ...SERVIDOR, grafo: comRotulo })).toHaveLength(1);
    });

    it('editar uma vaga manda só ela, não o lote inteiro', () => {
        const local: Instantaneo = {
            grafo: GRAFO,
            vagas: [{ ...vaga('s1', 'A-01'), tipo: 'pcd' }, vaga('s2', 'A-02')],
        };
        expect(planejar(SERVIDOR, local)).toEqual([
            { tipo: 'vagas', vagas: [{ ...vaga('s1', 'A-01'), tipo: 'pcd' }] },
        ]);
    });

    it('troca de sensor entra no lote', () => {
        const local: Instantaneo = {
            grafo: GRAFO,
            vagas: [{ ...vaga('s1', 'A-01'), sensor: 'esp32-09' }, vaga('s2', 'A-02')],
        };
        expect(planejar(SERVIDOR, local)).toHaveLength(1);
    });

    // A ordem é a que os triggers impõem, não preferência.
    it('apagar vaga vem antes da topologia, e a topologia antes das vagas', () => {
        const semS2: Grafo = {
            nodes: GRAFO.nodes.filter((no) => no.id !== 's2'),
            edges: GRAFO.edges.filter((a) => a.to !== 's2'),
        };
        const local: Instantaneo = {
            grafo: semS2,
            vagas: [{ ...vaga('s1', 'A-01'), numero: 'B-01' }],
        };

        expect(planejar(SERVIDOR, local).map((passo) => passo.tipo)).toEqual([
            'apagarVaga',
            'topologia',
            'vagas',
        ]);
    });

    it('cada vaga que sumiu vira um DELETE', () => {
        const vazio: Instantaneo = { grafo: { nodes: [], edges: [] }, vagas: [] };
        const apagados = planejar(SERVIDOR, vazio)
            .filter((passo) => passo.tipo === 'apagarVaga')
            .map((passo) => (passo.tipo === 'apagarVaga' ? passo.noId : ''));

        expect(apagados).toEqual(['s1', 's2']);
    });

    it('vaga nova entra no lote', () => {
        const comS3: Grafo = {
            nodes: [...GRAFO.nodes, {
                id: 's3',
                role: 'candidate',
                position: { x: 12, y: 6 },
                dimensions: { width: 2.5, length: 5 },
            }],
            edges: GRAFO.edges,
        };
        const local: Instantaneo = {
            grafo: comS3,
            vagas: [...SERVIDOR.vagas, vaga('s3', 'A-03')],
        };

        const passos = planejar(SERVIDOR, local);
        expect(passos.map((p) => p.tipo)).toEqual(['topologia', 'vagas']);
        expect(passos[1]).toEqual({ tipo: 'vagas', vagas: [vaga('s3', 'A-03')] });
    });

    // `vagas_valida_no_insert` recusa no_id que não seja candidate no grafo
    // gravado: o 422 é rede de segurança, não fluxo normal.
    it('não manda vaga pendurada em nó que não é candidate', () => {
        const local: Instantaneo = {
            grafo: GRAFO,
            vagas: [...SERVIDOR.vagas, vaga('t1', 'A-09')],
        };
        expect(planejar(SERVIDOR, local)).toEqual([]);
    });

    it('não manda vaga cujo nó sumiu do grafo', () => {
        const local: Instantaneo = {
            grafo: { nodes: GRAFO.nodes.filter((no) => no.id !== 's2'), edges: [] },
            vagas: [vaga('s1', 'A-01'), { ...vaga('s2', 'A-02'), tipo: 'moto' }],
        };
        const lotes = planejar(SERVIDOR, local).filter((passo) => passo.tipo === 'vagas');
        expect(lotes).toEqual([]);
    });

    it('pátio que nasce vazio e ganha tudo manda topologia e vagas', () => {
        const zerado: Instantaneo = { grafo: { nodes: [], edges: [] }, vagas: [] };
        expect(planejar(zerado, SERVIDOR).map((p) => p.tipo)).toEqual(['topologia', 'vagas']);
    });
});

describe('executar', () => {
    function gravadorDeMentira(falhaEm?: string): {
        gravador: Gravador;
        feitos: string[];
    } {
        const feitos: string[] = [];
        const registrar = async (o_que: string): Promise<void> => {
            if (falhaEm === o_que) throw new Error(`falhou em ${o_que}`);
            feitos.push(o_que);
        };

        return {
            feitos,
            gravador: {
                apagarVaga: async (noId) => registrar(`apagar:${noId}`),
                topologia: async () => {
                    await registrar('topologia');
                    return 7;
                },
                vagas: async () => registrar('vagas'),
            },
        };
    }

    const PASSOS: readonly Passo[] = [
        { tipo: 'apagarVaga', noId: 's2' },
        { tipo: 'topologia', grafo: GRAFO },
        { tipo: 'vagas', vagas: [vaga('s1', 'A-01')] },
    ];

    it('roda os passos na ordem em que vieram', async () => {
        const { gravador, feitos } = gravadorDeMentira();
        await executar(PASSOS, gravador);
        expect(feitos).toEqual(['apagar:s2', 'topologia', 'vagas']);
    });

    it('devolve a versão nova quando a topologia foi junto', async () => {
        const { gravador } = gravadorDeMentira();
        expect(await executar(PASSOS, gravador)).toBe(7);
    });

    it('devolve null quando só as vagas mudaram', async () => {
        const { gravador } = gravadorDeMentira();
        expect(await executar([PASSOS[2]!], gravador)).toBeNull();
    });

    // Seguir depois de um passo que falhou gravaria metade da mudança.
    it('para no primeiro erro, sem tentar o resto', async () => {
        const { gravador, feitos } = gravadorDeMentira('topologia');
        await expect(executar(PASSOS, gravador)).rejects.toThrow('falhou em topologia');
        expect(feitos).toEqual(['apagar:s2']);
    });

    it('lista vazia não chama nada', async () => {
        const { gravador, feitos } = gravadorDeMentira();
        expect(await executar([], gravador)).toBeNull();
        expect(feitos).toEqual([]);
    });
});
