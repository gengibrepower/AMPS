import { NotFoundError, UnprocessableError } from '../errors.js';
import type { Vaga, VagaDoEditor, VagaRepository } from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

export class VagaService {
	constructor(
		private readonly vagas: VagaRepository,
		private readonly acesso: AcessoDono,
	) {}

	async salvar(
		usuarioId: number,
		estacionamentoId: number,
		vagas: readonly VagaDoEditor[],
	): Promise<readonly Vaga[]> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		return this.vagas.upsertAll(estacionamento.id, vagas);
	}

	// Remover vaga ocupada apagaria o vinculo com o carro que esta nela, e o banco
	// nao barra isso: é regra da aplicação.
	async remover(usuarioId: number, estacionamentoId: number, noId: string): Promise<void> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		const vaga = await this.vagas.findByNoId(estacionamento.id, noId);
		if (vaga === null) {
			throw new NotFoundError('vaga');
		}
		if (vaga.status !== 'livre') {
			throw new UnprocessableError(`vaga ${vaga.numero} esta ${vaga.status}`);
		}
		await this.vagas.deleteByNoId(estacionamento.id, noId);
	}
}
