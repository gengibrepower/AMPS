// Paleta do desenho: o pátio à noite, asfalto escuro e pintura clara. Os
// valores são passos do Radix Colors (sage, blue, amber, red, teal) e de
// propósito não leem o vars.css: o Konva pinta no canvas, sem CSS. Todo traço
// fica acima de 3:1 contra o que tem ao lado (WCAG 1.4.11); o asfalto contra o
// papel é só preenchimento, quem marca a borda da via é o meio-fio.
export const PAPEL = '#101211';

export const GRADE_FINA = 'rgba(236, 238, 237, 0.05)';
export const GRADE_GROSSA = 'rgba(236, 238, 237, 0.11)';
export const EIXO = 'rgba(9, 195, 130, 0.45)';

export const ASFALTO = '#272A29';
export const ASFALTO_SELECIONADO = '#0D2847';
export const MEIO_FIO = '#63706B';
export const MEIO_FIO_SELECIONADO = '#70B8FF';
export const PINTURA = '#ADB5B2';

export const VAGA_TRACO = '#ADB5B2';
export const VAGA_FUNDO = '#171918';

export const OCUPADA_FUNDO = 'rgba(229, 72, 77, 0.32)';

export const ENTRADA = '#09C382';
export const ENTRADA_FUNDO = 'rgba(9, 195, 130, 0.16)';

export const POI = '#FFCA16';
export const POI_FUNDO = 'rgba(255, 202, 22, 0.14)';

export const VIA = '#ADB5B2';
export const VIA_FUNDO = '#171918';

export const SELECIONADO = '#70B8FF';

export const RECUSADO = '#FF9592';
export const RECUSADO_FUNDO = 'rgba(229, 72, 77, 0.2)';

export const PESO = '#ECEEED';

// Hachura por tipo de vaga: a tinta do traço continua a mesma, muda o fundo.
export const FUNDO_POR_TIPO: Record<string, string> = {
    comum: VAGA_FUNDO,
    pcd: 'rgba(0, 144, 255, 0.24)',
    idoso: 'rgba(255, 197, 61, 0.2)',
    moto: 'rgba(9, 195, 130, 0.16)',
    eletrico: 'rgba(18, 165, 148, 0.24)',
};

export const NUMERO_DA_VAGA = '#ADB5B2';
