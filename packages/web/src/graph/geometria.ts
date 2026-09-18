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
