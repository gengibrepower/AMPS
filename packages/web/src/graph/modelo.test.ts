import { describe, expect, it } from 'vitest';
import {
    acharNo,
    anguloDaVaga,
    anguloDeDesenho,
    caixaDoGrafo,
    chaveDaAresta,
    criarAresta,
    criarNo,
    docaDaVaga,
    maoDuplaEntre,
    mesmaVaga,
    mesmoGrafo,
    mudarPeso,
    moverNo,
    proximoId,
    pesoNatural,
    proximoNumeroDeVaga,
    removerAresta,
    removerNo,
    renomearNo,
    rotacaoDaVaga,
    temInversa,
    VAGA_PADRAO,
} from './modelo';
import type { DadosDaVaga, Grafo, No } from './tipos';

const GRAFO: Grafo = {
    nodes: [
        { id: 'e1', role: 'source', position: { x: 0, y: 0 } },
        { id: 's1', role: 'candidate', position: { x: 5, y: 0 }, dimensions: { width: 2.5, length: 5 } },
        { id: 't1', role: 'transit', position: { x: 2, y: 3 } },
    ],
    edges: [
        { from: 'e1', to: 't1', weight: 3.6 },
        { from: 't1', to: 'e1', weight: 3.6 },
        { from: 't1', to: 's1', weight: 4.2 },
    ],
};

describe('acharNo', () => {
    it('acha pelo id', () => {
        expect(acharNo(GRAFO, 's1')?.role).toBe('candidate');
    });

    it('devolve null para id que não existe', () => {
        expect(acharNo(GRAFO, 'fantasma')).toBeNull();
    });
});

describe('temInversa', () => {
    it('reconhece o par de mão dupla', () => {
        expect(temInversa(GRAFO, { from: 'e1', to: 't1', weight: 3.6 })).toBe(true);
    });

    it('nega quando a volta não existe', () => {
        expect(temInversa(GRAFO, { from: 't1', to: 's1', weight: 4.2 })).toBe(false);
    });
});

describe('chaveDaAresta', () => {
    it('distingue ida de volta', () => {
        const ida = chaveDaAresta({ from: 'a', to: 'b', weight: 1 });
        const volta = chaveDaAresta({ from: 'b', to: 'a', weight: 1 });
        expect(ida).not.toBe(volta);
    });
});

describe('caixaDoGrafo', () => {
    it('inclui a extensão da vaga, não só o centro dela', () => {
        expect(caixaDoGrafo(GRAFO)).toEqual({ minX: -1, minY: -2.5, maxX: 6.25, maxY: 4 });
    });

    it('devolve null para grafo vazio', () => {
        expect(caixaDoGrafo({ nodes: [], edges: [] })).toBeNull();
    });
});

describe('anguloDaVaga', () => {
    const vaga = (x: number, y: number): No => ({
        id: 'v',
        role: 'candidate',
        position: { x, y },
        dimensions: { width: 2.5, length: 5 },
    });

    // Rua horizontal de a até b, com a vaga pendurada em b.
    function comRuaHorizontal(posicao: No): Grafo {
        return {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 10, y: 0 } },
                posicao,
            ],
            edges: [
                { from: 'a', to: 'b', weight: 10 },
                { from: 'b', to: posicao.id, weight: 5 },
            ],
        };
    }

    const graus = (radianos: number | null): number | null =>
        radianos === null ? null : Math.round((radianos * 180) / Math.PI);

    it('deita a vaga perpendicular à rua quando ela está abaixo', () => {
        expect(graus(anguloDaVaga(comRuaHorizontal(vaga(5, 6)), vaga(5, 6)))).toBe(0);
    });

    it('vira a vaga do outro lado quando ela está acima da rua', () => {
        expect(Math.abs(graus(anguloDaVaga(comRuaHorizontal(vaga(5, -6)), vaga(5, -6))) ?? 0))
            .toBe(180);
    });

    it('inclina quando a vaga passa do fim da rua e ancora na quina', () => {
        expect(graus(anguloDaVaga(comRuaHorizontal(vaga(14, 6)), vaga(14, 6)))).toBe(-34);
    });

    it('acompanha rua vertical', () => {
        const grafo: Grafo = {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 0, y: 10 } },
                vaga(6, 8),
            ],
            edges: [
                { from: 'a', to: 'b', weight: 10 },
                { from: 'b', to: 'v', weight: 6 },
            ],
        };
        expect(graus(anguloDaVaga(grafo, vaga(6, 8)))).toBe(-90);
    });

    it('ignora o quanto a vaga está adiantada ao longo da rua', () => {
        const atras = anguloDaVaga(comRuaHorizontal(vaga(3, 6)), vaga(3, 6));
        const adiante = anguloDaVaga(comRuaHorizontal(vaga(8, 6)), vaga(8, 6));
        expect(graus(atras)).toBe(graus(adiante));
    });

    it('devolve null para vaga sem acesso', () => {
        const solta: Grafo = { nodes: [vaga(1, 1)], edges: [] };
        expect(anguloDaVaga(solta, vaga(1, 1))).toBeNull();
    });
});

describe('caixaDoGrafo com folga', () => {
    it('a folga alarga os nós que não são vaga', () => {
        const apertada = caixaDoGrafo(GRAFO, 1);
        const larga = caixaDoGrafo(GRAFO, 3.5);
        expect(larga?.minX).toBeLessThan(apertada?.minX ?? 0);
    });
});

describe('docaDaVaga', () => {
    const vaga = (x: number, y: number): No => ({
        id: 'v',
        role: 'candidate',
        position: { x, y },
        dimensions: { width: 2.5, length: 5 },
    });

    // Duas ruas paralelas: uma de mão dupla em y=0 e uma de mão única em y=20.
    function comDuasRuas(posicao: No): Grafo {
        return {
            nodes: [
                { id: 'a', role: 'source', position: { x: 0, y: 0 } },
                { id: 'b', role: 'transit', position: { x: 30, y: 0 } },
                { id: 'c', role: 'transit', position: { x: 0, y: 20 } },
                { id: 'd', role: 'transit', position: { x: 30, y: 20 } },
                posicao,
            ],
            edges: [
                { from: 'a', to: 'b', weight: 30 },
                { from: 'b', to: 'a', weight: 30 },
                { from: 'c', to: 'd', weight: 30 },
                { from: 'a', to: posicao.id, weight: 6 },
            ],
        };
    }

    it('encosta na rua mais próxima, não na do nó que liga a vaga', () => {
        const longe = vaga(15, 17);
        expect(docaDaVaga(comDuasRuas(longe), longe)?.ponto).toEqual({ x: 15, y: 20 });
    });

    it('aponta do meio-fio para a vaga', () => {
        const abaixo = vaga(15, 6);
        expect(docaDaVaga(comDuasRuas(abaixo), abaixo)?.paraFora).toEqual({ x: 0, y: 1 });
    });

    it('sabe quando a rua é de mão dupla', () => {
        const naDupla = vaga(15, 6);
        const naUnica = vaga(15, 17);
        expect(docaDaVaga(comDuasRuas(naDupla), naDupla)?.maoDupla).toBe(true);
        expect(docaDaVaga(comDuasRuas(naUnica), naUnica)?.maoDupla).toBe(false);
    });

    it('prende na ponta quando a vaga passa do fim da rua', () => {
        const passada = vaga(40, 6);
        expect(docaDaVaga(comDuasRuas(passada), passada)?.ponto).toEqual({ x: 30, y: 0 });
    });

    it('devolve null quando não há rua nenhuma', () => {
        const solta = vaga(1, 1);
        expect(docaDaVaga({ nodes: [solta], edges: [] }, solta)).toBeNull();
    });
});

describe('anguloDeDesenho', () => {
    const posicao: No = {
        id: 'v',
        role: 'candidate',
        position: { x: 5, y: 6 },
        dimensions: { width: 2.5, length: 5 },
    };

    const comRua: Grafo = {
        nodes: [
            { id: 'a', role: 'source', position: { x: 0, y: 0 } },
            { id: 'b', role: 'transit', position: { x: 10, y: 0 } },
            posicao,
        ],
        edges: [
            { from: 'a', to: 'b', weight: 10 },
            { from: 'b', to: 'v', weight: 6 },
        ],
    };

    const cadastrada = (rotacaoGraus: number): DadosDaVaga => ({
        noId: 'v',
        numero: 'A-01',
        tipo: 'comum',
        rotacaoGraus,
        sensor: null,
    });

    it('a rotação do banco manda quando a vaga está cadastrada', () => {
        expect(anguloDeDesenho(comRua, posicao, cadastrada(45))).toBeCloseTo(Math.PI / 4, 6);
    });

    it('zero no banco é zero, não é "deduza"', () => {
        expect(anguloDeDesenho(comRua, posicao, cadastrada(0))).toBe(0);
    });

    it('deduz pela rua enquanto a vaga não foi cadastrada', () => {
        expect(anguloDeDesenho(comRua, posicao, undefined)).toBe(anguloDaVaga(comRua, posicao));
    });

    it('cai em zero quando não há vaga cadastrada nem rua', () => {
        const solta: Grafo = { nodes: [posicao], edges: [] };
        expect(anguloDeDesenho(solta, posicao, undefined)).toBe(0);
    });
});

describe('proximoId', () => {
    it('usa um prefixo por papel', () => {
        expect(proximoId(GRAFO, 'candidate')).toBe('s2');
        expect(proximoId(GRAFO, 'source')).toBe('e2');
        expect(proximoId(GRAFO, 'transit')).toBe('t2');
        expect(proximoId(GRAFO, 'attractor')).toBe('p1');
    });

    it('continua do maior sufixo, não do total', () => {
        const comBuraco: Grafo = {
            nodes: [
                { id: 't1', role: 'transit', position: { x: 0, y: 0 } },
                { id: 't7', role: 'transit', position: { x: 1, y: 0 } },
            ],
            edges: [],
        };
        expect(proximoId(comBuraco, 'transit')).toBe('t8');
    });

    it('não repete id quando o pátio veio com nome fora do padrão', () => {
        const semeado: Grafo = {
            nodes: [
                { id: 's1', role: 'candidate', position: { x: 0, y: 0 }, dimensions: { width: 2.5, length: 5 } },
                { id: 'v001', role: 'candidate', position: { x: 3, y: 0 }, dimensions: { width: 2.5, length: 5 } },
            ],
            edges: [],
        };
        const novo = proximoId(semeado, 'candidate');
        expect(semeado.nodes.some((no) => no.id === novo)).toBe(false);
    });
});

describe('criarNo', () => {
    it('só a vaga nasce com dimensions, como no discriminatedUnion do Merlian', () => {
        const vaga = criarNo(GRAFO, 'candidate', { x: 9, y: 2 }).no;
        const via = criarNo(GRAFO, 'transit', { x: 9, y: 2 }).no;
        expect(vaga.role === 'candidate' && vaga.dimensions).toEqual(VAGA_PADRAO);
        expect('dimensions' in via).toBe(false);
    });

    it('não mexe no grafo que recebeu', () => {
        const antes = GRAFO.nodes.length;
        expect(criarNo(GRAFO, 'transit', { x: 9, y: 2 }).grafo.nodes).toHaveLength(antes + 1);
        expect(GRAFO.nodes).toHaveLength(antes);
    });

    it('não inventa aresta', () => {
        expect(criarNo(GRAFO, 'transit', { x: 9, y: 2 }).grafo.edges).toBe(GRAFO.edges);
    });
});

describe('moverNo', () => {
    it('leva o nó para a posição nova', () => {
        expect(acharNo(moverNo(GRAFO, 's1', { x: 8, y: 1 }), 's1')?.position).toEqual({ x: 8, y: 1 });
    });

    it('não recalcula o peso da aresta: recálculo é ação explícita', () => {
        const movido = moverNo(GRAFO, 's1', { x: 40, y: 40 });
        expect(movido.edges).toEqual(GRAFO.edges);
    });

    it('a vaga continua vaga depois de mover', () => {
        const vaga = acharNo(moverNo(GRAFO, 's1', { x: 8, y: 1 }), 's1');
        expect(vaga?.role === 'candidate' && vaga.dimensions).toEqual({ width: 2.5, length: 5 });
    });

    it('ignora id que não existe', () => {
        expect(moverNo(GRAFO, 'fantasma', { x: 1, y: 1 }).nodes).toEqual(GRAFO.nodes);
    });
});

describe('removerNo', () => {
    it('leva junto as arestas que tocavam o nó', () => {
        const semVia = removerNo(GRAFO, 't1');
        expect(semVia.nodes.map((no) => no.id)).toEqual(['e1', 's1']);
        expect(semVia.edges).toHaveLength(0);
    });

    it('não deixa aresta apontando para nó que não existe', () => {
        const sobrou = removerNo(GRAFO, 's1');
        const ids = new Set(sobrou.nodes.map((no) => no.id));
        expect(sobrou.edges.every((a) => ids.has(a.from) && ids.has(a.to))).toBe(true);
    });

    it('ignora id que não existe', () => {
        expect(removerNo(GRAFO, 'fantasma')).toEqual(GRAFO);
    });
});

describe('rotacaoDaVaga', () => {
    it('devolve grau inteiro em [0, 360), como a coluna do banco', () => {
        const vaga = acharNo(GRAFO, 's1')!;
        const graus = rotacaoDaVaga(GRAFO, vaga);
        expect(Number.isInteger(graus)).toBe(true);
        expect(graus).toBeGreaterThanOrEqual(0);
        expect(graus).toBeLessThan(360);
    });

    it('concorda com o ângulo deduzido pela rua', () => {
        const vaga = acharNo(GRAFO, 's1')!;
        const esperado = ((Math.round((anguloDaVaga(GRAFO, vaga)! * 180) / Math.PI) % 360) + 360) % 360;
        expect(rotacaoDaVaga(GRAFO, vaga)).toBe(esperado);
    });

    it('cai em zero quando não há rua para deduzir', () => {
        const vaga = acharNo(GRAFO, 's1')!;
        expect(rotacaoDaVaga({ nodes: [vaga], edges: [] }, vaga)).toBe(0);
    });
});

describe('proximoNumeroDeVaga', () => {
    const vaga = (numero: string): DadosDaVaga => ({
        noId: numero,
        numero,
        tipo: 'comum',
        rotacaoGraus: 0,
        sensor: null,
    });

    it('começa no 1 num pátio sem vaga', () => {
        expect(proximoNumeroDeVaga([])).toBe('1');
    });

    it('não colide com número já gravado', () => {
        expect(proximoNumeroDeVaga([vaga('1'), vaga('3')])).toBe('4');
        expect(proximoNumeroDeVaga([vaga('2'), vaga('3')])).toBe('4');
    });

    it('convive com a numeração por setor do pátio semeado', () => {
        expect(proximoNumeroDeVaga([vaga('S-01'), vaga('S-02')])).toBe('3');
    });
});

describe('maoDuplaEntre', () => {
    const via = acharNo(GRAFO, 't1')!;
    const entrada = acharNo(GRAFO, 'e1')!;
    const vaga = acharNo(GRAFO, 's1')!;

    it('rua entre via e entrada é de mão dupla', () => {
        expect(maoDuplaEntre(via, entrada)).toBe(true);
    });

    it('acesso de vaga é de mão única, dos dois lados', () => {
        expect(maoDuplaEntre(via, vaga)).toBe(false);
        expect(maoDuplaEntre(vaga, via)).toBe(false);
    });
});

describe('criarAresta', () => {
    const SOLTO: Grafo = {
        nodes: [
            { id: 't1', role: 'transit', position: { x: 0, y: 0 } },
            { id: 't2', role: 'transit', position: { x: 3, y: 4 } },
            { id: 's1', role: 'candidate', position: { x: 0, y: 6 }, dimensions: { width: 2.5, length: 5 } },
        ],
        edges: [],
    };

    it('liga duas vias nos dois sentidos', () => {
        expect(criarAresta(SOLTO, 't1', 't2').edges).toEqual([
            { from: 't1', to: 't2', weight: 5 },
            { from: 't2', to: 't1', weight: 5 },
        ]);
    });

    it('o acesso da vaga entra e não sai', () => {
        expect(criarAresta(SOLTO, 't1', 's1').edges).toEqual([{ from: 't1', to: 's1', weight: 6 }]);
    });

    it('o peso é a distância euclidiana, com uma casa', () => {
        const obliquo: Grafo = {
            nodes: [
                { id: 't1', role: 'transit', position: { x: 0, y: 0 } },
                { id: 't2', role: 'transit', position: { x: 1, y: 1 } },
            ],
            edges: [],
        };
        expect(criarAresta(obliquo, 't1', 't2').edges[0]?.weight).toBe(1.4);
    });

    it('não duplica aresta que já existe', () => {
        const uma = criarAresta(SOLTO, 't1', 't2');
        expect(criarAresta(uma, 't1', 't2')).toBe(uma);
    });

    // Completar a volta é como se transforma mão única em mão dupla.
    it('completa a volta que faltava sem repetir a ida', () => {
        const so_ida: Grafo = { nodes: SOLTO.nodes, edges: [{ from: 't1', to: 't2', weight: 5 }] };
        expect(criarAresta(so_ida, 't2', 't1').edges).toEqual([
            { from: 't1', to: 't2', weight: 5 },
            { from: 't2', to: 't1', weight: 5 },
        ]);
    });

    it('não liga um nó nele mesmo', () => {
        expect(criarAresta(SOLTO, 't1', 't1')).toBe(SOLTO);
    });

    it('ignora nó que não existe', () => {
        expect(criarAresta(SOLTO, 't1', 'fantasma')).toBe(SOLTO);
    });
});

describe('removerAresta', () => {
    it('tira um sentido só e deixa a rua de mão única', () => {
        const dupla = criarAresta(
            { nodes: GRAFO.nodes, edges: [] },
            'e1',
            't1',
        );
        const unica = removerAresta(dupla, 't1', 'e1');
        expect(unica.edges).toEqual([{ from: 'e1', to: 't1', weight: 3.6 }]);
    });

    it('não mexe nos nós', () => {
        expect(removerAresta(GRAFO, 'e1', 't1').nodes).toBe(GRAFO.nodes);
    });

    it('ignora aresta que não existe', () => {
        expect(removerAresta(GRAFO, 'e1', 's1').edges).toEqual(GRAFO.edges);
    });
});

describe('renomearNo', () => {
    it('põe o rótulo no nó certo', () => {
        expect(acharNo(renomearNo(GRAFO, 'e1', 'Portaria'), 'e1')?.label).toBe('Portaria');
    });

    it('apara o espaço em volta', () => {
        expect(acharNo(renomearNo(GRAFO, 'e1', '  Portaria  '), 'e1')?.label).toBe('Portaria');
    });

    // Chave sem conteúdo não ajuda ninguém, e o Merlian ecoa o que receber.
    it('rótulo vazio tira a chave em vez de gravar string vazia', () => {
        const comRotulo = renomearNo(GRAFO, 'e1', 'Portaria');
        const semRotulo = acharNo(renomearNo(comRotulo, 'e1', '   '), 'e1');
        expect(semRotulo === null ? true : 'label' in semRotulo).toBe(false);
    });

    it('não mexe no id nem no papel', () => {
        const no = acharNo(renomearNo(GRAFO, 's1', 'Vaga da frente'), 's1');
        expect(no?.id).toBe('s1');
        expect(no?.role).toBe('candidate');
    });

    it('não mexe nas arestas', () => {
        expect(renomearNo(GRAFO, 'e1', 'Portaria').edges).toBe(GRAFO.edges);
    });
});

describe('pesoNatural', () => {
    it('é a distância entre os nós, com uma casa', () => {
        expect(pesoNatural(GRAFO, 'e1', 't1')).toBe(3.6);
    });

    it('não depende do peso gravado', () => {
        const torto = mudarPeso(GRAFO, 'e1', 't1', 99);
        expect(pesoNatural(torto, 'e1', 't1')).toBe(3.6);
    });

    it('devolve null quando falta nó', () => {
        expect(pesoNatural(GRAFO, 'e1', 'fantasma')).toBeNull();
    });
});

describe('mudarPeso', () => {
    it('troca só o sentido pedido', () => {
        const novo = mudarPeso(GRAFO, 'e1', 't1', 7.5);
        expect(novo.edges.find((a) => a.from === 'e1' && a.to === 't1')?.weight).toBe(7.5);
        expect(novo.edges.find((a) => a.from === 't1' && a.to === 'e1')?.weight).toBe(3.6);
    });

    it('não mexe nos nós', () => {
        expect(mudarPeso(GRAFO, 'e1', 't1', 7.5).nodes).toBe(GRAFO.nodes);
    });
});

describe('mesmoGrafo', () => {
    it('reconhece o grafo idêntico', () => {
        expect(mesmoGrafo(GRAFO, GRAFO)).toBe(true);
    });

    // É o caso que o MySQL cria: mesmo conteúdo, chaves e arrays em outra ordem.
    it('ordem dos arrays não conta', () => {
        const virado: Grafo = {
            nodes: [...GRAFO.nodes].reverse(),
            edges: [...GRAFO.edges].reverse(),
        };
        expect(mesmoGrafo(GRAFO, virado)).toBe(true);
    });

    it('vê posição diferente', () => {
        expect(mesmoGrafo(GRAFO, moverNo(GRAFO, 's1', { x: 99, y: 99 }))).toBe(false);
    });

    it('vê peso diferente', () => {
        expect(mesmoGrafo(GRAFO, mudarPeso(GRAFO, 'e1', 't1', 99))).toBe(false);
    });

    it('vê rótulo diferente', () => {
        expect(mesmoGrafo(GRAFO, renomearNo(GRAFO, 'e1', 'Portaria'))).toBe(false);
    });

    it('vê nó a mais', () => {
        expect(mesmoGrafo(GRAFO, criarNo(GRAFO, 'transit', { x: 9, y: 9 }).grafo)).toBe(false);
    });

    it('vê aresta a menos', () => {
        expect(mesmoGrafo(GRAFO, removerAresta(GRAFO, 'e1', 't1'))).toBe(false);
    });

    it('vê id trocado mesmo com a mesma contagem', () => {
        const outroId: Grafo = {
            nodes: GRAFO.nodes.map((no) => (no.id === 'e1' ? { ...no, id: 'e9' } : no)),
            edges: GRAFO.edges,
        };
        expect(mesmoGrafo(GRAFO, outroId)).toBe(false);
    });

    it('dois grafos vazios são iguais', () => {
        expect(mesmoGrafo({ nodes: [], edges: [] }, { nodes: [], edges: [] })).toBe(true);
    });
});

describe('mesmaVaga', () => {
    const base: DadosDaVaga = {
        noId: 's1',
        numero: 'A-01',
        tipo: 'comum',
        rotacaoGraus: 0,
        sensor: 'esp32-01',
    };

    it('reconhece a vaga idêntica', () => {
        expect(mesmaVaga(base, { ...base })).toBe(true);
    });

    it('vê cada campo, o sensor incluído', () => {
        expect(mesmaVaga(base, { ...base, numero: 'A-02' })).toBe(false);
        expect(mesmaVaga(base, { ...base, tipo: 'pcd' })).toBe(false);
        expect(mesmaVaga(base, { ...base, rotacaoGraus: 90 })).toBe(false);
        expect(mesmaVaga(base, { ...base, sensor: null })).toBe(false);
        expect(mesmaVaga(base, { ...base, noId: 's2' })).toBe(false);
    });
});
