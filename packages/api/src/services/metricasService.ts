import type {
	Estacionamento,
	StatusVaga,
	TipoVaga,
	TopologiaRepository,
	Vaga,
	VagaRepository,
} from '../ports.js';
import type { AcessoDono } from './acessoDono.js';

const TIPOS: readonly TipoVaga[] = ['comum', 'pcd', 'idoso', 'moto', 'eletrico'];

export interface ContagemPorTipo {
	readonly tipo: TipoVaga;
	readonly total: number;
	readonly livres: number;
}

export interface Metricas {
	readonly estacionamento: Estacionamento;
	readonly versaoDesenho: number;
	readonly vagas: Readonly<Record<StatusVaga, number>> & { readonly total: number };
	// null quando não há vaga: 0% sugeriria um pátio vazio, não um sem vagas.
	readonly taxaOcupacao: number | null;
	readonly porTipo: readonly ContagemPorTipo[];
	readonly comSensor: number;
	readonly desenho: {
		readonly entradas: number;
		readonly pontosDeInteresse: number;
		readonly vagasDesenhadas: number;
		readonly conexoes: number;
	};
	readonly vagasSemCadastro: number;
}

interface GrafoLido {
	readonly nodes?: readonly { readonly id?: string; readonly role?: string }[];
	readonly edges?: readonly unknown[];
}

export function calcularMetricas(
	estacionamento: Estacionamento,
	versaoDesenho: number,
	grafo: unknown,
	vagas: readonly Vaga[],
): Metricas {
	const contagem = { livre: 0, ocupada: 0, reservada: 0 };
	for (const vaga of vagas) contagem[vaga.status] += 1;

	const porTipo = TIPOS.map((tipo) => {
		const doTipo = vagas.filter((vaga) => vaga.tipo === tipo);
		return {
			tipo,
			total: doTipo.length,
			livres: doTipo.filter((vaga) => vaga.status === 'livre').length,
		};
	}).filter((linha) => linha.total > 0);

	const { nodes = [], edges = [] } = (grafo ?? {}) as GrafoLido;
	const papel = (role: string): number => nodes.filter((no) => no.role === role).length;
	const cadastradas = new Set(vagas.map((vaga) => vaga.noId));

	return {
		estacionamento,
		versaoDesenho,
		vagas: { total: vagas.length, ...contagem },
		taxaOcupacao:
			vagas.length === 0 ? null : (contagem.ocupada + contagem.reservada) / vagas.length,
		porTipo,
		comSensor: vagas.filter((vaga) => vaga.sensor !== null).length,
		desenho: {
			entradas: papel('source'),
			pontosDeInteresse: papel('attractor'),
			vagasDesenhadas: papel('candidate'),
			conexoes: edges.length,
		},
		vagasSemCadastro: nodes.filter(
			(no) => no.role === 'candidate' && !cadastradas.has(no.id ?? ''),
		).length,
	};
}

export class MetricasService {
	constructor(
		private readonly topologias: TopologiaRepository,
		private readonly vagas: VagaRepository,
		private readonly acesso: AcessoDono,
	) {}

	async calcular(usuarioId: number, estacionamentoId: number): Promise<Metricas> {
		const estacionamento = await this.acesso.estacionamento(usuarioId, estacionamentoId);
		const topologia = await this.topologias.findByEstacionamento(estacionamento.id);
		const vagas = await this.vagas.listByEstacionamento(estacionamento.id);

		return calcularMetricas(estacionamento, topologia?.versao ?? 0, topologia?.grafo, vagas);
	}
}
