import { afterAll, beforeAll, beforeEach } from 'vitest';
import mysql, { type Pool } from 'mysql2/promise';

export function createTestPool(): Pool {
	return mysql.createPool({
		host: process.env['MYSQL_HOST'] ?? 'localhost',
		port: Number(process.env['MYSQL_PORT'] ?? 3306),
		user: process.env['MYSQL_USER'] ?? 'root',
		password: process.env['MYSQL_PASSWORD'] ?? '',
		database: process.env['MYSQL_DATABASE'] ?? 'parking_system',
		waitForConnections: true,
		connectionLimit: 5,
	});
}

// Filhos antes dos pais, senão a FK barra: vagas e topologias apontam para
// estacionamentos, estacionamentos para donos, carros para modelos.
const TABELAS_EM_ORDEM_DE_LIMPEZA = [
	'vagas',
	'topologias',
	'estacionamentos',
	'carros',
	'modelos',
	'donos',
	'usuarios',
] as const;

export async function wipe(pool: Pool): Promise<void> {
	for (const tabela of TABELAS_EM_ORDEM_DE_LIMPEZA) {
		await pool.execute(`DELETE FROM ${tabela}`);
	}
}

// Registra o ciclo de vida do pool e devolve um acessor: o pool só existe a
// partir do beforeAll, então não dá para expor a referência direto.
// Um beforeEach declarado depois desta chamada roda depois do wipe.
export function usarBancoDeTeste(): () => Pool {
	let pool: Pool;

	beforeAll(() => {
		pool = createTestPool();
	});

	afterAll(async () => {
		await pool.end();
	});

	beforeEach(async () => {
		await wipe(pool);
	});

	return () => pool;
}
