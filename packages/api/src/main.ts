import {
	loadAuthConfig,
	loadMerlianConfig,
	loadMysqlConfig,
	loadServerConfig,
} from './config/env.js';
import { MerlianMotorDeGrafo } from './adapters/merlian/merlianMotorDeGrafo.js';
import { createPool } from './adapters/mysql/pool.js';
import { montarApp } from './composition.js';

const server = loadServerConfig();

const auth = loadAuthConfig();

const app = montarApp({
	pool: createPool(loadMysqlConfig()),
	jwtSecret: auth.jwtSecret,
	tokenTtl: auth.tokenTtl,
	corsOrigin: server.corsOrigin,
	motorDeGrafo: new MerlianMotorDeGrafo(loadMerlianConfig().baseUrl),
});

app.listen(server.port, () => {
	console.log(`api ouvindo na porta ${server.port}`);
});
