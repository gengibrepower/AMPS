function required (key: string): string {
	const value = process.env[key];
	if (value === undefined || value === '') {
		throw new Error(`variavel de ambiente ${key} nao definida.`);
	}
	return value;
}

export interface MysqlConfig {
	readonly host: string;
	readonly port: number;
	readonly user: string;
	readonly password: string;
	readonly database: string;
	// Quando true, a conexão API↔MySQL usa TLS (confidencialidade em trânsito, RA2).
	readonly ssl: boolean;
}

export interface AuthConfig {
	readonly jwtSecret: string;
	readonly tokenTtl: string | undefined;
}

function port(key: string, fallback: number): number {
	const value = process.env[key];
	if (value === undefined || value === '') {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`variavel de ambiente ${key} invalida: ${value}`);
	}
	return parsed;
}

export function loadMysqlConfig(): MysqlConfig {
	return {
		host: process.env['MYSQL_HOST'] ?? 'localhost',
		port: port('MYSQL_PORT', 3306),
		user: process.env['MYSQL_USER'] ?? 'root',
		password: required('MYSQL_PASSWORD'),
		database: process.env['MYSQL_DATABASE'] ?? 'parking_system',
		ssl: (process.env['MYSQL_SSL'] ?? '').toLowerCase() === 'true',
	};
}

export function loadAuthConfig(): AuthConfig {
	const ttl = process.env['AUTH_TOKEN_TTL'];
	return {
		jwtSecret: required('AUTH_JWT_SECRET'),
		tokenTtl: ttl === undefined || ttl === '' ? undefined : ttl,
	};
}

export interface ServerConfig {
	readonly host: string;
	readonly port: number;
	readonly corsOrigin: string;
}

export function loadServerConfig(): ServerConfig {
	return {
		// Só o loopback por padrão: o acesso externo passa pela borda TLS (Caddy).
		// Escutar em todas as interfaces deixaria a API em HTTP claro exposta na rede.
		host: process.env['HOST'] ?? '127.0.0.1',
		port: port('PORT', 3001),
		corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
	};
}

export interface MerlianConfig {
	readonly baseUrl: string;
}

export function loadMerlianConfig(): MerlianConfig {
	return {
		baseUrl: process.env['MERLIAN_URL'] ?? 'http://localhost:3000',
	};
}
