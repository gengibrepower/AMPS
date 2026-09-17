import type { TopologiaRepository, Vaga, VagaRepository } from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

export interface Mapa {
	readonly versao: number;
	readonly grafo: unknown;
	readonly vagas: readonly Vaga[];
}

// Estacionamento recem-criado ainda nao tem topologia, e o editor abre num
// grafo vazio em vez de num 404.
const GRAFO_VAZIO = { nodes: [], edges: [] };

export class MapaService {
	constructor(
		private readonly topologias: TopologiaRepository,
		private readonly vagas: VagaRepository,
		private readonly acesso: AcessoDono,
	) {}

	async carregar(usuarioId: number, estacionamentoId: number): Promise<Mapa> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		const topologia = await this.topologias.findByEstacionamento(estacionamento.id);
		const vagas = await this.vagas.listByEstacionamento(estacionamento.id);

		return {
			versao: topologia?.versao ?? 0,
			grafo: topologia?.grafo ?? GRAFO_VAZIO,
			vagas,
		};
	}
}
