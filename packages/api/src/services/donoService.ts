import { hashPassword } from '../security/password.js';
import type { DonoRepository, UsuarioComDono } from '../ports.js';

export interface CadastroDono {
	readonly nome: string;
	readonly email: string;
	readonly cpf: string;
	readonly senha: string;
	readonly razao: string;
	readonly cnpj: string;
}

export class DonoService {
	constructor(private readonly donos: DonoRepository) {}

	async cadastrar(dados: CadastroDono): Promise<UsuarioComDono> {
		return this.donos.create(
			{
				nome: dados.nome,
				email: dados.email,
				cpf: dados.cpf,
				senhaHash: await hashPassword(dados.senha),
				tipoConta: 'dono',
			},
			{ razao: dados.razao, cnpj: dados.cnpj },
		);
	}
}
