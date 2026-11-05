// Paleta do desenho. O canvas é papel: fundo claro e traço escuro, como a
// planta impressa, porque é o que se lê melhor para editar e no celular sob o
// sol. Os valores são passos claros do Radix Colors e não leem o vars.css: o
// Konva pinta no canvas, sem CSS. Todo preenchimento é opaco, para a vaga não
// misturar com a grade e o asfalto por baixo, e todo traço fica acima de 3:1
// contra o que tem ao lado (WCAG 1.4.11).
export const PAPEL = '#FBFDFC';

export const GRADE_FINA = 'rgba(26, 33, 30, 0.06)';
export const GRADE_GROSSA = 'rgba(26, 33, 30, 0.14)';
export const EIXO = 'rgba(32, 131, 104, 0.45)';

export const ASFALTO = '#DFE2E0';
export const ASFALTO_SELECIONADO = '#D5EFFF';
export const MEIO_FIO = '#7C8481';
export const MEIO_FIO_SELECIONADO = '#0D74CE';
export const PINTURA = '#5F6563';

export const VAGA_TRACO = '#1A211E';
export const VAGA_FUNDO = '#FFFFFF';

export const OCUPADA_FUNDO = '#FDBDBE';

export const ENTRADA = '#208368';
export const ENTRADA_FUNDO = '#D6F1E3';

export const POI = '#AB6400';
export const POI_FUNDO = '#FFEE9C';

export const VIA = '#5F6563';
export const VIA_FUNDO = '#FFFFFF';

export const SELECIONADO = '#0D74CE';

export const RECUSADO = '#CE2C31';
export const RECUSADO_FUNDO = '#FFDBDC';

export const PESO = '#1A211E';

// Hachura por tipo de vaga: a tinta do traço continua a mesma, muda o fundo.
export const FUNDO_POR_TIPO: Record<string, string> = {
    comum: VAGA_FUNDO,
    pcd: '#C2E5FF',
    idoso: '#FBE577',
    moto: '#C9E8CA',
    eletrico: '#B8EAE0',
};

export const NUMERO_DA_VAGA = '#1A211E';

// A vaga recomendada é a única coisa da planta pintada com o verde da marca; o
// traço grosso e escuro é o que a separa do papel, já que o verde sozinho dá
// 2,3:1 nele.
export const RECOMENDADA_FUNDO = '#09C382';
export const RECOMENDADA_TRACO = '#1D3B31';
export const ROTA = '#208368';
export const ROTA_CONTORNO = '#FFFFFF';
