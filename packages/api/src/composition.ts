import type { Express } from 'express';
import type { Pool } from 'mysql2/promise';
import type { MotorDeGrafo } from './ports.js';
import { MysqlCarroRepository } from './adapters/mysql/mysqlCarroRepository.js';
import { MysqlDonoRepository } from './adapters/mysql/mysqlDonoRepository.js';
import { MysqlEstacionamentoRepository } from './adapters/mysql/mysqlEstacionamentoRepository.js';
import { MysqlModeloRepository } from './adapters/mysql/mysqlModeloRepository.js';
import { MysqlTopologiaRepository } from './adapters/mysql/mysqlTopologiaRepository.js';
import { MysqlUsuarioRepository } from './adapters/mysql/mysqlUsuarioRepository.js';
import { MysqlVagaRepository } from './adapters/mysql/mysqlVagaRepository.js';
import { createTokenService } from './security/jwt.js';
import { AcessoDono } from './services/acessoDono.js';
import { AuthService } from './services/authService.js';
import { CarroService } from './services/carroService.js';
import { DonoService } from './services/donoService.js';
import { EstacionamentoService } from './services/estacionamentoService.js';
import { MapaService } from './services/mapaService.js';
import { PublicacaoService } from './services/publicacaoService.js';
import { ModeloService } from './services/modeloService.js';
import { TopologiaService } from './services/topologiaService.js';
import { UsuarioService } from './services/usuarioService.js';
import { VagaService } from './services/vagaService.js';
import { createApp } from './http/app.js';

export interface MontagemApp {
	readonly pool: Pool;
	readonly jwtSecret: string;
	readonly corsOrigin: string;
	readonly motorDeGrafo: MotorDeGrafo;
}

export function montarApp({ pool, jwtSecret, corsOrigin, motorDeGrafo }: MontagemApp): Express {
	const usuarios = new MysqlUsuarioRepository(pool);
	const donos = new MysqlDonoRepository(pool);
	const estacionamentos = new MysqlEstacionamentoRepository(pool);
	const acessoDono = new AcessoDono(donos, estacionamentos);
	const topologias = new MysqlTopologiaRepository(pool);
	const vagas = new MysqlVagaRepository(pool);
	const tokenService = createTokenService(jwtSecret);

	return createApp({
		usuarioService: new UsuarioService(usuarios),
		donoService: new DonoService(donos),
		authService: new AuthService(usuarios, tokenService),
		modeloService: new ModeloService(new MysqlModeloRepository(pool)),
		carroService: new CarroService(new MysqlCarroRepository(pool), usuarios),
		estacionamentoService: new EstacionamentoService(estacionamentos, acessoDono),
		topologiaService: new TopologiaService(topologias, acessoDono),
		vagaService: new VagaService(vagas, acessoDono),
		mapaService: new MapaService(topologias, vagas, acessoDono),
		publicacaoService: new PublicacaoService(
			estacionamentos,
			topologias,
			vagas,
			motorDeGrafo,
			acessoDono,
		),
		tokenService,
		corsOrigin,
	});
}
