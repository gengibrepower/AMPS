import Konva from 'konva';
import { PIXELS_POR_METRO, faixaVisivel, metrosParaPixels, pixelsParaMetros } from '../geometria';
import type { Ponto } from '../geometria';

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;
const PASSO_ZOOM = 1.12;

const PASSO_FINO = 1;
const PASSO_GROSSO = 5;

// Abaixo disso a grade de 1 m vira ruído cinza: some e ficam só os 5 m.
const ESPACAMENTO_MINIMO = 14;

const COR_FINA = 'rgba(255, 255, 255, 0.05)';
const COR_GROSSA = 'rgba(255, 255, 255, 0.11)';
const COR_EIXO = 'rgba(23, 114, 76, 0.85)';

export interface Palco {
    readonly stage: Konva.Stage;
    readonly camadaConteudo: Konva.Layer;
    zoom(): number;
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
        contexto.setAttr('strokeStyle', passo === PASSO_FINO ? COR_FINA : COR_GROSSA);
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

    contexto.setAttr('strokeStyle', COR_EIXO);
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

    container.addEventListener('wheel', (evento: WheelEvent) => {
        evento.preventDefault();
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

    function atualizarCursor(): void {
        container.style.cursor = arrastandoDe !== null
            ? 'grabbing'
            : espacoPressionado ? 'grab' : 'default';
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

    container.addEventListener('mousedown', (evento: MouseEvent) => {
        const comBotaoDoMeio = evento.button === 1;
        if (!comBotaoDoMeio && !(evento.button === 0 && espacoPressionado)) return;
        evento.preventDefault();
        arrastandoDe = { x: evento.clientX, y: evento.clientY };
        atualizarCursor();
    });

    window.addEventListener('mousemove', (evento: MouseEvent) => {
        if (arrastandoDe === null) return;
        stage.position({
            x: stage.x() + evento.clientX - arrastandoDe.x,
            y: stage.y() + evento.clientY - arrastandoDe.y,
        });
        arrastandoDe = { x: evento.clientX, y: evento.clientY };
        redesenhar();
    });

    window.addEventListener('mouseup', () => {
        if (arrastandoDe === null) return;
        arrastandoDe = null;
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
        aoMoverPonteiro: (ouvinte) => ouvintesDePonteiro.push(ouvinte),
        aoMudarZoom: (ouvinte) => ouvintesDeZoom.push(ouvinte),
    };
}
