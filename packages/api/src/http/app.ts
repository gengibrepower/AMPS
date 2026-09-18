import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import type { AuthService } from '../services/authService.js';
import type { CarroService } from '../services/carroService.js';
import type { DonoService } from '../services/donoService.js';
import type { EstacionamentoService } from '../services/estacionamentoService.js';
import type { MapaService } from '../services/mapaService.js';
import type { ModeloService } from '../services/modeloService.js';
import type { PublicacaoService } from '../services/publicacaoService.js';
import type { TopologiaService } from '../services/topologiaService.js';
import type { VagaService } from '../services/vagaService.js';
import type { UsuarioService } from '../services/usuarioService.js';
import type { TokenClaims, TokenService } from '../security/jwt.js';
import type { Endereco, Estacionamento, TipoVaga, Usuario, Vaga, VagaDoEditor } from '../ports.js';
import { autenticar } from './authMiddleware.js';
import { errorHandler } from './errorHandler.js';

export interface AppDeps {
	readonly usuarioService: UsuarioService;
	readonly donoService: DonoService;
	readonly authService: AuthService;
	readonly modeloService: ModeloService;
	readonly carroService: CarroService;
	readonly estacionamentoService: EstacionamentoService;
	readonly topologiaService: TopologiaService;
	readonly vagaService: VagaService;
	readonly mapaService: MapaService;
	readonly publicacaoService: PublicacaoService;
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

// O autenticar ja respondeu 401 quando nao ha claims; isto so estreita o tipo.
function autenticado(req: Request, res: Response): TokenClaims | null {
	if (req.auth === undefined) {
		res.status(401).json({ erro: 'token ausente' });
		return null;
	}
	return req.auth;
}

function idDaRota(req: Request, res: Response): number | null {
	const id = Number(req.params['id']);
	if (!Number.isInteger(id)) {
		res.status(400).json({ erro: 'id invalido' });
		return null;
	}
	return id;
}

const TIPOS_DE_VAGA: readonly string[] = ['comum', 'pcd', 'idoso', 'moto', 'eletrico'];

function vagasDoCorpo(req: Request, res: Response): readonly VagaDoEditor[] | null {
	const corpo: unknown = req.body;
	if (!Array.isArray(corpo)) {
		res.status(400).json({ erro: 'corpo deve ser a lista de vagas' });
		return null;
	}

	const vagas: VagaDoEditor[] = [];
	for (const item of corpo as readonly unknown[]) {
		if (typeof item !== 'object' || item === null) {
			res.status(400).json({ erro: 'vaga deve ser um objeto' });
			return null;
		}

		const registro = item as Record<string, unknown>;
		const noId = texto(registro, 'no_id');
		const numero = texto(registro, 'numero');
		if (noId === null || numero === null) {
			res.status(400).json({ erro: 'campos obrigatorios ausentes', campos: ['no_id', 'numero'] });
			return null;
		}

		const tipo = registro['tipo'] ?? 'comum';
		if (typeof tipo !== 'string' || !TIPOS_DE_VAGA.includes(tipo)) {
			res.status(400).json({ erro: 'tipo invalido', tipos: TIPOS_DE_VAGA });
			return null;
		}

		const rotacao = registro['rotacao_graus'] ?? 0;
		if (typeof rotacao !== 'number' || !Number.isInteger(rotacao)) {
			res.status(400).json({ erro: 'rotacao_graus deve ser inteiro' });
			return null;
		}

		vagas.push({
			noId,
			numero,
			tipo: tipo as TipoVaga,
			rotacaoGraus: rotacao,
			sensor: texto(registro, 'sensor'),
		});
	}

	const repetido = duplicado(vagas);
	if (repetido !== null) {
		res.status(400).json({ erro: `${repetido} repetido no corpo` });
		return null;
	}
	return vagas;
}

function duplicado(vagas: readonly VagaDoEditor[]): string | null {
	const nos = new Set(vagas.map((vaga) => vaga.noId));
	if (nos.size !== vagas.length) return 'no_id';
	const numeros = new Set(vagas.map((vaga) => vaga.numero));
	if (numeros.size !== vagas.length) return 'numero';
	return null;
}

function vagaWire(vaga: Vaga): Record<string, unknown> {
	return {
		id: vaga.id,
		no_id: vaga.noId,
		numero: vaga.numero,
		tipo: vaga.tipo,
		rotacao_graus: vaga.rotacaoGraus,
		sensor: vaga.sensor,
		status: vaga.status,
		carro_id: vaga.carroId,
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
		const auth = autenticado(req, res);
		if (auth === null) return;

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
		const auth = autenticado(req, res);
		if (auth === null) return;

		const dados = exigir(req, res, ['nome']);
		if (dados === null) return;

		const estacionamento = await deps.estacionamentoService.cadastrar(auth.sub, {
			nome: dados.nome,
			endereco: endereco(req),
		});
		res.status(201).json(estacionamentoWire(estacionamento));
	});

	app.get('/estacionamentos', autenticar(deps.tokenService), async (req, res) => {
		const auth = autenticado(req, res);
		if (auth === null) return;

		const estacionamentos = await deps.estacionamentoService.listarDoDono(auth.sub);
		res.status(200).json(estacionamentos.map(estacionamentoWire));
	});

	app.get('/estacionamentos/:id', autenticar(deps.tokenService), async (req, res) => {
		const auth = autenticado(req, res);
		if (auth === null) return;

		const id = idDaRota(req, res);
		if (id === null) return;

		res.status(200).json(estacionamentoWire(await deps.estacionamentoService.buscar(auth.sub, id)));
	});

	app.put('/estacionamentos/:id/topologia', autenticar(deps.tokenService), async (req, res) => {
		const auth = autenticado(req, res);
		if (auth === null) return;

		const id = idDaRota(req, res);
		if (id === null) return;

		// O corpo é o grafo, na mesma forma que vai para o Merlian: quem edita
		// manda o objeto que já tem. A validação do conteúdo é do banco.
		const grafo: unknown = req.body;
		if (typeof grafo !== 'object' || grafo === null || Array.isArray(grafo)) {
			res.status(400).json({ erro: 'corpo deve ser o grafo { nodes, edges }' });
			return;
		}

		const topologia = await deps.topologiaService.salvar(auth.sub, id, grafo);
		res.status(200).json({
			estacionamento_id: topologia.estacionamentoId,
			versao: topologia.versao,
		});
	});

	app.put('/estacionamentos/:id/vagas', autenticar(deps.tokenService), async (req, res) => {
		const auth = autenticado(req, res);
		if (auth === null) return;

		const id = idDaRota(req, res);
		if (id === null) return;

		const vagas = vagasDoCorpo(req, res);
		if (vagas === null) return;

		const salvas = await deps.vagaService.salvar(auth.sub, id, vagas);
		res.status(200).json(salvas.map(vagaWire));
	});

	app.delete(
		'/estacionamentos/:id/vagas/:noId',
		autenticar(deps.tokenService),
		async (req, res) => {
			const auth = autenticado(req, res);
			if (auth === null) return;

			const id = idDaRota(req, res);
			if (id === null) return;

			const noId = req.params['noId'];
			if (typeof noId !== 'string' || noId === '') {
				res.status(400).json({ erro: 'no_id invalido' });
				return;
			}

			await deps.vagaService.remover(auth.sub, id, noId);
			res.status(204).end();
		},
	);

	app.get('/estacionamentos/:id/mapa', autenticar(deps.tokenService), async (req, res) => {
		const auth = autenticado(req, res);
		if (auth === null) return;

		const id = idDaRota(req, res);
		if (id === null) return;

		const mapa = await deps.mapaService.carregar(auth.sub, id);
		res.status(200).json({
			versao: mapa.versao,
			grafo: mapa.grafo,
			vagas: mapa.vagas.map(vagaWire),
		});
	});

	app.post('/estacionamentos/:id/publicacao', autenticar(deps.tokenService), async (req, res) => {
		const auth = autenticado(req, res);
		if (auth === null) return;

		const id = idDaRota(req, res);
		if (id === null) return;

		const estacionamento = await deps.publicacaoService.publicar(auth.sub, id);
		res.status(200).json(estacionamentoWire(estacionamento));
	});

	app.delete(
		'/estacionamentos/:id/publicacao',
		autenticar(deps.tokenService),
		async (req, res) => {
			const auth = autenticado(req, res);
			if (auth === null) return;

			const id = idDaRota(req, res);
			if (id === null) return;

			const estacionamento = await deps.publicacaoService.despublicar(auth.sub, id);
			res.status(200).json(estacionamentoWire(estacionamento));
		},
	);

	app.use(errorHandler);

	return app;
}
