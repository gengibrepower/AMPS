import Konva from 'konva';
import { metrosParaPixels, pontosAoLongo, segmento } from '../geometria';
import type { Ponto } from '../geometria';
import {
    ASFALTO,
    ASFALTO_SELECIONADO,
    MEIO_FIO,
    MEIO_FIO_SELECIONADO,
    PINTURA,
    SELECIONADO,
} from './tinta';

// Tudo aqui está em metros, como o resto do modelo: o corredor é desenhado na
// largura de verdade, senão a vaga parece desproporcional ao lado dele.
const LARGURA_DA_FAIXA = 3.2;
const DESVIO_DA_MAO_DUPLA = LARGURA_DA_FAIXA / 2;

// Setas pintadas ao longo do corredor, para o sentido ser legível em qualquer
// trecho e não só na ponta. Compridas e finas, como as do asfalto.
interface Seta {
    readonly passo: number;
    readonly haste: number;
    readonly ponta: number;
    readonly meiaLargura: number;
    readonly traco: number;
}

const SETA_DO_CORREDOR: Seta = {
    passo: 5,
    haste: 2.2,
    ponta: 0.6,
    meiaLargura: 0.3,
    traco: 0.1,
};

const SETA_DO_ACESSO: Seta = {
    passo: Infinity,
    haste: 1,
    ponta: 0.35,
    meiaLargura: 0.2,
    traco: 0.08,
};

const ACESSO_TRACEJADO = 0.35;

export interface DesenhoDaAresta {
    readonly de: Ponto;
    readonly para: Ponto;
    readonly recuoDe: number;
    readonly recuoPara: number;
    readonly maoDupla: boolean;
    readonly corredor: boolean;
}

function perpendicular(de: Ponto, para: Ponto): Ponto {
    const dx = para.x - de.x;
    const dy = para.y - de.y;
    const comprimento = Math.hypot(dx, dy);
    return comprimento === 0 ? { x: 0, y: 0 } : { x: -dy / comprimento, y: dx / comprimento };
}

function avancoDe(normal: Ponto): Ponto {
    return { x: normal.y, y: -normal.x };
}

function pintarSetas(
    contexto: Konva.Context,
    de: Ponto,
    para: Ponto,
    cor: string,
    seta: Seta,
): void {
    const normal = perpendicular(de, para);
    const avanco = avancoDe(normal);

    contexto.setAttr('strokeStyle', cor);
    contexto.setAttr('lineWidth', metrosParaPixels(seta.traco));
    contexto.setAttr('lineCap', 'round');
    contexto.setAttr('lineJoin', 'round');
    contexto.setAttr('lineDash', []);
    contexto.beginPath();

    // Em trecho curto a seta inteira não cabe e vazaria para cima do nó vizinho.
    const comprimento = Math.hypot(para.x - de.x, para.y - de.y);
    const encolhe = Math.min(1, (comprimento * 0.75) / seta.haste);

    for (const ponto of pontosAoLongo(de, para, seta.passo)) {
        const meia = (seta.haste * encolhe) / 2;
        const ponta = { x: ponto.x + avanco.x * meia, y: ponto.y + avanco.y * meia };
        const cauda = { x: ponto.x - avanco.x * meia, y: ponto.y - avanco.y * meia };
        const recuoDaPonta = seta.ponta * encolhe;
        const ombro = {
            x: ponta.x - avanco.x * recuoDaPonta,
            y: ponta.y - avanco.y * recuoDaPonta,
        };

        contexto.moveTo(metrosParaPixels(cauda.x), metrosParaPixels(cauda.y));
        contexto.lineTo(metrosParaPixels(ponta.x), metrosParaPixels(ponta.y));
        const aba = seta.meiaLargura * encolhe;
        for (const lado of [aba, -aba]) {
            contexto.moveTo(
                metrosParaPixels(ombro.x + normal.x * lado),
                metrosParaPixels(ombro.y + normal.y * lado),
            );
            contexto.lineTo(metrosParaPixels(ponta.x), metrosParaPixels(ponta.y));
        }
    }
    contexto.stroke();
}

function pintarCorredor(
    contexto: Konva.Context,
    de: Ponto,
    para: Ponto,
    selecionado: boolean,
): void {
    const normal = perpendicular(de, para);
    const meia = LARGURA_DA_FAIXA / 2;

    const quina = (ponto: Ponto, lado: number): Ponto => ({
        x: ponto.x + normal.x * lado,
        y: ponto.y + normal.y * lado,
    });

    // Pavimento opaco: a grade não atravessa o corredor, como no papel.
    contexto.setAttr('fillStyle', selecionado ? ASFALTO_SELECIONADO : ASFALTO);
    contexto.beginPath();
    for (const [i, ponto] of [
        quina(de, meia),
        quina(para, meia),
        quina(para, -meia),
        quina(de, -meia),
    ].entries()) {
        const x = metrosParaPixels(ponto.x);
        const y = metrosParaPixels(ponto.y);
        if (i === 0) contexto.moveTo(x, y);
        else contexto.lineTo(x, y);
    }
    contexto.closePath();
    contexto.fill();

    contexto.setAttr('strokeStyle', selecionado ? MEIO_FIO_SELECIONADO : MEIO_FIO);
    contexto.setAttr('lineWidth', selecionado ? 2 : 1);
    contexto.setAttr('lineDash', []);
    contexto.beginPath();
    for (const lado of [meia, -meia]) {
        const inicio = quina(de, lado);
        const fim = quina(para, lado);
        contexto.moveTo(metrosParaPixels(inicio.x), metrosParaPixels(inicio.y));
        contexto.lineTo(metrosParaPixels(fim.x), metrosParaPixels(fim.y));
    }
    contexto.stroke();

    pintarSetas(contexto, de, para, selecionado ? SELECIONADO : PINTURA, SETA_DO_CORREDOR);
}

function pintarAcesso(contexto: Konva.Context, de: Ponto, para: Ponto, selecionado: boolean): void {
    const cor = selecionado ? SELECIONADO : MEIO_FIO;
    contexto.setAttr('strokeStyle', cor);
    contexto.setAttr('lineWidth', selecionado ? 2 : 1);
    contexto.setAttr('lineCap', 'butt');
    contexto.setAttr('lineDash', [
        metrosParaPixels(ACESSO_TRACEJADO),
        metrosParaPixels(ACESSO_TRACEJADO),
    ]);
    contexto.beginPath();
    contexto.moveTo(metrosParaPixels(de.x), metrosParaPixels(de.y));
    contexto.lineTo(metrosParaPixels(para.x), metrosParaPixels(para.y));
    contexto.stroke();
    contexto.setAttr('lineDash', []);

    // Uma seta só, menor: o acesso é curto e não precisa de pintura repetida.
    pintarSetas(contexto, de, para, cor, SETA_DO_ACESSO);
}

export function desenharAresta(desenho: DesenhoDaAresta): Konva.Group {
    const linha = segmento(
        desenho.de,
        desenho.para,
        desenho.recuoDe,
        desenho.recuoPara,
        desenho.maoDupla && desenho.corredor ? DESVIO_DA_MAO_DUPLA : 0,
    );

    const pintura = new Konva.Shape({
        name: 'pintura',
        listening: false,
        sceneFunc: (contexto, atual) => {
            const escolhida = atual.getAttr('selecionada') === true;
            if (desenho.corredor) pintarCorredor(contexto, linha.de, linha.para, escolhida);
            else pintarAcesso(contexto, linha.de, linha.para, escolhida);
        },
    });

    // Área de toque à parte: forma com sceneFunc próprio não entra no grafo de
    // acerto do Konva, então quem recebe o clique é esta linha invisível.
    const toque = new Konva.Line({
        points: [
            metrosParaPixels(linha.de.x),
            metrosParaPixels(linha.de.y),
            metrosParaPixels(linha.para.x),
            metrosParaPixels(linha.para.y),
        ],
        stroke: 'transparent',
        strokeWidth: metrosParaPixels(desenho.corredor ? LARGURA_DA_FAIXA : 1.2),
    });

    const grupo = new Konva.Group();
    grupo.add(pintura, toque);
    grupo.setAttr('meio', {
        x: metrosParaPixels((linha.de.x + linha.para.x) / 2),
        y: metrosParaPixels((linha.de.y + linha.para.y) / 2),
    });
    grupo.setAttr('normal', perpendicular(linha.de, linha.para));
    grupo.setAttr('corredor', desenho.corredor);
    return grupo;
}

// Onde o peso da aresta deve ficar: fora da faixa, não em cima da pintura.
export function ladoDoTraco(grupo: Konva.Group): Ponto {
    const meio = grupo.getAttr('meio') as Ponto;
    const normal = grupo.getAttr('normal') as Ponto;
    const fora = grupo.getAttr('corredor') === true ? LARGURA_DA_FAIXA / 2 + 0.8 : 0.9;
    const afastamento = metrosParaPixels(fora);
    return { x: meio.x + normal.x * afastamento, y: meio.y + normal.y * afastamento };
}

export function realcarAresta(grupo: Konva.Group, selecionada: boolean): void {
    grupo.findOne<Konva.Shape>('.pintura')?.setAttr('selecionada', selecionada);
}

// Toco que liga o meio-fio à vaga, no ponto em que ela realmente encosta. Some
// sozinho quando a vaga está encostada na via, que é o caso normal na planta.
export function desenharDoca(
    noMeioFio: Ponto,
    naVaga: Ponto,
    selecionada: boolean,
): Konva.Shape {
    return new Konva.Shape({
        listening: false,
        sceneFunc: (contexto) => {
            contexto.setAttr('strokeStyle', selecionada ? SELECIONADO : MEIO_FIO);
            contexto.setAttr('lineWidth', selecionada ? 2 : 1);
            contexto.setAttr('lineCap', 'butt');
            contexto.setAttr('lineDash', [
                metrosParaPixels(ACESSO_TRACEJADO),
                metrosParaPixels(ACESSO_TRACEJADO),
            ]);
            contexto.beginPath();
            contexto.moveTo(metrosParaPixels(noMeioFio.x), metrosParaPixels(noMeioFio.y));
            contexto.lineTo(metrosParaPixels(naVaga.x), metrosParaPixels(naVaga.y));
            contexto.stroke();
            contexto.setAttr('lineDash', []);
        },
    });
}

// Distância do eixo do corredor até o meio-fio, em metros.
export function meioFioEmMetros(maoDupla: boolean): number {
    return maoDupla ? LARGURA_DA_FAIXA : LARGURA_DA_FAIXA / 2;
}
