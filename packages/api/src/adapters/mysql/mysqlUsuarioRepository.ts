import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { NovoUsuario, TipoConta, Usuario, UsuarioComSenha, UsuarioRepository } from '../../ports.js';
import { asConflict } from './duplicate.js';

interface UsuarioRow extends RowDataPacket {
	id: number;
	nome: string;
	email: string;
	cpf: string;
	senha: string;
	tipo_conta: TipoConta;
}

const INSERT = `
INSERT INTO usuarios (nome, email, cpf, senha, tipo_conta)
VALUES (?, ?, ?, ?, ?)
`;

const SELECT_BY_ID = `
SELECT id, nome, email, cpf, senha, tipo_conta
FROM usuarios
WHERE id = ?
`;

const SELECT_BY_EMAIL = `
SELECT id, nome, email, cpf, senha, tipo_conta
FROM usuarios
WHERE email = ?
`;

function toUsuario(row: UsuarioRow): Usuario {
	return {
		id: row.id,
		nome: row.nome,
		email: row.email,
		cpf: row.cpf,
		tipoConta: row.tipo_conta,
	};
}

export class MysqlUsuarioRepository implements UsuarioRepository {
	constructor(private readonly pool: Pool) {}

	async create(novo: NovoUsuario): Promise<Usuario> {
		try {
			const [result] = await this.pool.execute<ResultSetHeader>(INSERT, [
				novo.nome,
				novo.email,
				novo.cpf,
				novo.senhaHash,
				novo.tipoConta,
			]);
			return {
				id: result.insertId,
				nome: novo.nome,
				email: novo.email,
				cpf: novo.cpf,
				tipoConta: novo.tipoConta,
			};
		} catch (error) {
			throw asConflict(error);
		}
	}

	async findById(id: number): Promise<Usuario | null> {
		const [rows] = await this.pool.execute<UsuarioRow[]>(SELECT_BY_ID, [id]);
		const row = rows[0];
		return row === undefined ? null : toUsuario(row);
	}

	async findByEmail(email: string): Promise<UsuarioComSenha | null> {
		const [rows] = await this.pool.execute<UsuarioRow[]>(SELECT_BY_EMAIL, [email]);
		const row = rows[0];
		return row === undefined ? null : { ...toUsuario(row), senhaHash: row.senha };
	}
}
