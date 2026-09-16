import mysql, { type Pool } from 'mysql2/promise';
import type { MysqlConfig } from '../../config/env.js';

export function createPool(config: MysqlConfig): Pool {
	return mysql.createPool({
		host: config.host,
		port: config.port,
		user: config.user,
		password: config.password,
		database: config.database,
		waitForConnections: true,
		connectionLimit: 10,
	});
}
