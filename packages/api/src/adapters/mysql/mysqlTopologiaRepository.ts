import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { Topologia, TopologiaComGrafo, TopologiaRepository } from '../../ports.js';
import { asRegraDoBanco } from './integridade.js';

interface VersaoRow extends RowDataPacket {
	versao: number;
}

interface TopologiaRow extends VersaoRow {
	grafo: unknown;
}

// estacionamento_id e UNIQUE, entao a mesma sentença cria a topologia ou troca o
// grafo, sempre subindo a versao.
const UPSERT = `
INSERT INTO topologias (estacionamento_id, grafo)
VALUES (?, CAST(? AS JSON)) AS novo
ON DUPLICATE KEY UPDATE grafo = novo.grafo, versao = topologias.versao + 1
`;

const SELECT_VERSAO = `
SELECT versao
FROM topologias
WHERE estacionamento_id = ?
`;

const SELECT_GRAFO = `
SELECT versao, grafo
FROM topologias
WHERE estacionamento_id = ?
`;

export class MysqlTopologiaRepository implements TopologiaRepository {
	constructor(private readonly pool: Pool) {}

	async save(estacionamentoId: number, grafo: unknown): Promise<Topologia> {
		const connection = await this.pool.getConnection();
		try {
			await connection.beginTransaction();
			await connection.execute(UPSERT, [estacionamentoId, JSON.stringify(grafo)]);
			const [rows] = await connection.execute<VersaoRow[]>(SELECT_VERSAO, [estacionamentoId]);
			await connection.commit();

			return { estacionamentoId, versao: rows[0]?.versao ?? 1 };
		} catch (error) {
			await connection.rollback();
			throw asRegraDoBanco(error);
		} finally {
			connection.release();
		}
	}

	async findByEstacionamento(estacionamentoId: number): Promise<TopologiaComGrafo | null> {
		const [rows] = await this.pool.execute<TopologiaRow[]>(SELECT_GRAFO, [estacionamentoId]);
		const row = rows[0];
		return row === undefined
			? null
			: { estacionamentoId, versao: row.versao, grafo: row.grafo };
	}
}
