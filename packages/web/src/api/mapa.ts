import type { EstacionamentoWire } from './estacionamentos';
import { pedirAutenticado } from './http';

export interface VagaWire {
    readonly id: number;
    readonly no_id: string;
    readonly numero: string;
    readonly tipo: string;
    readonly rotacao_graus: number;
    readonly sensor: string | null;
    readonly status: string;
    readonly carro_id: number | null;
}

// O grafo vem como está no banco, na forma que o Merlian aceita: a API não
// transforma nada, e o front também não deve.
export interface MapaWire {
    readonly versao: number;
    readonly grafo: unknown;
    readonly vagas: readonly VagaWire[];
}

export function carregarMapa(estacionamentoId: number): Promise<MapaWire> {
    return pedirAutenticado<MapaWire>(`/estacionamentos/${estacionamentoId}/mapa`);
}

// O corpo do PUT de topologia **é** o grafo, na mesma forma que vai para o
// Merlian: nada de envelope.
export interface TopologiaResposta {
    readonly estacionamento_id: number;
    readonly versao: number;
}

export function gravarTopologia(
    estacionamentoId: number,
    grafo: unknown,
): Promise<TopologiaResposta> {
    return pedirAutenticado<TopologiaResposta>(`/estacionamentos/${estacionamentoId}/topologia`, {
        method: 'PUT',
        body: JSON.stringify(grafo),
    });
}

export interface VagaParaGravar {
    readonly no_id: string;
    readonly numero: string;
    readonly tipo: string;
    readonly rotacao_graus: number;
    readonly sensor: string | null;
}

export function gravarVagas(
    estacionamentoId: number,
    vagas: readonly VagaParaGravar[],
): Promise<readonly VagaWire[]> {
    return pedirAutenticado<readonly VagaWire[]>(`/estacionamentos/${estacionamentoId}/vagas`, {
        method: 'PUT',
        body: JSON.stringify(vagas),
    });
}

// 204 sem corpo; o 422 vem quando a vaga não está livre. O `no_id` é escapado
// porque nada garante que ele seja seguro numa URL: os que o editor gera são,
// mas pátio importado traz o id que quiser.
export function apagarVaga(estacionamentoId: number, noId: string): Promise<null> {
    const caminho = `/estacionamentos/${estacionamentoId}/vagas/${encodeURIComponent(noId)}`;
    return pedirAutenticado<null>(caminho, { method: 'DELETE' });
}

// A RN-11 inteira é conferida na API: entrada, vaga e POI ali, alcançabilidade
// no Merlian. O front só mostra o que voltou.
export function publicar(estacionamentoId: number): Promise<EstacionamentoWire> {
    return pedirAutenticado<EstacionamentoWire>(`/estacionamentos/${estacionamentoId}/publicacao`, {
        method: 'POST',
    });
}

export function despublicar(estacionamentoId: number): Promise<EstacionamentoWire> {
    return pedirAutenticado<EstacionamentoWire>(`/estacionamentos/${estacionamentoId}/publicacao`, {
        method: 'DELETE',
    });
}
