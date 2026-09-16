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
