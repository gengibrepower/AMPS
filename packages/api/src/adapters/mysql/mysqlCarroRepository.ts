import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Carro, CarroRepository, NovoCarro } from '../../ports.js';
import { asConflict } from './duplicate.js';

interface CarroRow extends RowDataPacket {
    id: number;
    placa: string;
    modelo_id: number;
    proprietario: string;
}

const INSERT = `
INSERT INTO carros (placa, proprietario, modelo_id)
VALUES (?, ?, ?)
`;

const SELECT_BY_PROPRIETARIO = `
SELECT id, placa, modelo_id, proprietario
FROM carros
WHERE proprietario = ?
ORDER BY id
`;

const DELETE_BY_ID = `
DELETE FROM carros 
WHERE id = ?
`;

export class MysqlCarroRepository implements CarroRepository {
	constructor(private readonly pool: Pool) {}

	async create(novo: NovoCarro): Promise<Carro> {
		try {
			const [result] = await this.pool.execute<ResultSetHeader>(INSERT, [
				novo.placa,
				novo.proprietario,
				novo.modeloId,
			]);
			return {
				id: result.insertId,
				placa: novo.placa,
				modeloId: novo.modeloId,
				proprietario: novo.proprietario,
			};
		} catch (error) {
			throw asConflict(error);
		}
	}

	async listByProprietario(proprietario: string): Promise<readonly Carro[]> {
		const [rows] = await this.pool.execute<CarroRow[]>(
			SELECT_BY_PROPRIETARIO,
			[proprietario],
		);

		return rows.map((row) => ({
			id: row.id,
			placa: row.placa,
			modeloId: row.modelo_id,
			proprietario: row.proprietario,
		}));
	}

	async deleteById(id: number): Promise<boolean> {
	const [result] = await this.pool.execute<ResultSetHeader>(
		DELETE_BY_ID,
		[id],
	);

	return result.affectedRows > 0;
}
}
