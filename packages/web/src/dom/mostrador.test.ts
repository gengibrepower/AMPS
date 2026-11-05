import { describe, expect, it } from 'vitest';
import {
    COMPRIMENTO_DO_ARCO,
    TAMANHO_COM_ESCALA,
    desenharMostrador,
    estadoDaOcupacao,
    ocupacao,
} from './mostrador';

function atributo(svg: string, classe: string, nome: string): string | undefined {
    const elemento = new RegExp(`<[^>]*class="${classe}"[^>]*>`).exec(svg)?.[0];
    return elemento === undefined ? undefined : new RegExp(`${nome}="([^"]*)"`).exec(elemento)?.[1];
}

function pontaDoPonteiro(svg: string): { x: number; y: number } {
    const caminho = atributo(svg, 'mostrador-ponteiro', 'd') ?? '';
    const [, x, y] = /L(-?[\d.]+) (-?[\d.]+)/.exec(caminho) ?? [];
    return { x: Number(x), y: Number(y) };
}

describe('estadoDaOcupacao', () => {
    it('fica normal até 84% ocupado', () => {
        expect(estadoDaOcupacao(100, 100)).toBe('normal');
        expect(estadoDaOcupacao(16, 100)).toBe('normal');
    });

    it('passa a quase cheio em 85% e fica nele até sobrar uma vaga', () => {
        expect(estadoDaOcupacao(15, 100)).toBe('quase-cheio');
        expect(estadoDaOcupacao(1, 100)).toBe('quase-cheio');
    });

    it('só é lotado quando não sobra vaga nenhuma', () => {
        expect(estadoDaOcupacao(0, 100)).toBe('lotado');
        expect(estadoDaOcupacao(0, 3)).toBe('lotado');
    });

    it('não chama de lotado um pátio sem vagas', () => {
        expect(estadoDaOcupacao(0, 0)).toBe('normal');
    });
});

describe('ocupacao', () => {
    it('é a fração de vagas sem carro livre', () => {
        expect(ocupacao(12, 48)).toBe(0.75);
    });

    it('aceita entrada fora do esperado sem passar de 0 a 1', () => {
        expect(ocupacao(60, 48)).toBe(0);
        expect(ocupacao(-3, 48)).toBe(1);
        expect(ocupacao(Number.NaN, 48)).toBe(1);
        expect(ocupacao(5, 0)).toBe(0);
    });
});

describe('desenharMostrador', () => {
    it('preenche o arco na proporção da ocupação', () => {
        const svg = desenharMostrador({ livres: 12, total: 48, tamanho: 120 });
        const [cheio] = (atributo(svg, 'mostrador-arco', 'stroke-dasharray') ?? '').split(' ');

        expect(Number(cheio)).toBeCloseTo(COMPRIMENTO_DO_ARCO * 0.75, 1);
    });

    it('pinta o arco de tinta, âmbar e vermelho conforme o estado', () => {
        expect(atributo(desenharMostrador({ livres: 40, total: 48, tamanho: 120 }), 'mostrador-arco', 'stroke')).toBe('#1A1A17');
        expect(atributo(desenharMostrador({ livres: 5, total: 48, tamanho: 120 }), 'mostrador-arco', 'stroke')).toBe('#E3A23B');
        expect(atributo(desenharMostrador({ livres: 0, total: 48, tamanho: 120 }), 'mostrador-arco', 'stroke')).toBe('#8C2F2B');
    });

    it('não desenha arco nenhum com o pátio vazio', () => {
        expect(desenharMostrador({ livres: 48, total: 48, tamanho: 120 })).not.toContain('mostrador-arco');
    });

    it('deita o ponteiro à esquerda vazio, em pé pela metade e à direita lotado', () => {
        const vazio = pontaDoPonteiro(desenharMostrador({ livres: 10, total: 10, tamanho: 120 }));
        const metade = pontaDoPonteiro(desenharMostrador({ livres: 5, total: 10, tamanho: 120 }));
        const lotado = pontaDoPonteiro(desenharMostrador({ livres: 0, total: 10, tamanho: 120 }));

        expect(vazio).toEqual({ x: 22, y: 62 });
        expect(metade).toEqual({ x: 60, y: 24 });
        expect(lotado).toEqual({ x: 98, y: 62 });
    });

    it('marca o estado na classe do SVG para a página estilizar em volta', () => {
        expect(desenharMostrador({ livres: 0, total: 8, tamanho: 120 })).toContain('class="mostrador mostrador-lotado"');
    });

    it('diz livres, total e o estado por escrito, não só pela cor', () => {
        expect(desenharMostrador({ livres: 12, total: 48, tamanho: 120 })).toContain('aria-label="12 de 48 vagas livres"');
        expect(desenharMostrador({ livres: 2, total: 48, tamanho: 120 })).toContain('aria-label="2 de 48 vagas livres, quase cheio"');
        expect(desenharMostrador({ livres: 0, total: 48, tamanho: 120 })).toContain('aria-label="0 de 48 vagas livres, lotado"');
    });

    it('mostra 0 e o total nas pontas só a partir do tamanho com escala', () => {
        const pequeno = desenharMostrador({ livres: 12, total: 48, tamanho: TAMANHO_COM_ESCALA - 1 });
        const grande = desenharMostrador({ livres: 12, total: 48, tamanho: TAMANHO_COM_ESCALA });

        expect(pequeno).not.toContain('<text');
        expect(grande).toContain('>0</text>');
        expect(grande).toContain('>48</text>');
    });

    it('guarda a proporção do desenho no tamanho pedido', () => {
        const svg = desenharMostrador({ livres: 1, total: 2, tamanho: 240 });

        expect(svg).toContain('width="240"');
        expect(svg).toContain('height="140"');
    });
});
