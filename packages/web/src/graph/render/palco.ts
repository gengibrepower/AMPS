import Konva from 'konva';
import {
    PIXELS_POR_METRO,
    ajusteParaCaixa,
    faixaVisivel,
    metrosParaPixels,
    pixelsParaMetros,
} from '../geometria';
import type { Caixa, Ponto } from '../geometria';
import { EIXO, GRADE_FINA, GRADE_GROSSA } from './tinta';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;
const PASSO_ZOOM = 1.12;

const PASSO_FINO = 1;
const PASSO_GROSSO = 5;

// Abaixo disso a grade de 1 m vira ruído cinza: some e ficam só os 5 m.
const ESPACAMENTO_MINIMO = 14;

// Respiro entre o desenho e a borda da tela ao enquadrar.
const MARGEM = 60;

// Arrasto do botão esquerdo só vira deslocamento depois deste tanto de pixel;
// abaixo disso continua sendo clique, senão selecionar fica impossível.
export const LIMIAR_DO_ARRASTO = 4;

// O mesmo limiar vale para arrastar um nó: os dois dividem o botão esquerdo, e
// quem decide se aquilo foi clique ou arrasto tem que ser um só.
Konva.dragDistance = LIMIAR_DO_ARRASTO;

export interface Palco {
    readonly stage: Konva.Stage;
    readonly camadaConteudo: Konva.Layer;
    zoom(): number;
    arrastouAgora(): boolean;
    emMetros(tela: Ponto): Ponto;
    enquadrar(caixa: Caixa): void;
    aoMoverPonteiro(ouvinte: (metros: Ponto | null) => void): void;
    aoMudarZoom(ouvinte: (zoom: number) => void): void;
}

function limitar(zoom: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

function desenharGrade(contexto: Konva.Context, stage: Konva.Stage): void {
    const zoom = stage.scaleX();
    const escala = PIXELS_POR_METRO * zoom;
    const horizontal = faixaVisivel(-stage.x(), stage.width(), escala, PASSO_GROSSO);
    const vertical = faixaVisivel(-stage.y(), stage.height(), escala, PASSO_GROSSO);

    const esquerda = metrosParaPixels(horizontal.de);
    const direita = metrosParaPixels(horizontal.ate);
    const topo = metrosParaPixels(vertical.de);
    const base = metrosParaPixels(vertical.ate);

    // Traço de 1 px na tela, independente do zoom.
    contexto.setAttr('lineWidth', 1 / zoom);

    const passos = escala * PASSO_FINO >= ESPACAMENTO_MINIMO
        ? [PASSO_FINO, PASSO_GROSSO]
        : [PASSO_GROSSO];

    for (const passo of passos) {
        contexto.setAttr('strokeStyle', passo === PASSO_FINO ? GRADE_FINA : GRADE_GROSSA);
        contexto.beginPath();
        for (let m = horizontal.de; m <= horizontal.ate; m += passo) {
            if (passo === PASSO_FINO && m % PASSO_GROSSO === 0) continue;
            contexto.moveTo(metrosParaPixels(m), topo);
            contexto.lineTo(metrosParaPixels(m), base);
        }
        for (let m = vertical.de; m <= vertical.ate; m += passo) {
            if (passo === PASSO_FINO && m % PASSO_GROSSO === 0) continue;
            contexto.moveTo(esquerda, metrosParaPixels(m));
            contexto.lineTo(direita, metrosParaPixels(m));
        }
        contexto.stroke();
    }

    contexto.setAttr('strokeStyle', EIXO);
    contexto.beginPath();
    contexto.moveTo(esquerda, 0);
    contexto.lineTo(direita, 0);
    contexto.moveTo(0, topo);
    contexto.lineTo(0, base);
    contexto.stroke();
}

export function criarPalco(container: HTMLDivElement): Palco {
    const stage = new Konva.Stage({
        container,
        width: container.clientWidth,
        height: container.clientHeight,
        x: 80,
        y: 80,
    });

    const camadaGrade = new Konva.Layer({ listening: false });
    const camadaConteudo = new Konva.Layer();
    const grade = new Konva.Shape({
        listening: false,
        sceneFunc: (contexto) => desenharGrade(contexto, stage),
    });

    camadaGrade.add(grade);
    stage.add(camadaGrade, camadaConteudo);

    const ouvintesDePonteiro: ((metros: Ponto | null) => void)[] = [];
    const ouvintesDeZoom: ((zoom: number) => void)[] = [];

    function redesenhar(): void {
        camadaGrade.batchDraw();
        camadaConteudo.batchDraw();
    }

    function emMetros(tela: Ponto): Ponto {
        const zoom = stage.scaleX();
        return {
            x: pixelsParaMetros((tela.x - stage.x()) / zoom),
            y: pixelsParaMetros((tela.y - stage.y()) / zoom),
        };
    }

    new ResizeObserver(() => {
        stage.size({ width: container.clientWidth, height: container.clientHeight });
        redesenhar();
    }).observe(container);

    // Roda de mouse dá zoom; dois dedos no trackpad deslocam. Não há como
    // perguntar ao navegador qual aparelho é: a pista é que trackpad manda
    // delta em pixel, costuma ter eixo x e valores pequenos ou fracionários,
    // enquanto a roda manda passos grandes e inteiros só no eixo y. Pinça chega
    // como ctrl+roda nos dois.
    function ehRodaDeMouse(evento: WheelEvent): boolean {
        if (evento.deltaMode !== 0) return true;
        if (evento.deltaX !== 0) return false;
        return Math.abs(evento.deltaY) >= 40 && Number.isInteger(evento.deltaY);
    }

    function deslocar(dx: number, dy: number): void {
        stage.position({ x: stage.x() + dx, y: stage.y() + dy });
        redesenhar();
    }

    container.addEventListener('wheel', (evento: WheelEvent) => {
        evento.preventDefault();

        if (!evento.ctrlKey && !ehRodaDeMouse(evento)) {
            deslocar(-evento.deltaX, -evento.deltaY);
            return;
        }

        const ponteiro = stage.getPointerPosition();
        if (ponteiro === null) return;

        const anterior = stage.scaleX();
        const novo = limitar(evento.deltaY < 0 ? anterior * PASSO_ZOOM : anterior / PASSO_ZOOM);
        if (novo === anterior) return;

        // Mantém sob o cursor o mesmo ponto do mundo antes e depois do zoom.
        const mundo = {
            x: (ponteiro.x - stage.x()) / anterior,
            y: (ponteiro.y - stage.y()) / anterior,
        };
        stage.scale({ x: novo, y: novo });
        stage.position({ x: ponteiro.x - mundo.x * novo, y: ponteiro.y - mundo.y * novo });

        redesenhar();
        for (const ouvinte of ouvintesDeZoom) ouvinte(novo);
    }, { passive: false });

    let espacoPressionado = false;
    let arrastandoDe: Ponto | null = null;
    let candidatoAArrasto: Ponto | null = null;
    let arrastou = false;

    function atualizarCursor(): void {
        container.style.cursor = arrastandoDe !== null
            ? 'grabbing'
            : espacoPressionado ? 'grab' : 'default';
    }

    // Quem acabou de arrastar não quis clicar: a cena pergunta antes de limpar
    // a seleção.
    function arrastouAgora(): boolean {
        return arrastou;
    }

    window.addEventListener('keydown', (evento: KeyboardEvent) => {
        if (evento.code !== 'Space' || espacoPressionado) return;
        espacoPressionado = true;
        evento.preventDefault();
        atualizarCursor();
    });

    window.addEventListener('keyup', (evento: KeyboardEvent) => {
        if (evento.code !== 'Space') return;
        espacoPressionado = false;
        atualizarCursor();
    });

    function noVazio(): boolean {
        const ponteiro = stage.getPointerPosition();
        return ponteiro !== null && stage.getIntersection(ponteiro) === null;
    }

    container.addEventListener('mousedown', (evento: MouseEvent) => {
        const daqui = { x: evento.clientX, y: evento.clientY };
        arrastou = false;

        if (evento.button === 1 || (evento.button === 0 && espacoPressionado)) {
            evento.preventDefault();
            arrastandoDe = daqui;
            atualizarCursor();
            return;
        }

        // Botão esquerdo no vazio ainda pode virar clique: só vira arrasto se o
        // ponteiro andar. Assim o editor não depende do foco do teclado.
        if (evento.button === 0 && noVazio()) {
            candidatoAArrasto = daqui;
        }
    });

    window.addEventListener('mousemove', (evento: MouseEvent) => {
        if (arrastandoDe === null && candidatoAArrasto !== null) {
            const andou = Math.hypot(
                evento.clientX - candidatoAArrasto.x,
                evento.clientY - candidatoAArrasto.y,
            );
            if (andou < LIMIAR_DO_ARRASTO) return;
            arrastandoDe = candidatoAArrasto;
            arrastou = true;
            atualizarCursor();
        }
        if (arrastandoDe === null) return;

        deslocar(evento.clientX - arrastandoDe.x, evento.clientY - arrastandoDe.y);
        arrastandoDe = { x: evento.clientX, y: evento.clientY };
    });

    window.addEventListener('mouseup', () => {
        arrastandoDe = null;
        candidatoAArrasto = null;
        atualizarCursor();
    });

    stage.on('mousemove', () => {
        const ponteiro = stage.getPointerPosition();
        const metros = ponteiro === null ? null : emMetros(ponteiro);
        for (const ouvinte of ouvintesDePonteiro) ouvinte(metros);
    });

    container.addEventListener('mouseleave', () => {
        for (const ouvinte of ouvintesDePonteiro) ouvinte(null);
    });

    redesenhar();

    return {
        stage,
        camadaConteudo,
        zoom: () => stage.scaleX(),
        arrastouAgora,
        emMetros,
        enquadrar(caixa: Caixa): void {
            const ajuste = ajusteParaCaixa(
                caixa,
                stage.width(),
                stage.height(),
                MARGEM,
                ZOOM_MIN,
                ZOOM_MAX,
            );
            stage.scale({ x: ajuste.zoom, y: ajuste.zoom });
            stage.position({ x: ajuste.x, y: ajuste.y });
            redesenhar();
            for (const ouvinte of ouvintesDeZoom) ouvinte(ajuste.zoom);
        },
        aoMoverPonteiro: (ouvinte) => ouvintesDePonteiro.push(ouvinte),
        aoMudarZoom: (ouvinte) => ouvintesDeZoom.push(ouvinte),
    };
}
