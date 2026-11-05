import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { DimensoesDoModelo, Modelo, ModeloRepository } from '../../ports.js';

interface ModeloRow extends RowDataPacket {
	id: number;
	marca: string;
	nome: string;
}

interface DimensoesRow extends RowDataPacket {
	largura_mm: number;
	comprimento_mm: number;
}

const SELECT_DIMENSOES = `
SELECT largura_mm, comprimento_mm
FROM modelos
WHERE id = ?
`;

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

	async findDimensoes(id: number): Promise<DimensoesDoModelo | null> {
		const [rows] = await this.pool.execute<DimensoesRow[]>(SELECT_DIMENSOES, [id]);
		const row = rows[0];
		if (row === undefined) return null;
		return { larguraMm: row.largura_mm, comprimentoMm: row.comprimento_mm };
	}
}
