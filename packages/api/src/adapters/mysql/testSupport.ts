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

// Ordem obrigatória: carros referencia modelos e donos referencia usuarios.
export async function wipe(pool: Pool): Promise<void> {
	await pool.execute('DELETE FROM carros');
	await pool.execute('DELETE FROM modelos');
	await pool.execute('DELETE FROM donos');
	await pool.execute('DELETE FROM usuarios');
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
