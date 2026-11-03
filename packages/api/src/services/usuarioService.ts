import { NotFoundError, UnprocessableError } from '../errors.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import type { DadosDoPerfil, Usuario, UsuarioRepository } from '../ports.js';

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

	async perfil(id: number): Promise<Usuario> {
		const usuario = await this.usuarios.findById(id);
		if (usuario === null) {
			throw new NotFoundError('usuario');
		}
		return usuario;
	}

	async atualizarPerfil(id: number, dados: DadosDoPerfil): Promise<Usuario> {
		const usuario = await this.usuarios.updatePerfil(id, dados);
		if (usuario === null) {
			throw new NotFoundError('usuario');
		}
		return usuario;
	}

	async alterarSenha(id: number, senhaAtual: string, senhaNova: string): Promise<void> {
		const senhaHash = await this.usuarios.findSenhaHash(id);
		if (senhaHash === null) {
			throw new NotFoundError('usuario');
		}
		if (!(await verifyPassword(senhaAtual, senhaHash))) {
			throw new UnprocessableError('senha atual incorreta');
		}
		await this.usuarios.updateSenha(id, await hashPassword(senhaNova));
	}
}