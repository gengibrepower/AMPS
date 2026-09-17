import { ForbiddenError, NotFoundError } from '../errors.js';
import type {
	DonoRegistrado,
	DonoRepository,
	Estacionamento,
	EstacionamentoRepository,
} from '../ports.js';

// O token carrega o id do usuario, mas estacionamentos.dono_id aponta para
// donos.id: toda a RN-10 depende dessa tradução, feita num lugar só.
export class AcessoDono {
	constructor(
		private readonly donos: DonoRepository,
		private readonly estacionamentos: EstacionamentoRepository,
	) {}

	async dono(usuarioId: number): Promise<DonoRegistrado> {
		const dono = await this.donos.findByUsuarioId(usuarioId);
		if (dono === null) {
			throw new ForbiddenError('usuario nao e dono');
		}
		return dono;
	}

	async estacionamento(usuarioId: number, estacionamentoId: number): Promise<Estacionamento> {
		const dono = await this.dono(usuarioId);
		const estacionamento = await this.estacionamentos.findById(estacionamentoId);
		if (estacionamento === null) {
			throw new NotFoundError('estacionamento');
		}
		if (estacionamento.donoId !== dono.id) {
			throw new ForbiddenError('estacionamento de outro dono');
		}
		return estacionamento;
	}
}
