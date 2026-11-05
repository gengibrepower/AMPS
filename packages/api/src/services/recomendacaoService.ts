import { NotFoundError, UnprocessableError } from '../errors.js';
import type {
	CarroRepository,
	DimensoesDoModelo,
	EstacionamentoRepository,
	ModeloRepository,
	MotorDeGrafo,
	PedidoDeRecomendacao,
	Rota,
	TopologiaRepository,
	UsuarioRepository,
	Vaga,
	VagaRepository,
} from '../ports.js';

export interface EscolhaDoCliente {
	readonly carroId: number;
	readonly poiId: string;
	readonly entradaId: string;
}

export interface VagaRecomendada {
	readonly vaga: { readonly noId: string; readonly numero: string } | null;
	readonly rota: Rota | null;
}

interface No {
	readonly id?: unknown;
	readonly role?: unknown;
}

function nosDo(grafo: unknown): readonly No[] {
	return (grafo as { nodes?: readonly No[] }).nodes ?? [];
}

// O Merlian recomenda qualquer candidate fora da ocupação. Só a vaga comum,
// livre e cadastrada pode ser oferecida: candidate sem linha em `vagas` é
// rascunho, e PCD, idoso, moto e elétrico pedem uma condição que o AMPS ainda
// não sabe do cliente.
export function montarPedido(
	grafo: unknown,
	vagas: readonly Vaga[],
	dimensoes: DimensoesDoModelo,
	escolha: EscolhaDoCliente,
): PedidoDeRecomendacao {
	const nos = nosDo(grafo);
	const papelDe = (id: string): unknown => nos.find((no) => no.id === id)?.role;

	if (papelDe(escolha.poiId) !== 'attractor') {
		throw new UnprocessableError('destino nao e um ponto de interesse deste estacionamento');
	}
	if (papelDe(escolha.entradaId) !== 'source') {
		throw new UnprocessableError('entrada nao existe neste estacionamento');
	}

	const oferecidas = new Set(
		vagas.filter((vaga) => vaga.status === 'livre' && vaga.tipo === 'comum').map((vaga) => vaga.noId),
	);
	const indisponiveis = nos
		.filter((no) => no.role === 'candidate' && typeof no.id === 'string' && !oferecidas.has(no.id))
		.map((no) => no.id as string);

	return {
		grafo,
		veiculo: {
			largura: dimensoes.larguraMm / 1000,
			comprimento: dimensoes.comprimentoMm / 1000,
		},
		indisponiveis,
		poiId: escolha.poiId,
		entradaId: escolha.entradaId,
	};
}

export class RecomendacaoService {
	constructor(
		private readonly estacionamentos: EstacionamentoRepository,
		private readonly topologias: TopologiaRepository,
		private readonly vagas: VagaRepository,
		private readonly usuarios: UsuarioRepository,
		private readonly carros: CarroRepository,
		private readonly modelos: ModeloRepository,
		private readonly motor: MotorDeGrafo,
	) {}

	// RN-15: a recomendação é provisória. Nada é gravado aqui; reservar é do
	// check-in.
	async recomendar(
		usuarioId: number,
		estacionamentoId: number,
		escolha: EscolhaDoCliente,
	): Promise<VagaRecomendada> {
		const estacionamento = await this.estacionamentos.findById(estacionamentoId);
		if (estacionamento === null || !estacionamento.publicado) {
			throw new NotFoundError('estacionamento');
		}

		const usuario = await this.usuarios.findById(usuarioId);
		if (usuario === null) {
			throw new NotFoundError('usuario');
		}
		const carros = await this.carros.listByProprietario(usuario.nome);
		const carro = carros.find((item) => item.id === escolha.carroId);
		if (carro === undefined) {
			throw new NotFoundError('carro');
		}

		const dimensoes = await this.modelos.findDimensoes(carro.modeloId);
		if (dimensoes === null) {
			throw new NotFoundError('modelo');
		}

		const topologia = await this.topologias.findByEstacionamento(estacionamento.id);
		if (topologia === null) {
			throw new NotFoundError('estacionamento');
		}
		const vagas = await this.vagas.listByEstacionamento(estacionamento.id);

		const pedido = montarPedido(topologia.grafo, vagas, dimensoes, escolha);
		const recomendacao = await this.motor.recomendar(pedido);

		const vaga = vagas.find((item) => item.noId === recomendacao.vagaNoId);
		return {
			vaga: vaga === undefined ? null : { noId: vaga.noId, numero: vaga.numero },
			rota: vaga === undefined ? null : recomendacao.rota,
		};
	}
}
