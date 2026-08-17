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

