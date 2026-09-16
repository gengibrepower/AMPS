import type { Pool, ResultSetHeader } from 'mysql2/promise';
import type { Carro, CarroRepository, NovoCarro } from '../../ports.js';
import { asConflict } from './duplicate.js';

const INSERT = `
INSERT INTO carros (placa, proprietario, modelo_id)
VALUES (?, ?, ?)
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
}
