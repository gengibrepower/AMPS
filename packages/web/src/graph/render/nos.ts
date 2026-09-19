import Konva from 'konva';
import { metrosParaPixels, recuoNaCaixa } from '../geometria';
import type { Ponto } from '../geometria';
import type { DadosDaVaga, No, Papel } from '../tipos';
import {
    ENTRADA,
    FUNDO_POR_TIPO,
    NUMERO_DA_VAGA,
    ENTRADA_FUNDO,
    POI,
    POI_FUNDO,
    RECUSADO,
    RECUSADO_FUNDO,
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

// Altura do número pintado na vaga, em metros: é pintura de chão, então
// acompanha o zoom como o resto.
const ALTURA_DO_NUMERO = 0.9;

function forma(no: No, dados: DadosDaVaga | undefined): Konva.Shape {
    const estilo = ESTILO[no.role];
    const comum = {
        fill: no.role === 'candidate' && dados !== undefined
            ? FUNDO_POR_TIPO[dados.tipo] ?? estilo.preenchimento
            : estilo.preenchimento,
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

export function desenharNo(
    no: No,
    angulo = 0,
    dados: DadosDaVaga | undefined = undefined,
): Konva.Group {
    const grupo = new Konva.Group({
        x: metrosParaPixels(no.position.x),
        y: metrosParaPixels(no.position.y),
        rotation: (angulo * 180) / Math.PI,
        name: no.id,
    });
    const desenho = forma(no, dados);
    grupo.setAttr('preenchimento', desenho.fill());
    grupo.add(desenho);

    if (dados !== undefined) {
        const numero = new Konva.Text({
            name: 'numero',
            text: dados.numero,
            fontSize: metrosParaPixels(ALTURA_DO_NUMERO),
            fontFamily: 'ui-monospace, monospace',
            fill: NUMERO_DA_VAGA,
            listening: false,
            rotation: -(angulo * 180) / Math.PI,
        });
        numero.offsetX(numero.width() / 2);
        numero.offsetY(numero.height() / 2);
        grupo.add(numero);
    }
    return grupo;
}

export function mostrarNumeros(grupo: Konva.Group, visivel: boolean): void {
    grupo.findOne<Konva.Text>('.numero')?.visible(visivel);
}

// Recusado vence a seleção: enquanto a publicação aponta o problema, é ele que
// o dono precisa enxergar, mesmo com a vaga selecionada.
export function realcarNo(
    grupo: Konva.Group,
    papel: Papel,
    selecionado: boolean,
    recusado = false,
): void {
    const desenho = grupo.findOne<Konva.Shape>('Shape');
    if (desenho === undefined) return;

    if (recusado) {
        desenho.stroke(RECUSADO);
        desenho.strokeWidth(ESTILO[papel].espessura + 1.5);
        desenho.fill(RECUSADO_FUNDO);
        return;
    }

    desenho.stroke(selecionado ? SELECIONADO : ESTILO[papel].traco);
    desenho.strokeWidth(selecionado ? ESTILO[papel].espessura + 1.5 : ESTILO[papel].espessura);
    desenho.fill(grupo.getAttr('preenchimento') as string);
}
