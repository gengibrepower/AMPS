import { GRAFO_VAZIO } from '../graph/tipos';
import type { DadosDaVaga, Grafo } from '../graph/tipos';

// Grafo e vagas andam juntos porque as ferramentas mexem nos dois de uma vez:
// criar uma vaga põe um nó no grafo e uma linha em `vagas`, e desfazer tem que
// tirar os dois.
export interface Instantaneo {
    readonly grafo: Grafo;
    readonly vagas: readonly DadosDaVaga[];
}

const VAZIO: Instantaneo = { grafo: GRAFO_VAZIO, vagas: [] };

// Fundo da pilha de desfazer. Passou disso, o instantâneo mais antigo cai e o
// editor perde como provar que voltou ao que o servidor mandou.
const LIMITE = 100;

export interface Estado {
    atual(): Instantaneo;
    grafo(): Grafo;
    vagas(): readonly DadosDaVaga[];
    carregar(instantaneo: Instantaneo): void;
    mudar(proximo: Instantaneo): void;
    desfazer(): boolean;
    podeDesfazer(): boolean;
    sujo(): boolean;
    aoMudar(ouvinte: (instantaneo: Instantaneo) => void): void;
}

// Desfazer por instantâneo: o modelo é JSON puro, então `structuredClone` num
// stack resolve. De quebra, pilha vazia quer dizer exatamente "igual ao que o
// servidor mandou" — é daí que sai o estado sujo, sem comparar estrutura.
export function criarEstado(): Estado {
    let instantaneo: Instantaneo = VAZIO;
    const pilha: Instantaneo[] = [];
    const ouvintes: ((instantaneo: Instantaneo) => void)[] = [];
    let descartados = 0;

    function avisar(): void {
        for (const ouvinte of ouvintes) ouvinte(instantaneo);
    }

    return {
        atual: () => instantaneo,
        grafo: () => instantaneo.grafo,
        vagas: () => instantaneo.vagas,

        carregar(novo: Instantaneo): void {
            instantaneo = novo;
            pilha.length = 0;
            descartados = 0;
            avisar();
        },

        mudar(proximo: Instantaneo): void {
            pilha.push(structuredClone(instantaneo));
            if (pilha.length > LIMITE) {
                pilha.shift();
                descartados += 1;
            }
            instantaneo = proximo;
            avisar();
        },

        desfazer(): boolean {
            const anterior = pilha.pop();
            if (anterior === undefined) return false;
            instantaneo = anterior;
            avisar();
            return true;
        },

        podeDesfazer: () => pilha.length > 0,
        sujo: () => pilha.length > 0 || descartados > 0,
        aoMudar: (ouvinte) => ouvintes.push(ouvinte),
    };
}
