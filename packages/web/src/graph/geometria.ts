// O modelo vive em metros; pixel só existe na hora de desenhar. Esta é a única
// fronteira entre as duas unidades.
export const PIXELS_POR_METRO = 20;

export interface Ponto {
    readonly x: number;
    readonly y: number;
}

export function metrosParaPixels(metros: number): number {
    return metros * PIXELS_POR_METRO;
}

export function pixelsParaMetros(pixels: number): number {
    return pixels / PIXELS_POR_METRO;
}

export interface Faixa {
    readonly de: number;
    readonly ate: number;
}

// Faixa de metros visível num eixo, esticada até o múltiplo do passo da grade
// para fora dos dois lados — assim a linha da borda não some ao arrastar.
export function faixaVisivel(
    inicioPx: number,
    tamanhoPx: number,
    escala: number,
    passo: number,
): Faixa {
    const de = inicioPx / escala;
    const ate = (inicioPx + tamanhoPx) / escala;
    return {
        de: Math.floor(de / passo) * passo,
        ate: Math.ceil(ate / passo) * passo,
    };
}

export interface Segmento {
    readonly de: Ponto;
    readonly para: Ponto;
}

// Traço de uma aresta: recuado nas duas pontas para a seta encostar na borda do
// nó, e desviado na perpendicular para que a ida e a volta não se sobreponham.
export function segmento(
    a: Ponto,
    b: Ponto,
    recuoA: number,
    recuoB: number,
    desvio: number,
): Segmento {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const comprimento = Math.hypot(dx, dy);

    if (comprimento === 0 || comprimento <= recuoA + recuoB) {
        const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return { de: meio, para: meio };
    }

    const ux = dx / comprimento;
    const uy = dy / comprimento;
    // Perpendicular que acompanha o sentido: a volta cai do outro lado sozinha.
    const px = -uy * desvio;
    const py = ux * desvio;

    return {
        de: { x: a.x + ux * recuoA + px, y: a.y + uy * recuoA + py },
        para: { x: b.x - ux * recuoB + px, y: b.y - uy * recuoB + py },
    };
}

// Distância do centro de uma caixa até a borda, na direção dada. É o que faz a
// seta parar na quina certa de uma vaga retangular em vez de invadi-la.
export function recuoNaCaixa(meiaLargura: number, meioComprimento: number, direcao: Ponto): number {
    const dx = Math.abs(direcao.x);
    const dy = Math.abs(direcao.y);
    if (dx === 0 && dy === 0) return 0;

    const ateLado = dx === 0 ? Infinity : meiaLargura / dx;
    const ateTopo = dy === 0 ? Infinity : meioComprimento / dy;
    return Math.min(ateLado, ateTopo);
}

export function direcao(de: Ponto, para: Ponto): Ponto {
    const dx = para.x - de.x;
    const dy = para.y - de.y;
    const comprimento = Math.hypot(dx, dy);
    return comprimento === 0 ? { x: 0, y: 0 } : { x: dx / comprimento, y: dy / comprimento };
}

export interface Caixa {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
}

export interface Enquadramento {
    readonly zoom: number;
    readonly x: number;
    readonly y: number;
}

// Zoom e deslocamento que colocam a caixa inteira dentro da tela, centrada.
export function ajusteParaCaixa(
    caixa: Caixa,
    largura: number,
    altura: number,
    margem: number,
    zoomMin: number,
    zoomMax: number,
): Enquadramento {
    const larguraDaCaixa = metrosParaPixels(caixa.maxX - caixa.minX);
    const alturaDaCaixa = metrosParaPixels(caixa.maxY - caixa.minY);
    const disponivel = { x: Math.max(1, largura - margem * 2), y: Math.max(1, altura - margem * 2) };

    const cabe = larguraDaCaixa > 0 || alturaDaCaixa > 0
        ? Math.min(
            larguraDaCaixa > 0 ? disponivel.x / larguraDaCaixa : Infinity,
            alturaDaCaixa > 0 ? disponivel.y / alturaDaCaixa : Infinity,
        )
        : 1;
    const zoom = Math.min(zoomMax, Math.max(zoomMin, cabe));

    const centro = {
        x: metrosParaPixels((caixa.minX + caixa.maxX) / 2),
        y: metrosParaPixels((caixa.minY + caixa.maxY) / 2),
    };
    return { zoom, x: largura / 2 - centro.x * zoom, y: altura / 2 - centro.y * zoom };
}

// Pontos igualmente espaçados ao longo de um traço, centrados: é onde entram as
// setas pintadas no corredor.
export function pontosAoLongo(de: Ponto, para: Ponto, passo: number): Ponto[] {
    const comprimento = Math.hypot(para.x - de.x, para.y - de.y);
    if (comprimento === 0 || passo <= 0) return [];

    const quantos = Math.floor(comprimento / passo);
    if (quantos === 0) return [{ x: (de.x + para.x) / 2, y: (de.y + para.y) / 2 }];

    const ux = (para.x - de.x) / comprimento;
    const uy = (para.y - de.y) / comprimento;
    const sobra = (comprimento - (quantos - 1) * passo) / 2;

    const pontos: Ponto[] = [];
    for (let i = 0; i < quantos; i++) {
        const distancia = sobra + i * passo;
        pontos.push({ x: de.x + ux * distancia, y: de.y + uy * distancia });
    }
    return pontos;
}

// Ponto do segmento mais perto de um ponto solto, preso às pontas: é onde a
// vaga encosta no corredor.
export function projecaoNoSegmento(ponto: Ponto, de: Ponto, para: Ponto): Ponto {
    const dx = para.x - de.x;
    const dy = para.y - de.y;
    const quadrado = dx * dx + dy * dy;
    if (quadrado === 0) return de;

    const t = ((ponto.x - de.x) * dx + (ponto.y - de.y) * dy) / quadrado;
    const preso = Math.min(1, Math.max(0, t));
    return { x: de.x + dx * preso, y: de.y + dy * preso };
}
