import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { Modelo, ModeloRepository } from '../../ports.js';

interface ModeloRow extends RowDataPacket {
	id: number;
	marca: string;
	nome: string;
}

const SELECT_ALL = `
SELECT id, marca, nome
FROM modelos
ORDER BY marca, nome
`;

export class MysqlModeloRepository implements ModeloRepository {
	constructor(private readonly pool: Pool) {}

	async listAll(): Promise<readonly Modelo[]> {
		const [rows] = await this.pool.execute<ModeloRow[]>(SELECT_ALL);
		return rows.map((row) => ({ id: row.id, marca: row.marca, nome: row.nome }));
	}
}
