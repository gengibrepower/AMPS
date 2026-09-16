import type { Pool, ResultSetHeader } from 'mysql2/promise';
import type { Dono, DonoRepository, NovoUsuario, UsuarioComDono } from '../../ports.js';
import { asConflict } from './duplicate.js';

const INSERT_USUARIO = `
INSERT INTO usuarios (nome, email, cpf, senha, tipo_conta)
VALUES (?, ?, ?, ?, ?)
`;

const INSERT_DONO = `
INSERT INTO donos (usuario_id, razao, cnpj)
VALUES (?, ?, ?)
`;

export class MysqlDonoRepository implements DonoRepository {
	constructor(private readonly pool: Pool) {}

	async create(usuario: NovoUsuario, dono: Dono): Promise<UsuarioComDono> {
		const connection = await this.pool.getConnection();
		try {
			await connection.beginTransaction();
			const [result] = await connection.execute<ResultSetHeader>(INSERT_USUARIO, [
				usuario.nome,
				usuario.email,
				usuario.cpf,
				usuario.senhaHash,
				usuario.tipoConta,
			]);
			await connection.execute(INSERT_DONO, [result.insertId, dono.razao, dono.cnpj]);
			await connection.commit();

			return {
				usuario: {
					id: result.insertId,
					nome: usuario.nome,
					email: usuario.email,
					cpf: usuario.cpf,
					tipoConta: usuario.tipoConta,
				},
				dono,
			};
		} catch (error) {
			await connection.rollback();
			throw asConflict(error);
		} finally {
			connection.release();
		}
	}
}
