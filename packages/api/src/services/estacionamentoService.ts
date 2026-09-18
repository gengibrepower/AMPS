import type { Endereco, Estacionamento, EstacionamentoRepository } from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

export interface CadastroEstacionamento {
	readonly nome: string;
	readonly endereco: Endereco;
}

export class EstacionamentoService {
	constructor(
		private readonly estacionamentos: EstacionamentoRepository,
		private readonly acesso: AcessoDono,
	) {}

	async cadastrar(usuarioId: number, dados: CadastroEstacionamento): Promise<Estacionamento> {
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
}
