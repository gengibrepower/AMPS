import type { Express } from 'express';
import type { Pool } from 'mysql2/promise';
import { MysqlCarroRepository } from './adapters/mysql/mysqlCarroRepository.js';
import { MysqlDonoRepository } from './adapters/mysql/mysqlDonoRepository.js';
import { MysqlEstacionamentoRepository } from './adapters/mysql/mysqlEstacionamentoRepository.js';
import { MysqlModeloRepository } from './adapters/mysql/mysqlModeloRepository.js';
import { MysqlUsuarioRepository } from './adapters/mysql/mysqlUsuarioRepository.js';
import { createTokenService } from './security/jwt.js';
import { AuthService } from './services/authService.js';
import { CarroService } from './services/carroService.js';
import { DonoService } from './services/donoService.js';
import { EstacionamentoService } from './services/estacionamentoService.js';
import { ModeloService } from './services/modeloService.js';
import { UsuarioService } from './services/usuarioService.js';
import { createApp } from './http/app.js';

export interface MontagemApp {
	readonly pool: Pool;
	readonly jwtSecret: string;
	readonly corsOrigin: string;
}

export function montarApp({ pool, jwtSecret, corsOrigin }: MontagemApp): Express {
	const usuarios = new MysqlUsuarioRepository(pool);
	const donos = new MysqlDonoRepository(pool);
	const tokenService = createTokenService(jwtSecret);

	return createApp({
		usuarioService: new UsuarioService(usuarios),
		donoService: new DonoService(donos),
		authService: new AuthService(usuarios, tokenService),
		modeloService: new ModeloService(new MysqlModeloRepository(pool)),
		carroService: new CarroService(new MysqlCarroRepository(pool), usuarios),
		estacionamentoService: new EstacionamentoService(
			new MysqlEstacionamentoRepository(pool),
			donos,
		),
		tokenService,
		corsOrigin,
	});
}
