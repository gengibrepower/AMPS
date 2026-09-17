import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ConflictError } from '../../errors.js';
import type {
	StatusVaga,
	TipoVaga,
	Vaga,
	VagaDoEditor,
	VagaRepository,
} from '../../ports.js';
import { asRegraDoBanco } from './integridade.js';

const ER_DUP_ENTRY = 1062;

interface VagaRow extends RowDataPacket {
	id: number;
	no_id: string;
	numero: string;
	tipo: TipoVaga;
	rotacao_graus: number;
	sensor: string | null;
	status: StatusVaga;
	carro_id: number | null;
}

const SELECT_BY_ESTACIONAMENTO = `
SELECT id, no_id, numero, tipo, rotacao_graus, sensor, status, carro_id
FROM vagas
WHERE estacionamento_id = ?
ORDER BY numero
`;

const SELECT_BY_NO = `
SELECT id, no_id, numero, tipo, rotacao_graus, sensor, status, carro_id
FROM vagas
WHERE estacionamento_id = ? AND no_id = ?
`;

const UPDATE = `
UPDATE vagas
SET numero = ?, tipo = ?, rotacao_graus = ?, sensor = ?
WHERE estacionamento_id = ? AND no_id = ?
`;

const INSERT = `
INSERT INTO vagas (estacionamento_id, no_id, numero, tipo, rotacao_graus, sensor)
VALUES (?, ?, ?, ?, ?, ?)
`;

const DELETE = `
DELETE FROM vagas
WHERE estacionamento_id = ? AND no_id = ?
`;

function toVaga(row: VagaRow): Vaga {
	return {
		id: row.id,
		noId: row.no_id,
		numero: row.numero,
		tipo: row.tipo,
		rotacaoGraus: row.rotacao_graus,
		sensor: row.sensor,
		status: row.status,
		carroId: row.carro_id,
	};
}

// UNIQUE (estacionamento_id, numero) é o unico conflito possivel aqui: o no_id
// ja foi resolvido pelo UPDATE que roda antes do INSERT.
function asNumeroDuplicado(error: unknown): unknown {
	if (error instanceof Error && (error as { errno?: number }).errno === ER_DUP_ENTRY) {
		return new ConflictError('numero');
	}
	return asRegraDoBanco(error);
}

export class MysqlVagaRepository implements VagaRepository {
	constructor(private readonly pool: Pool) {}

	async upsertAll(
		estacionamentoId: number,
		vagas: readonly VagaDoEditor[],
	): Promise<readonly Vaga[]> {
		const connection = await this.pool.getConnection();
		try {
			await connection.beginTransaction();
			for (const vaga of vagas) {
				await this.gravar(connection, estacionamentoId, vaga);
			}
			const [rows] = await connection.execute<VagaRow[]>(SELECT_BY_ESTACIONAMENTO, [
				estacionamentoId,
			]);
			await connection.commit();
			return rows.map(toVaga);
		} catch (error) {
			await connection.rollback();
			throw asNumeroDuplicado(error);
		} finally {
			connection.release();
		}
	}

	async listByEstacionamento(estacionamentoId: number): Promise<readonly Vaga[]> {
		const [rows] = await this.pool.execute<VagaRow[]>(SELECT_BY_ESTACIONAMENTO, [
			estacionamentoId,
		]);
		return rows.map(toVaga);
	}

	async findByNoId(estacionamentoId: number, noId: string): Promise<Vaga | null> {
		const [rows] = await this.pool.execute<VagaRow[]>(SELECT_BY_NO, [estacionamentoId, noId]);
		const row = rows[0];
		return row === undefined ? null : toVaga(row);
	}

	async deleteByNoId(estacionamentoId: number, noId: string): Promise<void> {
		await this.pool.execute(DELETE, [estacionamentoId, noId]);
	}

	// Atualiza e, se nao havia linha para aquele no, insere. Evita o ON DUPLICATE
	// KEY, que casaria tambem pelo UNIQUE de numero e trocaria a vaga errada.
	private async gravar(
		connection: PoolConnection,
		estacionamentoId: number,
		vaga: VagaDoEditor,
	): Promise<void> {
		const [result] = await connection.execute<ResultSetHeader>(UPDATE, [
			vaga.numero,
			vaga.tipo,
			vaga.rotacaoGraus,
			vaga.sensor,
			estacionamentoId,
			vaga.noId,
		]);
		if (result.affectedRows > 0) {
			return;
		}

		await connection.execute(INSERT, [
			estacionamentoId,
			vaga.noId,
			vaga.numero,
			vaga.tipo,
			vaga.rotacaoGraus,
			vaga.sensor,
		]);
	}
}
