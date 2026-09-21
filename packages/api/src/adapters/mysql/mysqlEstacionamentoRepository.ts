import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
	DadosDoEstacionamento,
	Estacionamento,
	EstacionamentoRepository,
	NovoEstacionamento,
} from '../../ports.js';
import { NotFoundError } from '../../errors.js';
import { asConflict } from './duplicate.js';

interface EstacionamentoRow extends RowDataPacket {
	id: number;
	dono_id: number;
	nome_estacionamento: string;
	publicado: number;
	cep: string | null;
	logradouro: string | null;
	numero: string | null;
	bairro: string | null;
	complemento: string | null;
	cidade: string | null;
	estado: string | null;
}

const INSERT = `
INSERT INTO estacionamentos
	(dono_id, nome_estacionamento, cep, logradouro, numero, bairro, complemento, cidade, estado)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_BY_DONO = `
SELECT id, dono_id, nome_estacionamento, publicado,
	   cep, logradouro, numero, bairro, complemento, cidade, estado
FROM estacionamentos
WHERE dono_id = ?
ORDER BY id
`;

const SELECT_BY_ID = `
SELECT id, dono_id, nome_estacionamento, publicado,
	   cep, logradouro, numero, bairro, complemento, cidade, estado
FROM estacionamentos
WHERE id = ?
`;

const UPDATE = `
UPDATE estacionamentos
SET nome_estacionamento = ?, cep = ?, logradouro = ?, numero = ?,
	bairro = ?, complemento = ?, cidade = ?, estado = ?
WHERE id = ?
`;

const DELETE = `
DELETE FROM estacionamentos
WHERE id = ?
`;

const UPDATE_PUBLICADO = `
UPDATE estacionamentos
SET publicado = ?
WHERE id = ?
`;

function toEstacionamento(row: EstacionamentoRow): Estacionamento {
	return {
		id: row.id,
		donoId: row.dono_id,
		nome: row.nome_estacionamento,
		publicado: row.publicado === 1,
		endereco: {
			cep: row.cep,
			logradouro: row.logradouro,
			numero: row.numero,
			bairro: row.bairro,
			complemento: row.complemento,
			cidade: row.cidade,
			estado: row.estado,
		},
	};
}

export class MysqlEstacionamentoRepository implements EstacionamentoRepository {
	constructor(private readonly pool: Pool) {}

	async create(novo: NovoEstacionamento): Promise<Estacionamento> {
		try {
			const [result] = await this.pool.execute<ResultSetHeader>(INSERT, [
				novo.donoId,
				novo.nome,
				novo.endereco.cep,
				novo.endereco.logradouro,
				novo.endereco.numero,
				novo.endereco.bairro,
				novo.endereco.complemento,
				novo.endereco.cidade,
				novo.endereco.estado,
			]);
			return {
				id: result.insertId,
				donoId: novo.donoId,
				nome: novo.nome,
				publicado: false,
				endereco: novo.endereco,
			};
		} catch (error) {
			throw asConflict(error);
		}
	}

	async listByDono(donoId: number): Promise<readonly Estacionamento[]> {
		const [rows] = await this.pool.execute<EstacionamentoRow[]>(SELECT_BY_DONO, [donoId]);
		return rows.map(toEstacionamento);
	}

	async findById(id: number): Promise<Estacionamento | null> {
		const [rows] = await this.pool.execute<EstacionamentoRow[]>(SELECT_BY_ID, [id]);
		const row = rows[0];
		return row === undefined ? null : toEstacionamento(row);
	}

	async update(id: number, dados: DadosDoEstacionamento): Promise<Estacionamento> {
		await this.pool.execute(UPDATE, [
			dados.nome,
			dados.endereco.cep,
			dados.endereco.logradouro,
			dados.endereco.numero,
			dados.endereco.bairro,
			dados.endereco.complemento,
			dados.endereco.cidade,
			dados.endereco.estado,
			id,
		]);
		const atualizado = await this.findById(id);
		if (atualizado === null) {
			throw new NotFoundError('estacionamento');
		}
		return atualizado;
	}

	// topologias e vagas somem junto, por ON DELETE CASCADE de 01_schema.sql.
	async delete(id: number): Promise<void> {
		await this.pool.execute(DELETE, [id]);
	}

	async setPublicado(id: number, publicado: boolean): Promise<Estacionamento> {
		await this.pool.execute(UPDATE_PUBLICADO, [publicado, id]);
		const atualizado = await this.findById(id);
		if (atualizado === null) {
			throw new NotFoundError('estacionamento');
		}
		return atualizado;
	}
}
