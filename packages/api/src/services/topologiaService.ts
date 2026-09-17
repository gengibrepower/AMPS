import type { Topologia, TopologiaRepository } from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

export class TopologiaService {
	constructor(
		private readonly topologias: TopologiaRepository,
		private readonly acesso: AcessoDono,
	) {}

	async salvar(
		usuarioId: number,
		estacionamentoId: number,
		grafo: unknown,
	): Promise<Topologia> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		return this.topologias.save(estacionamento.id, grafo);
	}
}
