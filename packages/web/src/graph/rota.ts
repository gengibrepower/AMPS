import { LARGURA_DA_FAIXA } from './geometria';
import type { Ponto } from './geometria';
import { acharNo, docaDaVaga } from './modelo';
import type { Grafo } from './tipos';

interface Trecho {
    readonly de: Ponto;
    readonly para: Ponto;
    readonly desvio: number;
}

const MEIO_DA_FAIXA = LARGURA_DA_FAIXA / 2;

function maoDupla(grafo: Grafo, de: string, para: string): boolean {
    return grafo.edges.some((aresta) => aresta.from === para && aresta.to === de);
}

// A mesma regra do desenho da via (`segmento`): a perpendicular acompanha o
// sentido, e com o eixo y para baixo ela cai à direita de quem dirige.
function deslocado(ponto: Ponto, trecho: Trecho): Ponto {
    const dx = trecho.para.x - trecho.de.x;
    const dy = trecho.para.y - trecho.de.y;
    const comprimento = Math.hypot(dx, dy);
    if (comprimento === 0 || trecho.desvio === 0) return ponto;
    return {
        x: ponto.x - (dy / comprimento) * trecho.desvio,
        y: ponto.y + (dx / comprimento) * trecho.desvio,
    };
}

// Onde dois trechos deslocados se encontram: o cruzamento das duas retas. Em
// trechos paralelos não há cruzamento, e vale o ponto deslocado do seguinte.
function quina(anterior: Trecho, seguinte: Trecho): Ponto {
    const a1 = deslocado(anterior.de, anterior);
    const a2 = deslocado(anterior.para, anterior);
    const b1 = deslocado(seguinte.de, seguinte);
    const b2 = deslocado(seguinte.para, seguinte);

    const da = { x: a2.x - a1.x, y: a2.y - a1.y };
    const db = { x: b2.x - b1.x, y: b2.y - b1.y };
    const cruz = da.x * db.y - da.y * db.x;
    if (Math.abs(cruz) < 1e-9) return b1;

    const t = ((b1.x - a1.x) * db.y - (b1.y - a1.y) * db.x) / cruz;
    return { x: a1.x + da.x * t, y: a1.y + da.y * t };
}

function trechosDaRota(grafo: Grafo, ids: readonly string[]): Trecho[] {
    const trechos: Trecho[] = [];
    let anterior: { readonly id: string; readonly ponto: Ponto } | null = null;

    for (const id of ids) {
        const no = acharNo(grafo, id);
        if (no === null) continue;

        if (no.role === 'candidate' && anterior !== null) {
            const doca = docaDaVaga(grafo, no);
            if (doca !== null) {
                const meioComprimento = no.dimensions.length / 2;
                const frente = {
                    x: no.position.x - doca.paraFora.x * meioComprimento,
                    y: no.position.y - doca.paraFora.y * meioComprimento,
                };
                trechos.push(
                    { de: anterior.ponto, para: doca.ponto, desvio: doca.maoDupla ? MEIO_DA_FAIXA : 0 },
                    { de: doca.ponto, para: frente, desvio: 0 },
                );
                anterior = { id, ponto: frente };
                continue;
            }
        }

        if (anterior !== null) {
            const desvio = maoDupla(grafo, anterior.id, id) ? MEIO_DA_FAIXA : 0;
            trechos.push({ de: anterior.ponto, para: no.position, desvio });
        }
        anterior = { id, ponto: no.position };
    }

    return trechos.filter((trecho) => trecho.de.x !== trecho.para.x || trecho.de.y !== trecho.para.y);
}

// O caminho corre pela faixa do sentido em que o carro anda: na mão dupla, a
// da direita. Na vaga ele não corta em diagonal até o centro: segue pela via
// até o ponto onde ela encosta e termina na frente da vaga, por onde o carro
// entra.
export function pontosDaRota(grafo: Grafo, ids: readonly string[]): Ponto[] {
    const trechos = trechosDaRota(grafo, ids);
    const primeiro = trechos[0];
    const ultimo = trechos[trechos.length - 1];
    if (primeiro === undefined || ultimo === undefined) return [];

    const pontos: Ponto[] = [deslocado(primeiro.de, primeiro)];
    for (let i = 1; i < trechos.length; i++) {
        pontos.push(quina(trechos[i - 1]!, trechos[i]!));
    }
    pontos.push(deslocado(ultimo.para, ultimo));
    return pontos;
}
