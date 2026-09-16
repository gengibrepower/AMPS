import { hashPassword } from '../security/password.js';
import type { Usuario, UsuarioRepository } from '../ports.js';

export interface CadastroUsuario {
	readonly nome: string;
	readonly email: string;
	readonly cpf: string;
	readonly senha: string;
}

export class UsuarioService {
	constructor(private readonly usuarios: UsuarioRepository) {}

	async cadastrar(dados: CadastroUsuario): Promise<Usuario> {
		return this.usuarios.create({
			nome: dados.nome,
			email: dados.email,
			cpf: dados.cpf,
			senhaHash: await hashPassword(dados.senha),
			tipoConta: 'common_user',
		});
	}
}
