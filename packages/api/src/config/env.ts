import { error } from "console";

export interface Neo4jConfig {
	readonly uri: string;
	readonly user: string;
	readonly password: string; 
	readonly database: string;
}

function required (key: string): string {
	const value = process.env[key];
	if (value === undefined || value === '') {
		throw new Error(`variavel de ambiente ${key} nao definida.`);
	}
	return value;
}

export function loadNeo4jConfig(): Neo4jConfig {
	return {
		uri: process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
		user: process.env['NEO4J_USER'] ?? 'neo4j',
		password: required('NEO4J_PASSWORD'),
		database: process.env['NEO4J_DATABASE'] ?? 'neo4j',
	};
}

export interface MysqlConfig {
	readonly host: string;
	readonly port: number;
	readonly user: string;
	readonly password: string;
	readonly database: string;
}

export interface AuthConfig {
	readonly jwtSecret: string;
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
	};
}

export function loadAuthConfig(): AuthConfig {
	return {
		jwtSecret: required('AUTH_JWT_SECRET'),
	};
}

