import { ForbiddenError } from '../errors.js';
import type {
	DonoRegistrado,
	DonoRepository,
	Endereco,
	Estacionamento,
	EstacionamentoRepository,
} from '../ports.js';

export interface CadastroEstacionamento {
	readonly nome: string;
	readonly endereco: Endereco;
}

export class EstacionamentoService {
	constructor(
		private readonly estacionamentos: EstacionamentoRepository,
		private readonly donos: DonoRepository,
	) {}

	async cadastrar(usuarioId: number, dados: CadastroEstacionamento): Promise<Estacionamento> {
		const dono = await this.donoDoUsuario(usuarioId);
		return this.estacionamentos.create({
			donoId: dono.id,
			nome: dados.nome,
			endereco: dados.endereco,
		});
	}

	async listarDoDono(usuarioId: number): Promise<readonly Estacionamento[]> {
		const dono = await this.donoDoUsuario(usuarioId);
		return this.estacionamentos.listByDono(dono.id);
	}

	// O token carrega o id do usuario, mas estacionamentos.dono_id aponta para
	// donos.id: a RN-10 depende dessa tradução, e sem linha em donos não há acesso.
	private async donoDoUsuario(usuarioId: number): Promise<DonoRegistrado> {
		const dono = await this.donos.findByUsuarioId(usuarioId);
		if (dono === null) {
			throw new ForbiddenError('usuario nao e dono');
		}
		return dono;
	}
}
