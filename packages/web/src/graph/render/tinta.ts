// Paleta do desenho. O canvas é papel: fundo claro e traço escuro, como a
// planta impressa, porque é o que se lê melhor para editar e no celular sob o
// sol. Os valores repetem a paleta da garagem de 1930
// (docs/08-identidade-visual.md) e não leem o vars.css: o Konva pinta no
// canvas, sem CSS. Todo preenchimento é opaco, para a vaga não
// misturar com a grade e o asfalto por baixo, e todo traço fica acima de 3:1
// contra o que tem ao lado (WCAG 1.4.11).
export const PAPEL = '#FBF8EF';

export const GRADE_FINA = 'rgba(26, 26, 23, 0.06)';
export const GRADE_GROSSA = 'rgba(26, 26, 23, 0.14)';
export const EIXO = 'rgba(176, 138, 62, 0.5)';

export const ASFALTO = '#E9E1CF';
export const ASFALTO_SELECIONADO = '#DCE6DD';
export const MEIO_FIO = '#7E776A';
export const MEIO_FIO_SELECIONADO = '#2F4F3A';
export const PINTURA = '#5E5A50';

export const VAGA_TRACO = '#1A1A17';
export const VAGA_FUNDO = '#FBF8EF';

export const OCUPADA_FUNDO = '#1A1A17';

export const ENTRADA = '#2F4F3A';
export const ENTRADA_FUNDO = '#DCE6DD';

export const POI = '#7A5C1E';
export const POI_FUNDO = '#F3E2B3';

export const VIA = '#5E5A50';
export const VIA_FUNDO = '#FBF8EF';

export const SELECIONADO = '#2F4F3A';

export const RECUSADO = '#8C2F2B';
export const RECUSADO_FUNDO = '#F2DEDA';

export const PESO = '#1A1A17';

// Hachura por tipo de vaga: a tinta do traço continua a mesma, muda o fundo.
export const FUNDO_POR_TIPO: Record<string, string> = {
    comum: VAGA_FUNDO,
    pcd: '#CFDCE8',
    idoso: '#EFDFAE',
    moto: '#D6DEC8',
    eletrico: '#CFE3DC',
};

export const NUMERO_DA_VAGA = '#1A1A17';
export const NUMERO_DA_VAGA_OCUPADA = '#F4EEDF';

// A vaga recomendada e a rota são as únicas coisas da planta em ouro. O ouro
// dá 2,8:1 no papel, então o que o separa dele é a tinta: traço grosso na
// vaga e um contorno escuro, mais largo, por baixo da rota.
export const RECOMENDADA_FUNDO = '#B08A3E';
export const RECOMENDADA_TRACO = '#1A1A17';
export const ROTA = '#B08A3E';
export const ROTA_CONTORNO = '#1A1A17';
