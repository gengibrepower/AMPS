export type EstadoDaOcupacao = 'normal' | 'quase-cheio' | 'lotado';

export interface Mostrador {
    readonly livres: number;
    readonly total: number;
    readonly tamanho: number;
}

const OURO = '#B08A3E';
const OURO_TEXTO = '#7A5C1E';
const AREIA = '#E9DEC4';
const TINTA = '#1A1A17';
const AMBAR = '#E3A23B';
const LOTADO = '#8C2F2B';

const COR_DO_ARCO: Record<EstadoDaOcupacao, string> = {
    normal: TINTA,
    'quase-cheio': AMBAR,
    lotado: LOTADO,
};

const LARGURA = 120;
const ALTURA = 70;
const CX = 60;
const CY = 62;
const RAIO_DO_ARCO = 46;
const RAIO_DO_PONTEIRO = 38;
export const COMPRIMENTO_DO_ARCO = Math.PI * RAIO_DO_ARCO;
export const TAMANHO_COM_ESCALA = 160;
const QUASE_CHEIO = 0.85;

function n(valor: number): string {
    return String(Math.round(valor * 100) / 100);
}

function arco(raio: number): string {
    return `M${n(CX - raio)} ${CY}A${raio} ${raio} 0 0 1 ${n(CX + raio)} ${CY}`;
}

function contagem(livres: number, total: number): { livres: number; total: number } {
    const inteiro = (valor: number) => (Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0);
    const totalValido = inteiro(total);
    return { livres: Math.min(inteiro(livres), totalValido), total: totalValido };
}

export function ocupacao(livres: number, total: number): number {
    const valido = contagem(livres, total);
    return valido.total === 0 ? 0 : (valido.total - valido.livres) / valido.total;
}

export function estadoDaOcupacao(livres: number, total: number): EstadoDaOcupacao {
    const valido = contagem(livres, total);
    if (valido.total > 0 && valido.livres === 0) return 'lotado';
    return ocupacao(livres, total) >= QUASE_CHEIO ? 'quase-cheio' : 'normal';
}

const ESCRITO: Record<EstadoDaOcupacao, string> = {
    normal: '',
    'quase-cheio': ', quase cheio',
    lotado: ', lotado',
};

// O SVG leva só número e cor constante, nada vindo de texto do usuário, e por
// isso pode entrar por innerHTML.
export function desenharMostrador({ livres, total, tamanho }: Mostrador): string {
    const valido = contagem(livres, total);
    const fracao = ocupacao(livres, total);
    const estado = estadoDaOcupacao(livres, total);
    const angulo = Math.PI * (1 - fracao);
    const pontaX = CX + RAIO_DO_PONTEIRO * Math.cos(angulo);
    const pontaY = CY - RAIO_DO_PONTEIRO * Math.sin(angulo);
    const rotulo = `${valido.livres} de ${valido.total} vagas livres${ESCRITO[estado]}`;

    const partes = [
        `<path d="${arco(60)}" fill="none" stroke="${OURO}" stroke-width="1"/>`,
        `<path d="${arco(56)}" fill="none" stroke="${OURO}" stroke-width="1"/>`,
        `<path d="${arco(52)}" fill="none" stroke="${OURO}" stroke-width="3" stroke-dasharray="1.2 6.96"/>`,
        `<path d="${arco(RAIO_DO_ARCO)}" fill="none" stroke="${AREIA}" stroke-width="7"/>`,
    ];
    if (fracao > 0) {
        partes.push(
            `<path class="mostrador-arco" d="${arco(RAIO_DO_ARCO)}" fill="none" stroke="${COR_DO_ARCO[estado]}" stroke-width="7" stroke-dasharray="${n(COMPRIMENTO_DO_ARCO * fracao)} ${n(COMPRIMENTO_DO_ARCO)}"/>`,
        );
    }
    partes.push(
        `<path class="mostrador-ponteiro" d="M${CX} ${CY}L${n(pontaX)} ${n(pontaY)}" stroke="${TINTA}" stroke-width="1.6" stroke-linecap="round"/>`,
        `<circle cx="${CX}" cy="${CY}" r="4" fill="${OURO}"/>`,
    );
    if (tamanho >= TAMANHO_COM_ESCALA) {
        partes.push(
            `<text x="6" y="70" font-family="Josefin Sans, sans-serif" font-size="6" fill="${OURO_TEXTO}">0</text>`,
            `<text x="114" y="70" text-anchor="end" font-family="Josefin Sans, sans-serif" font-size="6" fill="${OURO_TEXTO}">${valido.total}</text>`,
        );
    }

    return `<svg class="mostrador mostrador-${estado}" viewBox="0 0 ${LARGURA} ${ALTURA}" width="${n(tamanho)}" height="${n((tamanho * ALTURA) / LARGURA)}" role="img" aria-label="${rotulo}">${partes.join('')}</svg>`;
}
