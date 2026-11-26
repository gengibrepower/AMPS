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
		// TLS para o canal API↔MySQL (RA2 — dados em trânsito). O MySQL 8 já serve TLS
		// com certificado próprio; em laboratório não verificamos a cadeia do servidor
		// (rejectUnauthorized:false), mas o tráfego vai cifrado. Em produção, apontar
		// `ca` para o certificado real do servidor e verificar.
		...(config.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
	});
}
