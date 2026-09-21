import { UnprocessableError } from '../errors.js';
import type {
	DadosDoEstacionamento,
	Estacionamento,
	EstacionamentoRepository,
	VagaRepository,
} from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

export class EstacionamentoService {
	constructor(
		private readonly estacionamentos: EstacionamentoRepository,
		private readonly vagas: VagaRepository,
		private readonly acesso: AcessoDono,
	) {}

	async cadastrar(usuarioId: number, dados: DadosDoEstacionamento): Promise<Estacionamento> {
		const dono = await this.acesso.dono(usuarioId);
		return this.estacionamentos.create({
			donoId: dono.id,
			nome: dados.nome,
			endereco: dados.endereco,
		});
	}

	async buscar(usuarioId: number, estacionamentoId: number): Promise<Estacionamento> {
		return this.acesso.estacionamento(usuarioId, estacionamentoId);
	}

	async listarDoDono(usuarioId: number): Promise<readonly Estacionamento[]> {
		const dono = await this.acesso.dono(usuarioId);
		return this.estacionamentos.listByDono(dono.id);
	}

	async editar(
		usuarioId: number,
		estacionamentoId: number,
		dados: DadosDoEstacionamento,
	): Promise<Estacionamento> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		return this.estacionamentos.update(estacionamento.id, dados);
	}

	// O CASCADE do banco levaria topologia e vagas junto, carro estacionado
	// incluso. Como no VagaService.remover, quem barra isso é a aplicação.
	async remover(usuarioId: number, estacionamentoId: number): Promise<void> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);

		const vagas = await this.vagas.listByEstacionamento(estacionamento.id);
		const emUso = vagas.filter((vaga) => vaga.status !== 'livre');
		if (emUso.length > 0) {
			const numeros = emUso.map((vaga) => vaga.numero);
			throw new UnprocessableError(`vagas em uso: ${numeros.join(', ')}`, numeros);
		}

		await this.estacionamentos.delete(estacionamento.id);
	}
}
