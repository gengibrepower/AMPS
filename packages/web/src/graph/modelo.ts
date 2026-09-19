import { distancia, projecaoNoSegmento } from './geometria';
import type { Caixa, Ponto } from './geometria';
import type { Aresta, DadosDaVaga, Dimensoes, Grafo, No, Papel } from './tipos';

export function acharNo(grafo: Grafo, id: string): No | null {
    return grafo.nodes.find((no) => no.id === id) ?? null;
}

// Mão dupla é um par de arestas opostas; o desenho precisa saber para separar
// as duas linhas em vez de empilhá-las.
export function temInversa(grafo: Grafo, aresta: Aresta): boolean {
    return grafo.edges.some((outra) => outra.from === aresta.to && outra.to === aresta.from);
}

export function chaveDaAresta(aresta: Aresta): string {
    return `${aresta.from}→${aresta.to}`;
}

// Caixa que envolve todos os nós, já contando a extensão das vagas. A folga
// cobre o que o desenho põe em volta dos outros nós — a largura do corredor,
// principalmente — para nada ficar cortado na borda.
export function caixaDoGrafo(grafo: Grafo, folga = 1): Caixa | null {
    if (grafo.nodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const no of grafo.nodes) {
        const meia = no.role === 'candidate'
            ? { x: no.dimensions.width / 2, y: no.dimensions.length / 2 }
            : { x: folga, y: folga };
        minX = Math.min(minX, no.position.x - meia.x);
        minY = Math.min(minY, no.position.y - meia.y);
        maxX = Math.max(maxX, no.position.x + meia.x);
        maxY = Math.max(maxY, no.position.y + meia.y);
    }
    return { minX, minY, maxX, maxY };
}

// Onde a vaga encosta no corredor. A vaga aparece uma vez só, na rua mais
// próxima dela: assim a fileira mostra quantas vagas aquela via de fato
// comporta, em vez de vagas penduradas num nó distante.
export interface Doca {
    readonly ponto: Ponto;
    readonly paraFora: Ponto;
    readonly maoDupla: boolean;
}

export function docaDaVaga(grafo: Grafo, vaga: No): Doca | null {
    let melhor: Doca | null = null;
    let menorDistancia = Infinity;

    for (const aresta of grafo.edges) {
        const de = acharNo(grafo, aresta.from);
        const para = acharNo(grafo, aresta.to);
        if (de === null || para === null) continue;
        if (de.role === 'candidate' || para.role === 'candidate') continue;

        const ponto = projecaoNoSegmento(vaga.position, de.position, para.position);
        const dx = vaga.position.x - ponto.x;
        const dy = vaga.position.y - ponto.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia >= menorDistancia || distancia === 0) continue;

        menorDistancia = distancia;
        melhor = {
            ponto,
            paraFora: { x: dx / distancia, y: dy / distancia },
            maoDupla: temInversa(grafo, aresta),
        };
    }
    return melhor;
}

// A vaga se deita perpendicular à rua em que encosta.
export function anguloDaVaga(grafo: Grafo, vaga: No): number | null {
    const doca = docaDaVaga(grafo, vaga);
    if (doca === null) return null;

    // O retângulo é desenhado com o comprimento no eixo y local.
    return Math.atan2(doca.paraFora.y, doca.paraFora.x) - Math.PI / 2;
}

// Quem manda na inclinação da vaga é a tabela `vagas`, que é onde a rotação
// existe de verdade. A dedução pela rua só vale enquanto a vaga não foi
// cadastrada — aí ela serve de sugestão na hora de criar.
export function anguloDeDesenho(
    grafo: Grafo,
    vaga: No,
    dados: DadosDaVaga | undefined,
): number {
    if (dados !== undefined) return (dados.rotacaoGraus * Math.PI) / 180;
    return anguloDaVaga(grafo, vaga) ?? 0;
}

// Tamanho da vaga nova, em metros. O Merlian tem 1,85 × 4,5 como baseline do
// viés por tamanho da RN-14; aqui vale a vaga desenhada de verdade no pátio.
export const VAGA_PADRAO: Dimensoes = { width: 2.5, length: 5 };

const PREFIXO: Record<Papel, string> = {
    candidate: 's',
    source: 'e',
    transit: 't',
    attractor: 'p',
};

// Id de nó é imutável e é o que `vagas.no_id` persegue: repetir um id órfã a
// vaga do outro e o trigger recusa. Conta a partir do maior sufixo em uso e
// ainda confere contra o conjunto, porque pátio semeado usa `v001` e `r1_2`.
export function proximoId(grafo: Grafo, papel: Papel): string {
    const prefixo = PREFIXO[papel];
    const usados = new Set(grafo.nodes.map((no) => no.id));

    let proximo = 1;
    for (const no of grafo.nodes) {
        if (!no.id.startsWith(prefixo)) continue;
        const sufixo = Number(no.id.slice(prefixo.length));
        if (Number.isInteger(sufixo) && sufixo >= proximo) proximo = sufixo + 1;
    }
    while (usados.has(`${prefixo}${proximo}`)) proximo += 1;
    return `${prefixo}${proximo}`;
}

function novoNo(id: string, papel: Papel, posicao: Ponto): No {
    switch (papel) {
        case 'candidate':
            return { id, role: 'candidate', position: posicao, dimensions: VAGA_PADRAO };
        case 'source':
            return { id, role: 'source', position: posicao };
        case 'transit':
            return { id, role: 'transit', position: posicao };
        case 'attractor':
            return { id, role: 'attractor', position: posicao };
    }
}

export interface Criacao {
    readonly grafo: Grafo;
    readonly no: No;
}

export function criarNo(grafo: Grafo, papel: Papel, posicao: Ponto): Criacao {
    const no = novoNo(proximoId(grafo, papel), papel, posicao);
    return { grafo: { nodes: [...grafo.nodes, no], edges: grafo.edges }, no };
}

// Mover não mexe no peso das arestas. O peso nasce da distância, mas o
// `strictObject` do Merlian não deixa guardar "este peso foi editado à mão", e
// recalcular apagaria em silêncio um ajuste deliberado — rampa, mão única.
// Recálculo é ação explícita.
export function moverNo(grafo: Grafo, id: string, posicao: Ponto): Grafo {
    return {
        nodes: grafo.nodes.map((no) => (no.id === id ? { ...no, position: posicao } : no)),
        edges: grafo.edges,
    };
}

// As arestas que tocavam o nó vão junto: aresta apontando para nó que não
// existe é exatamente o que o trigger recusa com 422.
export function removerNo(grafo: Grafo, id: string): Grafo {
    return {
        nodes: grafo.nodes.filter((no) => no.id !== id),
        edges: grafo.edges.filter((aresta) => aresta.from !== id && aresta.to !== id),
    };
}

// O que vai para `vagas.rotacao_graus` na criação. Depois disso quem manda é a
// coluna, não a geometria.
export function rotacaoDaVaga(grafo: Grafo, vaga: No): number {
    const angulo = anguloDaVaga(grafo, vaga);
    if (angulo === null) return 0;
    const graus = Math.round((angulo * 180) / Math.PI);
    return ((graus % 360) + 360) % 360;
}

// `vagas` tem UNIQUE em (estacionamento_id, numero): o número nasce no primeiro
// inteiro livre para não colidir com o que já está gravado.
export function proximoNumeroDeVaga(vagas: readonly DadosDaVaga[]): string {
    const usados = new Set(vagas.map((vaga) => vaga.numero));
    let proximo = vagas.length + 1;
    while (usados.has(String(proximo))) proximo += 1;
    return String(proximo);
}

// Uma casa decimal, em metros. A regra mora aqui porque criar aresta e
// recalcular peso têm que arredondar igual — em dois lugares elas divergem.
function pesoEntre(a: No, b: No): number {
    return Number(distancia(a.position, b.position).toFixed(1));
}

// Uma ponta que é vaga faz o acesso: entra na vaga e não sai de lá. Entre
// pontos de via e entrada a rua nasce de mão dupla, que é o que um pátio de
// verdade tem — e é o que o desenho mostra com 6,4 m em vez de 3,2 m.
export function maoDuplaEntre(de: No, para: No): boolean {
    return de.role !== 'candidate' && para.role !== 'candidate';
}

export function temAresta(grafo: Grafo, de: string, para: string): boolean {
    return grafo.edges.some((aresta) => aresta.from === de && aresta.to === para);
}

// O peso nasce da distância euclidiana e só muda na mão depois disso. Devolve o
// grafo recebido quando não há o que criar, para o chamador saber que não houve
// mudança sem comparar estrutura.
export function criarAresta(grafo: Grafo, deId: string, paraId: string): Grafo {
    const de = acharNo(grafo, deId);
    const para = acharNo(grafo, paraId);
    if (de === null || para === null || deId === paraId) return grafo;

    const peso = pesoEntre(de, para);
    const novas: Aresta[] = [];

    if (!temAresta(grafo, deId, paraId)) novas.push({ from: deId, to: paraId, weight: peso });
    if (maoDuplaEntre(de, para) && !temAresta(grafo, paraId, deId)) {
        novas.push({ from: paraId, to: deId, weight: peso });
    }
    if (novas.length === 0) return grafo;

    return { nodes: grafo.nodes, edges: [...grafo.edges, ...novas] };
}

// Tira um sentido só: apagar a ida de uma mão dupla deixa a rua de mão única,
// que é como se transforma uma coisa na outra.
export function removerAresta(grafo: Grafo, de: string, para: string): Grafo {
    return {
        nodes: grafo.nodes,
        edges: grafo.edges.filter((aresta) => !(aresta.from === de && aresta.to === para)),
    };
}

// O peso que a aresta teria se nascesse agora. Serve para criar e para o
// recálculo explícito do inspetor — nunca é aplicado sozinho.
export function pesoNatural(grafo: Grafo, de: string, para: string): number | null {
    const origem = acharNo(grafo, de);
    const destino = acharNo(grafo, para);
    return origem === null || destino === null ? null : pesoEntre(origem, destino);
}

export function mudarPeso(grafo: Grafo, de: string, para: string, peso: number): Grafo {
    return {
        nodes: grafo.nodes,
        edges: grafo.edges.map((aresta) => (
            aresta.from === de && aresta.to === para ? { ...aresta, weight: peso } : aresta
        )),
    };
}

// O que se renomeia é o `label`, cosmético e ecoado pelo Merlian; o `id` é
// imutável porque `vagas.no_id` casa com ele. Rótulo vazio tira a chave em vez
// de gravar string vazia: o `strictObject` do Merlian não ganha nada com uma
// chave sem conteúdo.
export function renomearNo(grafo: Grafo, id: string, rotulo: string): Grafo {
    const limpo = rotulo.trim();
    return {
        nodes: grafo.nodes.map((no) => {
            if (no.id !== id) return no;
            if (limpo !== '') return { ...no, label: limpo };

            const { label: _descartado, ...semRotulo } = no;
            return semRotulo as No;
        }),
        edges: grafo.edges,
    };
}
