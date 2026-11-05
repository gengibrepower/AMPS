import { LARGURA_DA_FAIXA } from './geometria';
import { acharNo, anguloDeDesenho, caixaDoGrafo } from './modelo';
import {
    ASFALTO,
    ENTRADA,
    ENTRADA_FUNDO,
    FUNDO_POR_TIPO,
    OCUPADA_FUNDO,
    PAPEL,
    POI,
    POI_FUNDO,
    VAGA_FUNDO,
    VAGA_TRACO,
} from './render/tinta';
import type { DadosDaVaga, Grafo } from './tipos';

const FOLGA = 2;
const TRACO_DA_VAGA = 0.18;
const RAIO_DO_MARCO = 1.1;

function n(valor: number): string {
    return String(Math.round(valor * 100) / 100);
}

function corredores(grafo: Grafo): string[] {
    const vistos = new Set<string>();
    const linhas: string[] = [];

    for (const aresta of grafo.edges) {
        const de = acharNo(grafo, aresta.from);
        const para = acharNo(grafo, aresta.to);
        if (de === null || para === null) continue;
        if (de.role === 'candidate' || para.role === 'candidate') continue;

        const chave = [de.id, para.id].sort().join('\u0000');
        if (vistos.has(chave)) continue;
        vistos.add(chave);

        const maoDupla = grafo.edges.some((outra) => outra.from === para.id && outra.to === de.id);
        const largura = maoDupla ? LARGURA_DA_FAIXA * 2 : LARGURA_DA_FAIXA;
        linhas.push(
            `<line x1="${n(de.position.x)}" y1="${n(de.position.y)}" x2="${n(para.position.x)}" y2="${n(para.position.y)}" stroke-width="${n(largura)}"/>`,
        );
    }
    return linhas;
}

function vagas(grafo: Grafo, dados: ReadonlyMap<string, DadosDaVaga>): string[] {
    return grafo.nodes.flatMap((no) => {
        if (no.role !== 'candidate') return [];
        const vaga = dados.get(no.id);
        const graus = (anguloDeDesenho(grafo, no, vaga) * 180) / Math.PI;
        const fundo = vaga?.status === 'ocupada'
            ? OCUPADA_FUNDO
            : FUNDO_POR_TIPO[vaga?.tipo ?? 'comum'] ?? VAGA_FUNDO;
        const { width, length } = no.dimensions;
        return [
            `<rect x="${n(-width / 2)}" y="${n(-length / 2)}" width="${n(width)}" height="${n(length)}" fill="${fundo}" transform="translate(${n(no.position.x)} ${n(no.position.y)}) rotate(${n(graus)})"/>`,
        ];
    });
}

function marcos(grafo: Grafo): string[] {
    return grafo.nodes.flatMap((no) => {
        if (no.role === 'source') {
            return [`<circle cx="${n(no.position.x)}" cy="${n(no.position.y)}" r="${RAIO_DO_MARCO}" fill="${ENTRADA_FUNDO}" stroke="${ENTRADA}"/>`];
        }
        if (no.role === 'attractor') {
            return [`<circle cx="${n(no.position.x)}" cy="${n(no.position.y)}" r="${RAIO_DO_MARCO}" fill="${POI_FUNDO}" stroke="${POI}"/>`];
        }
        return [];
    });
}

// A planta do pátio em SVG, na tinta do mapa grande: corredor, vaga pintada
// pelo tipo e pela ocupação, entrada e ponto de interesse. Sem número nem
// seta, porque no tamanho de um card eles viram ruído. Só entra número e cor
// constante na marcação, nada que venha de texto do usuário.
export function desenharMiniatura(
    grafo: Grafo,
    dados: readonly DadosDaVaga[],
): string | null {
    const caixa = caixaDoGrafo(grafo, FOLGA);
    if (caixa === null) return null;

    const porNo = new Map(dados.map((vaga) => [vaga.noId, vaga]));
    const largura = caixa.maxX - caixa.minX;
    const altura = caixa.maxY - caixa.minY;

    return [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(caixa.minX)} ${n(caixa.minY)} ${n(largura)} ${n(altura)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">`,
        `<rect x="${n(caixa.minX - largura)}" y="${n(caixa.minY - altura)}" width="${n(largura * 3)}" height="${n(altura * 3)}" fill="${PAPEL}"/>`,
        `<g stroke="${ASFALTO}" stroke-linecap="square">${corredores(grafo).join('')}</g>`,
        `<g stroke="${VAGA_TRACO}" stroke-width="${TRACO_DA_VAGA}">${vagas(grafo, porNo).join('')}</g>`,
        `<g stroke-width="0.3">${marcos(grafo).join('')}</g>`,
        '</svg>',
    ].join('');
}
