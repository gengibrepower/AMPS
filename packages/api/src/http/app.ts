import express, { type Express } from 'express';
import cors from 'cors';
import type { AuthService } from '../services/authService.js';
import type { CarroService } from '../services/carroService.js';
import type { DonoService } from '../services/donoService.js';
import type { ModeloService } from '../services/modeloService.js';
import type { UsuarioService } from '../services/usuarioService.js';
import type { TokenService } from '../security/jwt.js';
import { autenticar } from './authMiddleware.js';
import { errorHandler } from './errorHandler.js';

export interface AppDeps {
	readonly usuarioService: UsuarioService;
	readonly donoService: DonoService;
	readonly authService: AuthService;
	readonly modeloService: ModeloService;
	readonly carroService: CarroService;
	readonly tokenService: TokenService;
	readonly corsOrigin: string;
}

type Body = Record<string, unknown>;

function texto(body: Body, campo: string): string | null {
	const valor = body[campo];
	return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

function faltantes(body: Body, campos: readonly string[]): readonly string[] {
	return campos.filter((campo) => texto(body, campo) === null);
}

export function createApp(deps: AppDeps): Express {
	const app = express();

	app.use(cors({ origin: deps.corsOrigin }));
	app.use(express.json());

	app.post('/usuarios', async (req, res) => {
		const body = req.body as Body;
		const ausentes = faltantes(body, ['nome', 'email', 'cpf', 'senha']);
		if (ausentes.length > 0) {
			res.status(400).json({ erro: 'campos obrigatorios ausentes', campos: ausentes });
			return;
		}

		const usuario = await deps.usuarioService.cadastrar({
			nome: String(body['nome']),
			email: String(body['email']),
			cpf: String(body['cpf']),
			senha: String(body['senha']),
		});

		res.status(201).json({
			id: usuario.id,
			nome: usuario.nome,
			email: usuario.email,
			tipo_conta: usuario.tipoConta,
		});
	});

	app.post('/donos', async (req, res) => {
		const body = req.body as Body;
		const ausentes = faltantes(body, ['nome', 'email', 'cpf', 'senha', 'razao', 'cnpj']);
		if (ausentes.length > 0) {
			res.status(400).json({ erro: 'campos obrigatorios ausentes', campos: ausentes });
			return;
		}

		const { usuario, dono } = await deps.donoService.cadastrar({
			nome: String(body['nome']),
			email: String(body['email']),
			cpf: String(body['cpf']),
			senha: String(body['senha']),
			razao: String(body['razao']),
			cnpj: String(body['cnpj']),
		});

		res.status(201).json({
			id: usuario.id,
			nome: usuario.nome,
			email: usuario.email,
			tipo_conta: usuario.tipoConta,
			dono: { razao: dono.razao, cnpj: dono.cnpj },
		});
	});

	app.post('/auth/login', async (req, res) => {
		const body = req.body as Body;
		const ausentes = faltantes(body, ['email', 'senha']);
		if (ausentes.length > 0) {
			res.status(400).json({ erro: 'campos obrigatorios ausentes', campos: ausentes });
			return;
		}

		const autenticado = await deps.authService.login(
			String(body['email']),
			String(body['senha']),
		);
		if (autenticado === null) {
			res.status(401).json({ erro: 'credenciais invalidas' });
			return;
		}

		res.status(200).json({
			token: autenticado.token,
			usuario: {
				id: autenticado.usuario.id,
				nome: autenticado.usuario.nome,
				email: autenticado.usuario.email,
				tipo_conta: autenticado.usuario.tipoConta,
			},
		});
	});

	app.get('/modelos', async (_req, res) => {
		const modelos = await deps.modeloService.listar();
		res.status(200).json(
			modelos.map((modelo) => ({ id: modelo.id, marca: modelo.marca, nome: modelo.nome })),
		);
	});

	app.post('/carros', autenticar(deps.tokenService), async (req, res) => {
		const auth = req.auth;
		if (auth === undefined) {
			res.status(401).json({ erro: 'token ausente' });
			return;
		}

		const body = req.body as Body;
		const placa = texto(body, 'placa');
		const modeloId = Number(body['modelo_id']);
		if (placa === null || !Number.isInteger(modeloId)) {
			res.status(400).json({ erro: 'placa e modelo_id sao obrigatorios' });
			return;
		}

		const carro = await deps.carroService.cadastrar(auth.sub, { placa, modeloId });

		res.status(201).json({
			id: carro.id,
			placa: carro.placa,
			modelo_id: carro.modeloId,
			proprietario: carro.proprietario,
		});
	});

	app.use(errorHandler);

	return app;
}
