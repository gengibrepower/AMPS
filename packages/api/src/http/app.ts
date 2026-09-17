import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import type { AuthService } from '../services/authService.js';
import type { CarroService } from '../services/carroService.js';
import type { DonoService } from '../services/donoService.js';
import type { EstacionamentoService } from '../services/estacionamentoService.js';
import type { ModeloService } from '../services/modeloService.js';
import type { UsuarioService } from '../services/usuarioService.js';
import type { TokenService } from '../security/jwt.js';
import type { Endereco, Estacionamento, Usuario } from '../ports.js';
import { autenticar } from './authMiddleware.js';
import { errorHandler } from './errorHandler.js';

export interface AppDeps {
	readonly usuarioService: UsuarioService;
	readonly donoService: DonoService;
	readonly authService: AuthService;
	readonly modeloService: ModeloService;
	readonly carroService: CarroService;
	readonly estacionamentoService: EstacionamentoService;
	readonly tokenService: TokenService;
	readonly corsOrigin: string;
}

function texto(body: Record<string, unknown>, campo: string): string | null {
	const valor = body[campo];
	return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

// Devolve os campos já validados como string, ou responde 400 e devolve null —
// quem chama só precisa de `if (dados === null) return;`.
function exigir<C extends string>(
	req: Request,
	res: Response,
	campos: readonly C[],
): Record<C, string> | null {
	const body = (req.body ?? {}) as Record<string, unknown>;
	const valores = {} as Record<C, string>;
	const ausentes: C[] = [];

	for (const campo of campos) {
		const valor = texto(body, campo);
		if (valor === null) {
			ausentes.push(campo);
		} else {
			valores[campo] = valor;
		}
	}

	if (ausentes.length > 0) {
		res.status(400).json({ erro: 'campos obrigatorios ausentes', campos: ausentes });
		return null;
	}
	return valores;
}

const CAMPOS_ENDERECO = [
	'cep',
	'logradouro',
	'numero',
	'bairro',
	'complemento',
	'cidade',
	'estado',
] as const;

function endereco(req: Request): Endereco {
	const body = (req.body ?? {}) as Record<string, unknown>;
	const valores = {} as Record<(typeof CAMPOS_ENDERECO)[number], string | null>;
	for (const campo of CAMPOS_ENDERECO) {
		valores[campo] = texto(body, campo);
	}
	return valores;
}

function estacionamentoWire(estacionamento: Estacionamento): Record<string, unknown> {
	return {
		id: estacionamento.id,
		nome: estacionamento.nome,
		publicado: estacionamento.publicado,
		endereco: estacionamento.endereco,
	};
}

function usuarioWire(usuario: Usuario): Record<string, unknown> {
	return {
		id: usuario.id,
		nome: usuario.nome,
		email: usuario.email,
		tipo_conta: usuario.tipoConta,
	};
}

export function createApp(deps: AppDeps): Express {
	const app = express();

	app.use(cors({ origin: deps.corsOrigin }));
	app.use(express.json());

	app.post('/usuarios', async (req, res) => {
		const dados = exigir(req, res, ['nome', 'email', 'cpf', 'senha']);
		if (dados === null) return;

		const usuario = await deps.usuarioService.cadastrar(dados);
		res.status(201).json(usuarioWire(usuario));
	});

	app.post('/donos', async (req, res) => {
		const dados = exigir(req, res, ['nome', 'email', 'cpf', 'senha', 'razao', 'cnpj']);
		if (dados === null) return;

		const { usuario, dono } = await deps.donoService.cadastrar(dados);
		res.status(201).json({
			...usuarioWire(usuario),
			dono: { razao: dono.razao, cnpj: dono.cnpj },
		});
	});

	app.post('/auth/login', async (req, res) => {
		const dados = exigir(req, res, ['email', 'senha']);
		if (dados === null) return;

		const autenticado = await deps.authService.login(dados.email, dados.senha);
		if (autenticado === null) {
			res.status(401).json({ erro: 'credenciais invalidas' });
			return;
		}

		res.status(200).json({
			token: autenticado.token,
			usuario: usuarioWire(autenticado.usuario),
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

		const dados = exigir(req, res, ['placa']);
		if (dados === null) return;

		const modeloId = Number((req.body as Record<string, unknown>)['modelo_id']);
		if (!Number.isInteger(modeloId)) {
			res.status(400).json({ erro: 'campos obrigatorios ausentes', campos: ['modelo_id'] });
			return;
		}

		const carro = await deps.carroService.cadastrar(auth.sub, { placa: dados.placa, modeloId });
		res.status(201).json({
			id: carro.id,
			placa: carro.placa,
			modelo_id: carro.modeloId,
			proprietario: carro.proprietario,
		});
	});

	app.post('/estacionamentos', autenticar(deps.tokenService), async (req, res) => {
		const auth = req.auth;
		if (auth === undefined) {
			res.status(401).json({ erro: 'token ausente' });
			return;
		}

		const dados = exigir(req, res, ['nome']);
		if (dados === null) return;

		const estacionamento = await deps.estacionamentoService.cadastrar(auth.sub, {
			nome: dados.nome,
			endereco: endereco(req),
		});
		res.status(201).json(estacionamentoWire(estacionamento));
	});

	app.get('/estacionamentos', autenticar(deps.tokenService), async (req, res) => {
		const auth = req.auth;
		if (auth === undefined) {
			res.status(401).json({ erro: 'token ausente' });
			return;
		}

		const estacionamentos = await deps.estacionamentoService.listarDoDono(auth.sub);
		res.status(200).json(estacionamentos.map(estacionamentoWire));
	});

	app.use(errorHandler);

	return app;
}
