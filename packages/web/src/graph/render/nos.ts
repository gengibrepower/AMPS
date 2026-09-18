import Konva from 'konva';
import { metrosParaPixels, recuoNaCaixa } from '../geometria';
import type { Ponto } from '../geometria';
import type { No, Papel } from '../tipos';
import {
    ENTRADA,
    ENTRADA_FUNDO,
    POI,
    POI_FUNDO,
    SELECIONADO,
    VAGA_FUNDO,
    VAGA_TRACO,
    VIA,
    VIA_FUNDO,
} from './tinta';

interface Estilo {
    readonly traco: string;
    readonly preenchimento: string;
    readonly espessura: number;
}

const ESTILO: Record<Papel, Estilo> = {
    candidate: { traco: VAGA_TRACO, preenchimento: VAGA_FUNDO, espessura: 1.2 },
    source: { traco: ENTRADA, preenchimento: ENTRADA_FUNDO, espessura: 2 },
    attractor: { traco: POI, preenchimento: POI_FUNDO, espessura: 2 },
    transit: { traco: VIA, preenchimento: VIA_FUNDO, espessura: 1.5 },
};

// Tamanho em metros dos nós sem dimensão própria. Também em escala: a entrada e
// o POI são marcos do pátio, a via é um ponto no meio do corredor.
const RAIO_ENTRADA = 1.3;
const RAIO_POI = 1.3;
const RAIO_VIA = 0.55;

// Onde a seta da aresta deve parar, em metros, saindo do nó na direção dada. A
// vaga é retangular: o recuo muda conforme a aresta chega pelo lado ou pela
// frente.
export function recuoDoNo(no: No, saida: Ponto, angulo = 0): number {
    switch (no.role) {
        case 'candidate': {
            // A direção entra no sistema da vaga, que está deitada na via.
            const cos = Math.cos(-angulo);
            const sen = Math.sin(-angulo);
            const local = {
                x: saida.x * cos - saida.y * sen,
                y: saida.x * sen + saida.y * cos,
            };
            return recuoNaCaixa(no.dimensions.width / 2, no.dimensions.length / 2, local);
        }
        case 'source':
            return RAIO_ENTRADA;
        case 'attractor':
            return RAIO_POI;
        case 'transit':
            return RAIO_VIA;
    }
}

function forma(no: No): Konva.Shape {
    const estilo = ESTILO[no.role];
    const comum = {
        fill: estilo.preenchimento,
        stroke: estilo.traco,
        strokeScaleEnabled: false,
        strokeWidth: estilo.espessura,
    };

    if (no.role === 'candidate') {
        const largura = metrosParaPixels(no.dimensions.width);
        const comprimento = metrosParaPixels(no.dimensions.length);
        return new Konva.Rect({
            ...comum,
            width: largura,
            height: comprimento,
            offsetX: largura / 2,
            offsetY: comprimento / 2,
        });
    }

    if (no.role === 'source') {
        return new Konva.RegularPolygon({
            ...comum,
            sides: 3,
            radius: metrosParaPixels(RAIO_ENTRADA),
        });
    }

    if (no.role === 'attractor') {
        return new Konva.RegularPolygon({
            ...comum,
            sides: 4,
            radius: metrosParaPixels(RAIO_POI),
        });
    }

    return new Konva.Circle({ ...comum, radius: metrosParaPixels(RAIO_VIA) });
}

export function desenharNo(no: No, angulo = 0): Konva.Group {
    const grupo = new Konva.Group({
        x: metrosParaPixels(no.position.x),
        y: metrosParaPixels(no.position.y),
        rotation: (angulo * 180) / Math.PI,
        name: no.id,
    });
    grupo.add(forma(no));
    return grupo;
}

export function realcarNo(grupo: Konva.Group, papel: Papel, selecionado: boolean): void {
    const desenho = grupo.findOne<Konva.Shape>('Shape');
    if (desenho === undefined) return;
    desenho.stroke(selecionado ? SELECIONADO : ESTILO[papel].traco);
    desenho.strokeWidth(selecionado ? ESTILO[papel].espessura + 1.5 : ESTILO[papel].espessura);
}
