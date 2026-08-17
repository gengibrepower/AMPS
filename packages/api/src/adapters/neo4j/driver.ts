import neo4j, { type Driver } from 'neo4j-driver';
import type { Neo4jConfig } from '../../config/env';	

export function createDriver (config: Neo4jConfig): Driver {
	return neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password), {
		disableLosslessIntegers: true,
	});
}

