import { NotFoundError } from '../errors.js';
import type { Carro, CarroRepository, UsuarioRepository } from '../ports.js';

export interface CadastroCarro {
	readonly placa: string;
	readonly modeloId: number;
}

export class CarroService {
	constructor(
		private readonly carros: CarroRepository,
		private readonly usuarios: UsuarioRepository,
	) {}

	// O proprietario não vem do corpo: é o nome do usuario dono do token.
	async cadastrar(usuarioId: number, dados: CadastroCarro): Promise<Carro> {
		const usuario = await this.usuarios.findById(usuarioId);
		if (usuario === null) {
			throw new NotFoundError('usuario');
		}

		return this.carros.create({
			placa: dados.placa,
			modeloId: dados.modeloId,
			proprietario: usuario.nome,
		});
	}
}
