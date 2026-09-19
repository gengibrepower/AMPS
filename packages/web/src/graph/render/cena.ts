import Konva from 'konva';
import { direcao, encaixarNaTela, encaixarPonto, pixelsParaMetros } from '../geometria';
import type { Ponto } from '../geometria';
import {
    acharNo,
    anguloDeDesenho,
    caixaDoGrafo,
    chaveDaAresta,
    docaDaVaga,
    temInversa,
} from '../modelo';
import { GRAFO_VAZIO } from '../tipos';
import type { Aresta, DadosDaVaga, Grafo, NoVaga } from '../tipos';
import { desenharAresta, desenharDoca, ladoDoTraco, meioFioEmMetros, realcarAresta } from './arestas';
import { desenharNo, mostrarNumeros, realcarNo, recuoDoNo } from './nos';
import { PESO } from './tinta';
import type { Palco } from './palco';

// O que a cena faz com o ponteiro. Apontar arrasta; ligar precisa do clique no
// nó mas não pode mover nada; criar deixa o clique atravessar até o palco,
// inclusive por cima de um nó, porque quem sabe o metro do ponteiro é o palco.
export type ModoDaCena = 'selecionar' | 'ligar' | 'criar';

export type Selecao =
    | { readonly tipo: 'no'; readonly id: string }
    | { readonly tipo: 'aresta'; readonly from: string; readonly to: string }
    | null;

// Abaixo disso o número pintado na vaga vira borrão.
const ZOOM_MINIMO_DO_NUMERO = 0.6;

// Folga em metros para o enquadramento: o corredor é desenhado em volta dos nós
// de via e não entra na caixa deles.
const FOLGA_DO_ENQUADRAMENTO = 3.5;

export interface Cena {
    desenhar(grafo: Grafo, vagas: readonly DadosDaVaga[]): void;
    enquadrar(): void;
    selecionar(selecao: Selecao): void;
    modo(modo: ModoDaCena): void;
    aoSelecionar(ouvinte: (selecao: Selecao) => void): void;
    aoClicarNoNo(ouvinte: (id: string) => void): void;
    aoArrastarNo(ouvinte: (id: string, metros: Ponto) => void): void;
    aoClicarNoVazio(ouvinte: (metros: Ponto) => void): void;
}

function mesmaSelecao(a: Selecao, b: Selecao): boolean {
    if (a === null || b === null) return a === b;
    if (a.tipo === 'no' && b.tipo === 'no') return a.id === b.id;
    if (a.tipo === 'aresta' && b.tipo === 'aresta') return a.from === b.from && a.to === b.to;
    return false;
}

export function criarCena(palco: Palco): Cena {
    const camadaDeArestas = new Konva.Group();
    const camadaDeNos = new Konva.Group();
    palco.camadaConteudo.add(camadaDeArestas, camadaDeNos);

    const grupos = new Map<string, Konva.Group>();
    const angulos = new Map<string, number>();
    const docas = new Map<string, Konva.Shape>();
    const dados = new Map<string, DadosDaVaga>();
    const setas = new Map<string, Konva.Group>();
    const pesos = new Map<string, Konva.Text>();
    const ouvintes: ((selecao: Selecao) => void)[] = [];
    const clicados: ((id: string) => void)[] = [];
    const arrastados: ((id: string, metros: Ponto) => void)[] = [];
    const vazios: ((metros: Ponto) => void)[] = [];

    let grafo: Grafo = GRAFO_VAZIO;
    let selecao: Selecao = null;
    let arrastavel = true;

    function aplicarRealce(): void {
        for (const no of grafo.nodes) {
            const grupo = grupos.get(no.id);
            if (grupo !== undefined) {
                realcarNo(grupo, no.role, selecao?.tipo === 'no' && selecao.id === no.id);
            }
        }
        for (const aresta of grafo.edges) {
            const seta = setas.get(chaveDaAresta(aresta));
            if (seta === undefined) continue;

            const escolhida = selecao?.tipo === 'aresta'
                && selecao.from === aresta.from
                && selecao.to === aresta.to;
            realcarAresta(seta, escolhida);

            // O acesso da vaga não é rua e não aparece na planta: só quando a
            // vaga ou a própria ligação está em foco.
            if (seta.getAttr('corredor') !== true) {
                const noFoco = selecao?.tipo === 'no'
                    && (selecao.id === aresta.from || selecao.id === aresta.to);
                seta.visible(escolhida || noFoco);
            }
        }
        palco.camadaConteudo.batchDraw();
    }

    // Desfazer e apagar tiram do grafo o que estava selecionado. Sem avisar
    // quem ouve, a barra de status fica exibindo o id de um nó que não existe
    // mais, e o Esc seguinte não conserta: para a cena a seleção já é nula.
    function esquecerSelecaoMorta(): void {
        const atual = selecao;
        if (atual === null) return;

        const vivo = atual.tipo === 'no'
            ? acharNo(grafo, atual.id) !== null
            : grafo.edges.some((aresta) => aresta.from === atual.from && aresta.to === atual.to);
        if (vivo) return;

        selecao = null;
        for (const ouvinte of ouvintes) ouvinte(selecao);
    }

    function definirSelecao(nova: Selecao): void {
        if (mesmaSelecao(selecao, nova)) return;
        selecao = nova;
        ajustarPesos();
        aplicarRealce();
        for (const ouvinte of ouvintes) ouvinte(selecao);
    }

    // O texto vive numa camada que escala com o zoom; a contraescala mantém o
    // peso legível em qualquer aproximação. Na planta não há número em cima de
    // cada via: o peso aparece só na aresta selecionada.
    function ajustarPesos(): void {
        const zoom = palco.zoom();
        for (const [id, grupo] of grupos) {
            if (dados.has(id)) mostrarNumeros(grupo, zoom >= ZOOM_MINIMO_DO_NUMERO);
        }
        for (const [chave, peso] of pesos) {
            peso.scale({ x: 1 / zoom, y: 1 / zoom });
            peso.visible(chave === chaveSelecionada());
        }
        palco.camadaConteudo.batchDraw();
    }

    function chaveSelecionada(): string | null {
        return selecao?.tipo === 'aresta' ? `${selecao.from}\u2192${selecao.to}` : null;
    }

    function desenharUmaAresta(aresta: Aresta): void {
        const origem = acharNo(grafo, aresta.from);
        const destino = acharNo(grafo, aresta.to);
        if (origem === null || destino === null) return;

        const ida = direcao(origem.position, destino.position);
        const volta = { x: -ida.x, y: -ida.y };
        const anguloDeOrigem = angulos.get(origem.id) ?? 0;
        const anguloDeDestino = angulos.get(destino.id) ?? 0;
        const corredor = origem.role !== 'candidate' && destino.role !== 'candidate';

        // O ponto de via fica dentro da pista: recuar nele abriria um vão no
        // pavimento a cada curva.
        const recuo = (no: typeof origem, saida: typeof ida, angulo: number): number =>
            corredor && no.role === 'transit' ? 0 : recuoDoNo(no, saida, angulo);
        // Corredor é a ligação entre pontos de via; o que toca numa vaga é só o
        // acesso dela, e na planta isso não é uma rua.
        const seta = desenharAresta({
            de: origem.position,
            para: destino.position,
            recuoDe: recuo(origem, ida, anguloDeOrigem),
            recuoPara: recuo(destino, volta, anguloDeDestino),
            maoDupla: temInversa(grafo, aresta),
            corredor,
        });
        seta.on('click', () => definirSelecao({ tipo: 'aresta', from: aresta.from, to: aresta.to }));
        camadaDeArestas.add(seta);
        setas.set(chaveDaAresta(aresta), seta);

        const lado = ladoDoTraco(seta);
        const peso = new Konva.Text({
            x: lado.x,
            y: lado.y,
            text: aresta.weight.toFixed(1).replace('.', ','),
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            fill: PESO,
            listening: false,
        });
        peso.offsetX(peso.width() / 2);
        peso.offsetY(peso.height() / 2);
        camadaDeArestas.add(peso);
        pesos.set(chaveDaAresta(aresta), peso);
    }

    // Uma doca por vaga, no ponto em que ela encosta na via mais próxima: a vaga
    // nunca aparece duas vezes, mesmo que tenha mais de uma aresta de acesso.
    function desenharUmaDoca(vaga: NoVaga): void {
        const doca = docaDaVaga(grafo, vaga);
        if (doca === null) return;

        const recuoDoMeioFio = meioFioEmMetros(doca.maoDupla);
        const noMeioFio = {
            x: doca.ponto.x + doca.paraFora.x * recuoDoMeioFio,
            y: doca.ponto.y + doca.paraFora.y * recuoDoMeioFio,
        };
        const meioComprimento = vaga.dimensions.length / 2;
        const naVaga = {
            x: vaga.position.x - doca.paraFora.x * meioComprimento,
            y: vaga.position.y - doca.paraFora.y * meioComprimento,
        };

        const traco = desenharDoca(noMeioFio, naVaga, false);
        camadaDeArestas.add(traco);
        docas.set(vaga.id, traco);
    }

    // O arrasto do nó pousa na grade de 1 m. O Konva conversa em coordenada
    // absoluta de tela, e a conta desce até os metros para o encaixe valer no
    // modelo, não no pixel.
    function presoNaGrade(tela: Ponto): Ponto {
        const stage = palco.stage;
        return encaixarNaTela(tela, { x: stage.x(), y: stage.y() }, stage.scaleX());
    }

    function tornarArrastavel(grupo: Konva.Group, id: string): void {
        grupo.draggable(arrastavel);
        grupo.dragBoundFunc(presoNaGrade);
        grupo.on('dragstart', () => definirSelecao({ tipo: 'no', id }));
        grupo.on('dragend', () => {
            const metros = encaixarPonto({
                x: pixelsParaMetros(grupo.x()),
                y: pixelsParaMetros(grupo.y()),
            });
            // Quem ouve redesenha a cena, e o redesenho destrói justamente o
            // grupo que o Konva acabou de arrastar. Avisar fora do evento deixa
            // o Konva encerrar o arrasto primeiro; destruí-lo por dentro larga a
            // animação de arrasto girando e trava a página.
            setTimeout(() => {
                for (const ouvinte of arrastados) ouvinte(id, metros);
            }, 0);
        });
    }

    palco.stage.on('click', (evento) => {
        if (evento.target !== palco.stage || palco.arrastouAgora()) return;
        definirSelecao(null);

        const ponteiro = palco.stage.getPointerPosition();
        if (ponteiro === null) return;
        const metros = palco.emMetros(ponteiro);
        for (const ouvinte of vazios) ouvinte(metros);
    });

    palco.aoMudarZoom(ajustarPesos);

    return {
        desenhar(novo: Grafo, vagas: readonly DadosDaVaga[]): void {
            grafo = novo;
            dados.clear();
            for (const vaga of vagas) dados.set(vaga.noId, vaga);
            camadaDeArestas.destroyChildren();
            camadaDeNos.destroyChildren();
            grupos.clear();
            setas.clear();
            docas.clear();
            pesos.clear();

            angulos.clear();
            for (const no of grafo.nodes) {
                if (no.role !== 'candidate') continue;
                angulos.set(no.id, anguloDeDesenho(grafo, no, dados.get(no.id)));
            }

            for (const no of grafo.nodes) {
                const grupo = desenharNo(no, angulos.get(no.id) ?? 0, dados.get(no.id));
                grupo.on('click', () => {
                    definirSelecao({ tipo: 'no', id: no.id });
                    for (const ouvinte of clicados) ouvinte(no.id);
                });
                tornarArrastavel(grupo, no.id);
                camadaDeNos.add(grupo);
                grupos.set(no.id, grupo);
            }
            for (const aresta of grafo.edges) desenharUmaAresta(aresta);
            for (const no of grafo.nodes) {
                if (no.role !== 'candidate') continue;
                desenharUmaDoca(no);
            }

            esquecerSelecaoMorta();
            ajustarPesos();
            aplicarRealce();

            // Desenho síncrono, não `batchDraw`. Quem decide qual forma recebe
            // o clique é o canvas de acerto do Konva, e adiá-lo para o próximo
            // quadro abre uma janela em que o nó já está no modelo mas ainda
            // não recebe ponteiro. Aqui isso custa pouco: a cena só é refeita
            // quando o grafo muda, não a cada quadro.
            palco.camadaConteudo.draw();
        },
        enquadrar(): void {
            const caixa = caixaDoGrafo(grafo, FOLGA_DO_ENQUADRAMENTO);
            if (caixa === null) return;
            palco.enquadrar(caixa);
            ajustarPesos();
        },
        selecionar: definirSelecao,

        // O redesenho não é enfeite: enquanto a camada não ouve, o Konva deixa
        // de atualizar o canvas de acerto, e sem isto os nós desenhados nesse
        // meio-tempo continuariam invisíveis ao clique quando ela voltar a ouvir.
        modo(novo: ModoDaCena): void {
            arrastavel = novo === 'selecionar';
            for (const grupo of grupos.values()) grupo.draggable(arrastavel);

            palco.camadaConteudo.listening(novo !== 'criar');
            palco.camadaConteudo.draw();
        },

        aoSelecionar: (ouvinte) => ouvintes.push(ouvinte),
        aoClicarNoNo: (ouvinte) => clicados.push(ouvinte),
        aoArrastarNo: (ouvinte) => arrastados.push(ouvinte),
        aoClicarNoVazio: (ouvinte) => vazios.push(ouvinte),
    };
}
