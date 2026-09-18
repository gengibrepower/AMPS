// Paleta do desenho. O canvas é papel: fundo claro, traço escuro, como a planta
// impressa. A interface em volta (vars.css) continua escura.
export const PAPEL = '#FFFFFF';

export const GRADE_FINA = 'rgba(17, 19, 22, 0.07)';
export const GRADE_GROSSA = 'rgba(17, 19, 22, 0.16)';
export const EIXO = 'rgba(23, 114, 76, 0.45)';

export const ASFALTO = '#ECEEF1';
export const ASFALTO_SELECIONADO = '#DCE8FB';
export const MEIO_FIO = '#9AA1AA';
export const MEIO_FIO_SELECIONADO = '#1A73E8';
export const PINTURA = '#5C636C';

export const VAGA_TRACO = '#2B3038';
export const VAGA_FUNDO = '#FFFFFF';

export const ENTRADA = '#0E7A4E';
export const ENTRADA_FUNDO = 'rgba(14, 122, 78, 0.16)';

export const POI = '#B07400';
export const POI_FUNDO = 'rgba(176, 116, 0, 0.16)';

export const VIA = '#5C636C';
export const VIA_FUNDO = '#FFFFFF';

export const SELECIONADO = '#1A73E8';

export const PESO = '#3C4249';

// Hachura por tipo de vaga: a tinta do traço continua a mesma, muda o fundo.
export const FUNDO_POR_TIPO: Record<string, string> = {
    comum: VAGA_FUNDO,
    pcd: 'rgba(26, 115, 232, 0.16)',
    idoso: 'rgba(176, 116, 0, 0.16)',
    moto: 'rgba(14, 122, 78, 0.14)',
    eletrico: 'rgba(0, 150, 136, 0.16)',
};

export const NUMERO_DA_VAGA = '#5C636C';
