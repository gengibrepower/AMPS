import { verifyPassword } from '../security/password.js';
import type { TokenService } from '../security/jwt.js';
import type { Usuario, UsuarioRepository } from '../ports.js';

export interface Autenticado {
	readonly token: string;
	readonly usuario: Usuario;
}

export class AuthService {
	constructor(
		private readonly usuarios: UsuarioRepository,
		private readonly tokens: TokenService,
	) {}

	async login(email: string, senha: string): Promise<Autenticado | null> {
		const encontrado = await this.usuarios.findByEmail(email);
		if (encontrado === null) {
			return null;
		}
		if (!(await verifyPassword(senha, encontrado.senhaHash))) {
			return null;
		}

		const { senhaHash: _descartado, ...usuario } = encontrado;
		return { token: await this.tokens.sign(usuario), usuario };
	}
}
