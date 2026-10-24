import type { EstacionamentoWire } from './estacionamentos';
import { pedirAutenticado } from './http';

export interface ContagemPorTipoWire {
    readonly tipo: string;
    readonly total: number;
    readonly livres: number;
}

export interface MetricasWire {
    readonly estacionamento: EstacionamentoWire;
    readonly versao_desenho: number;
    readonly vagas: {
        readonly total: number;
        readonly livre: number;
        readonly ocupada: number;
        readonly reservada: number;
    };
    readonly taxa_ocupacao: number | null;
    readonly por_tipo: readonly ContagemPorTipoWire[];
    readonly com_sensor: number;
    readonly desenho: {
        readonly entradas: number;
        readonly pontos_de_interesse: number;
        readonly vagas_desenhadas: number;
        readonly conexoes: number;
    };
    readonly vagas_sem_cadastro: number;
}

export function carregarMetricas(estacionamentoId: number): Promise<MetricasWire> {
    return pedirAutenticado<MetricasWire>(`/estacionamentos/${estacionamentoId}/metricas`);
}
