import { UnprocessableError } from '../errors.js';
import type {
	Estacionamento,
	EstacionamentoRepository,
	MotorDeGrafo,
	TopologiaRepository,
	VagaRepository,
} from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

export class PublicacaoService {
	constructor(
		private readonly estacionamentos: EstacionamentoRepository,
		private readonly topologias: TopologiaRepository,
		private readonly vagas: VagaRepository,
		private readonly motor: MotorDeGrafo,
		private readonly acesso: AcessoDono,
	) {}

	// RN-11: só publica layout em que toda vaga tem caminho até alguma entrada.
	// Quem responde isso é o Merlian, que enxerga o grafo inteiro.
	async publicar(usuarioId: number, estacionamentoId: number): Promise<Estacionamento> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);

		const topologia = await this.topologias.findByEstacionamento(estacionamento.id);
		if (topologia === null) {
			throw new UnprocessableError('estacionamento sem topologia');
		}

		const vagas = await this.vagas.listByEstacionamento(estacionamento.id);
		if (vagas.length === 0) {
			throw new UnprocessableError('estacionamento sem vagas');
		}

		const alcance = await this.motor.alcancabilidade(topologia.grafo);
		if (alcance.porEntrada.length === 0) {
			throw new UnprocessableError('grafo sem entrada');
		}

		// O Merlian responde sobre todo candidate do grafo; aqui só importam os
		// que viraram vaga de verdade.
		const inalcancaveis = vagas.filter((vaga) =>
			alcance.vagasInalcancaveis.includes(vaga.noId),
		);
		if (inalcancaveis.length > 0) {
			const numeros = inalcancaveis.map((vaga) => vaga.numero).join(', ');
			throw new UnprocessableError(`vagas sem caminho ate uma entrada: ${numeros}`);
		}

		return this.estacionamentos.setPublicado(estacionamento.id, true);
	}

	async despublicar(usuarioId: number, estacionamentoId: number): Promise<Estacionamento> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		return this.estacionamentos.setPublicado(estacionamento.id, false);
	}
}
