import { loadAuthConfig, loadMysqlConfig, loadServerConfig } from './config/env.js';
import { createPool } from './adapters/mysql/pool.js';
import { MysqlCarroRepository } from './adapters/mysql/mysqlCarroRepository.js';
import { MysqlDonoRepository } from './adapters/mysql/mysqlDonoRepository.js';
import { MysqlModeloRepository } from './adapters/mysql/mysqlModeloRepository.js';
import { MysqlUsuarioRepository } from './adapters/mysql/mysqlUsuarioRepository.js';
import { createTokenService } from './security/jwt.js';
import { AuthService } from './services/authService.js';
import { CarroService } from './services/carroService.js';
import { DonoService } from './services/donoService.js';
import { ModeloService } from './services/modeloService.js';
import { UsuarioService } from './services/usuarioService.js';
import { createApp } from './http/app.js';

const server = loadServerConfig();
const pool = createPool(loadMysqlConfig());
const tokenService = createTokenService(loadAuthConfig().jwtSecret);

const usuarios = new MysqlUsuarioRepository(pool);

const app = createApp({
	usuarioService: new UsuarioService(usuarios),
	donoService: new DonoService(new MysqlDonoRepository(pool)),
	authService: new AuthService(usuarios, tokenService),
	modeloService: new ModeloService(new MysqlModeloRepository(pool)),
	carroService: new CarroService(new MysqlCarroRepository(pool), usuarios),
	tokenService,
	corsOrigin: server.corsOrigin,
});

app.listen(server.port, () => {
	console.log(`api ouvindo na porta ${server.port}`);
});
