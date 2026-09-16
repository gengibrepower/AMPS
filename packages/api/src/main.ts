import { loadAuthConfig, loadMysqlConfig, loadServerConfig } from './config/env.js';
import { createPool } from './adapters/mysql/pool.js';
import { montarApp } from './composition.js';

const server = loadServerConfig();

const app = montarApp({
	pool: createPool(loadMysqlConfig()),
	jwtSecret: loadAuthConfig().jwtSecret,
	corsOrigin: server.corsOrigin,
});

app.listen(server.port, () => {
	console.log(`api ouvindo na porta ${server.port}`);
});
