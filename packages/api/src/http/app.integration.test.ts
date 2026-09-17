import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { ResultSetHeader } from 'mysql2/promise';
import { UnavailableError } from '../errors.js';
import type { Alcancabilidade, MotorDeGrafo } from '../ports.js';
import { usarBancoDeTeste } from '../adapters/mysql/testSupport.js';
import { createTokenService } from '../security/jwt.js';
import { montarApp } from '../composition.js';

const db = usarBancoDeTeste();
let app: Express;
let modeloId: number;

const SEGREDO = 'segredo-de-teste';

const TUDO_ALCANCAVEL: Alcancabilidade = {
	porEntrada: [{ entradaId: 'e1', vagasAlcancaveis: ['s1', 's2'] }],
	vagasInalcancaveis: [],
};

// O Merlian de verdade é um serviço à parte; aqui a resposta é combinada por teste.
const merlian = {
	resposta: TUDO_ALCANCAVEL,
	erro: null as Error | null,
	alcancabilidade(): Promise<Alcancabilidade> {
		return merlian.erro === null
			? Promise.resolve(merlian.resposta)
			: Promise.reject(merlian.erro);
	},
} satisfies MotorDeGrafo & Record<string, unknown>;

const CADASTRO = {
	nome: 'Ana',
	email: 'ana@ex.com',
	cpf: '111.222.333-44',
	senha: 'senha-secreta',
};

beforeAll(() => {
	app = montarApp({
		pool: db(),
		jwtSecret: SEGREDO,
		corsOrigin: 'http://localhost:5173',
		motorDeGrafo: merlian,
	});
});

beforeEach(async () => {
	merlian.resposta = TUDO_ALCANCAVEL;
	merlian.erro = null;

	const [result] = await db().execute<ResultSetHeader>(
		'INSERT INTO modelos (marca, nome, largura_mm, comprimento_mm) VALUES (?, ?, ?, ?)',
		['Fiat', 'Mobi', 1640, 3570],
	);
	modeloId = result.insertId;
});

describe('POST /usuarios', () => {
	it('cadastra e devolve 201 sem vazar senha', async () => {
		const resposta = await request(app).post('/usuarios').send(CADASTRO);

		expect(resposta.status).toBe(201);
		expect(resposta.body).toMatchObject({
			nome: 'Ana',
			email: 'ana@ex.com',
			tipo_conta: 'common_user',
		});
		expect(resposta.body.id).toBeGreaterThan(0);
		expect(JSON.stringify(resposta.body)).not.toContain('senha-secreta');
	});

	it('devolve 409 para email duplicado', async () => {
		await request(app).post('/usuarios').send(CADASTRO);

		const resposta = await request(app)
			.post('/usuarios')
			.send({ ...CADASTRO, cpf: '555.666.777-88' });

		expect(resposta.status).toBe(409);
		expect(resposta.body.campo).toBe('email');
	});

	it('devolve 400 quando falta campo obrigatorio', async () => {
		const resposta = await request(app).post('/usuarios').send({ nome: 'Ana' });

		expect(resposta.status).toBe(400);
		expect(resposta.body.campos).toEqual(['email', 'cpf', 'senha']);
	});
});

describe('POST /donos', () => {
	it('cadastra usuario dono e devolve 201', async () => {
		const resposta = await request(app)
			.post('/donos')
			.send({ ...CADASTRO, razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' });

		expect(resposta.status).toBe(201);
		expect(resposta.body).toMatchObject({
			nome: 'Ana',
			email: 'ana@ex.com',
			tipo_conta: 'dono',
			dono: { razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' },
		});
	});

	it('devolve 409 para cnpj duplicado', async () => {
		const dono = { ...CADASTRO, razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' };
		await request(app).post('/donos').send(dono);

		const resposta = await request(app)
			.post('/donos')
			.send({ ...dono, email: 'outra@ex.com', cpf: '555.666.777-88' });

		expect(resposta.status).toBe(409);
		expect(resposta.body.campo).toBe('cnpj');
	});
});

describe('GET /modelos', () => {
	it('lista modelos sem as dimensões', async () => {
		const resposta = await request(app).get('/modelos');

		expect(resposta.status).toBe(200);
		expect(resposta.body).toEqual([{ id: modeloId, marca: 'Fiat', nome: 'Mobi' }]);
	});
});

describe('POST /auth/login', () => {
	it('devolve token e usuario para credenciais validas', async () => {
		await request(app).post('/usuarios').send(CADASTRO);

		const resposta = await request(app)
			.post('/auth/login')
			.send({ email: CADASTRO.email, senha: CADASTRO.senha });

		expect(resposta.status).toBe(200);
		expect(typeof resposta.body.token).toBe('string');
		expect(resposta.body.usuario).toMatchObject({
			nome: 'Ana',
			email: 'ana@ex.com',
			tipo_conta: 'common_user',
		});
	});

	it('devolve 401 para senha errada', async () => {
		await request(app).post('/usuarios').send(CADASTRO);

		const resposta = await request(app)
			.post('/auth/login')
			.send({ email: CADASTRO.email, senha: 'errada' });

		expect(resposta.status).toBe(401);
	});

	it('devolve 401 para email inexistente', async () => {
		const resposta = await request(app)
			.post('/auth/login')
			.send({ email: 'ninguem@ex.com', senha: 'seja-la' });

		expect(resposta.status).toBe(401);
	});
});

describe('fluxo cadastro -> login -> POST /carros', () => {
	async function tokenDeAna(): Promise<string> {
		await request(app).post('/usuarios').send(CADASTRO);
		const login = await request(app)
			.post('/auth/login')
			.send({ email: CADASTRO.email, senha: CADASTRO.senha });
		return login.body.token as string;
	}

	it('cria o carro usando o nome do usuario do token como proprietario', async () => {
		const token = await tokenDeAna();

		const resposta = await request(app)
			.post('/carros')
			.set('Authorization', `Bearer ${token}`)
			.send({ placa: 'ABC1D23', modelo_id: modeloId });

		expect(resposta.status).toBe(201);
		expect(resposta.body).toMatchObject({
			placa: 'ABC1D23',
			modelo_id: modeloId,
			proprietario: 'Ana',
		});
	});

	it('ignora proprietario enviado no corpo', async () => {
		const token = await tokenDeAna();

		const resposta = await request(app)
			.post('/carros')
			.set('Authorization', `Bearer ${token}`)
			.send({ placa: 'ABC1D23', modelo_id: modeloId, proprietario: 'Impostor' });

		expect(resposta.body.proprietario).toBe('Ana');
	});

	it('devolve 401 sem token', async () => {
		const resposta = await request(app)
			.post('/carros')
			.send({ placa: 'ABC1D23', modelo_id: modeloId });

		expect(resposta.status).toBe(401);
	});

	it('devolve 401 com token invalido', async () => {
		const resposta = await request(app)
			.post('/carros')
			.set('Authorization', 'Bearer nao-e-um-token')
			.send({ placa: 'ABC1D23', modelo_id: modeloId });

		expect(resposta.status).toBe(401);
	});

	it('devolve 401 com token assinado por outro segredo', async () => {
		await request(app).post('/usuarios').send(CADASTRO);
		const intruso = createTokenService('outro-segredo');
		const token = await intruso.sign({
			id: 1,
			nome: 'Ana',
			email: CADASTRO.email,
			cpf: CADASTRO.cpf,
			tipoConta: 'common_user',
		});

		const resposta = await request(app)
			.post('/carros')
			.set('Authorization', `Bearer ${token}`)
			.send({ placa: 'ABC1D23', modelo_id: modeloId });

		expect(resposta.status).toBe(401);
	});

	it('devolve 409 para placa duplicada', async () => {
		const token = await tokenDeAna();
		const carro = { placa: 'ABC1D23', modelo_id: modeloId };
		await request(app).post('/carros').set('Authorization', `Bearer ${token}`).send(carro);

		const resposta = await request(app)
			.post('/carros')
			.set('Authorization', `Bearer ${token}`)
			.send(carro);

		expect(resposta.status).toBe(409);
		expect(resposta.body.campo).toBe('placa');
	});
});

describe('estacionamentos', () => {
	const DONO = { ...CADASTRO, razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' };

	const OUTRO_DONO = {
		nome: 'Bruno',
		email: 'bruno@ex.com',
		cpf: '555.666.777-88',
		senha: 'outra-senha',
		razao: 'Bruno LTDA',
		cnpj: '98.765.432/0001-11',
	};

	async function login(email: string, senha: string): Promise<string> {
		const resposta = await request(app).post('/auth/login').send({ email, senha });
		return resposta.body.token as string;
	}

	async function tokenDeDono(dono = DONO): Promise<string> {
		await request(app).post('/donos').send(dono);
		return login(dono.email, dono.senha);
	}

	async function tokenDeUsuarioComum(): Promise<string> {
		await request(app).post('/usuarios').send(CADASTRO);
		return login(CADASTRO.email, CADASTRO.senha);
	}

	it('cadastra para o dono do token e nasce nao publicado', async () => {
		const token = await tokenDeDono();

		const resposta = await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ nome: 'Pátio Centro', cidade: 'Blumenau', estado: 'SC' });

		expect(resposta.status).toBe(201);
		expect(resposta.body).toMatchObject({ nome: 'Pátio Centro', publicado: false });
		expect(resposta.body.id).toBeGreaterThan(0);
		expect(resposta.body.endereco).toMatchObject({
			cidade: 'Blumenau',
			estado: 'SC',
			cep: null,
		});
	});

	it('lista so os estacionamentos do dono do token', async () => {
		const token = await tokenDeDono();
		await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ nome: 'Pátio Centro' });

		const tokenDoBruno = await tokenDeDono(OUTRO_DONO);
		await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${tokenDoBruno}`)
			.send({ nome: 'Pátio do Bruno' });

		const resposta = await request(app)
			.get('/estacionamentos')
			.set('Authorization', `Bearer ${tokenDoBruno}`);

		expect(resposta.status).toBe(200);
		expect(resposta.body.map((e: { nome: string }) => e.nome)).toEqual(['Pátio do Bruno']);
	});

	it('lista vazia para dono sem estacionamento', async () => {
		const token = await tokenDeDono();

		const resposta = await request(app)
			.get('/estacionamentos')
			.set('Authorization', `Bearer ${token}`);

		expect(resposta.status).toBe(200);
		expect(resposta.body).toEqual([]);
	});

	it('devolve 403 para usuario comum, que nao tem linha em donos', async () => {
		const token = await tokenDeUsuarioComum();

		const criacao = await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ nome: 'Pátio Centro' });
		const listagem = await request(app)
			.get('/estacionamentos')
			.set('Authorization', `Bearer ${token}`);

		expect(criacao.status).toBe(403);
		expect(listagem.status).toBe(403);
	});

	it('devolve 401 sem token', async () => {
		const criacao = await request(app).post('/estacionamentos').send({ nome: 'Pátio Centro' });
		const listagem = await request(app).get('/estacionamentos');

		expect(criacao.status).toBe(401);
		expect(listagem.status).toBe(401);
	});

	it('devolve 400 quando falta o nome', async () => {
		const token = await tokenDeDono();

		const resposta = await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ cidade: 'Blumenau' });

		expect(resposta.status).toBe(400);
		expect(resposta.body.campos).toEqual(['nome']);
	});
});

describe('PUT /estacionamentos/:id/topologia', () => {
	const DONO = { ...CADASTRO, razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' };

	const OUTRO_DONO = {
		nome: 'Bruno',
		email: 'bruno@ex.com',
		cpf: '555.666.777-88',
		senha: 'outra-senha',
		razao: 'Bruno LTDA',
		cnpj: '98.765.432/0001-11',
	};

	const GRAFO = {
		nodes: [
			{ id: 'e1', role: 'source', position: { x: 0, y: 0 } },
			{
				id: 's1',
				role: 'candidate',
				position: { x: 2, y: 0 },
				dimensions: { width: 2.5, length: 5 },
			},
		],
		edges: [{ from: 'e1', to: 's1', weight: 2 }],
	};

	async function tokenDeDono(dono = DONO): Promise<string> {
		await request(app).post('/donos').send(dono);
		const login = await request(app)
			.post('/auth/login')
			.send({ email: dono.email, senha: dono.senha });
		return login.body.token as string;
	}

	async function criarEstacionamento(token: string): Promise<number> {
		const resposta = await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ nome: 'Pátio Centro' });
		return resposta.body.id as number;
	}

	it('grava o grafo e devolve a versao', async () => {
		const token = await tokenDeDono();
		const id = await criarEstacionamento(token);

		const resposta = await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${token}`)
			.send(GRAFO);

		expect(resposta.status).toBe(200);
		expect(resposta.body).toEqual({ estacionamento_id: id, versao: 1 });
	});

	it('sobe a versao a cada regravacao', async () => {
		const token = await tokenDeDono();
		const id = await criarEstacionamento(token);
		await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${token}`)
			.send(GRAFO);

		const resposta = await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${token}`)
			.send({ ...GRAFO, edges: [] });

		expect(resposta.body.versao).toBe(2);
	});

	it('devolve 422 com a mensagem do trigger para grafo incoerente', async () => {
		const token = await tokenDeDono();
		const id = await criarEstacionamento(token);

		const resposta = await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${token}`)
			.send({ nodes: GRAFO.nodes, edges: [{ from: 'e1', to: 'fantasma', weight: 1 }] });

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toBe('grafo: aresta aponta para no inexistente');
	});

	it('devolve 422 para no com chave que o Merlian nao aceita', async () => {
		const token = await tokenDeDono();
		const id = await criarEstacionamento(token);

		const resposta = await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${token}`)
			.send({ nodes: [{ id: 'w1', role: 'transit', position: { x: 0, y: 0 }, cor: 'azul' }], edges: [] });

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toContain('grafo_no_formato_do_merlian');
	});

	it('devolve 403 para estacionamento de outro dono', async () => {
		const token = await tokenDeDono();
		const id = await criarEstacionamento(token);
		const tokenDoBruno = await tokenDeDono(OUTRO_DONO);

		const resposta = await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${tokenDoBruno}`)
			.send(GRAFO);

		expect(resposta.status).toBe(403);
	});

	it('devolve 404 para estacionamento inexistente', async () => {
		const token = await tokenDeDono();

		const resposta = await request(app)
			.put('/estacionamentos/999999/topologia')
			.set('Authorization', `Bearer ${token}`)
			.send(GRAFO);

		expect(resposta.status).toBe(404);
	});

	it('devolve 401 sem token', async () => {
		const resposta = await request(app).put('/estacionamentos/1/topologia').send(GRAFO);

		expect(resposta.status).toBe(401);
	});

	it('devolve 400 quando o corpo nao e o grafo', async () => {
		const token = await tokenDeDono();
		const id = await criarEstacionamento(token);

		const resposta = await request(app)
			.put(`/estacionamentos/${id}/topologia`)
			.set('Authorization', `Bearer ${token}`)
			.send([]);

		expect(resposta.status).toBe(400);
	});
});

describe('vagas e mapa', () => {
	const DONO = { ...CADASTRO, razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' };

	const OUTRO_DONO = {
		nome: 'Bruno',
		email: 'bruno@ex.com',
		cpf: '555.666.777-88',
		senha: 'outra-senha',
		razao: 'Bruno LTDA',
		cnpj: '98.765.432/0001-11',
	};

	const GRAFO = {
		nodes: [
			{ id: 'e1', role: 'source', position: { x: 0, y: 0 } },
			{
				id: 's1',
				role: 'candidate',
				position: { x: 2, y: 0 },
				dimensions: { width: 2.5, length: 5 },
			},
			{
				id: 's2',
				role: 'candidate',
				position: { x: 5, y: 0 },
				dimensions: { width: 2.5, length: 5 },
			},
		],
		edges: [
			{ from: 'e1', to: 's1', weight: 2 },
			{ from: 'e1', to: 's2', weight: 5 },
		],
	};

	let token: string;
	let estacionamentoId: number;

	async function tokenDeDono(dono = DONO): Promise<string> {
		await request(app).post('/donos').send(dono);
		const entrada = await request(app)
			.post('/auth/login')
			.send({ email: dono.email, senha: dono.senha });
		return entrada.body.token as string;
	}

	// Sem async: o encadeamento do supertest (.send) se perde ao virar Promise.
	function comAutorizacao(metodo: 'put' | 'get' | 'delete', rota: string) {
		return request(app)[metodo](rota).set('Authorization', `Bearer ${token}`);
	}

	beforeEach(async () => {
		token = await tokenDeDono();
		const criado = await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ nome: 'Pátio Centro' });
		estacionamentoId = criado.body.id as number;
	});

	async function comTopologia(): Promise<void> {
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/topologia`).send(GRAFO);
	}

	it('grava as vagas e devolve a lista inteira', async () => {
		await comTopologia();

		const resposta = await comAutorizacao(
			'put',
			`/estacionamentos/${estacionamentoId}/vagas`,
		).send([
			{ no_id: 's1', numero: 'A-01' },
			{ no_id: 's2', numero: 'A-02', tipo: 'pcd', rotacao_graus: 90, sensor: 'sensor-2' },
		]);

		expect(resposta.status).toBe(200);
		expect(resposta.body).toHaveLength(2);
		expect(resposta.body[0]).toMatchObject({
			no_id: 's1',
			numero: 'A-01',
			tipo: 'comum',
			rotacao_graus: 0,
			sensor: null,
			status: 'livre',
			carro_id: null,
		});
		expect(resposta.body[1]).toMatchObject({ tipo: 'pcd', rotacao_graus: 90 });
	});

	it('devolve 422 quando a vaga vem antes da topologia', async () => {
		const resposta = await comAutorizacao(
			'put',
			`/estacionamentos/${estacionamentoId}/vagas`,
		).send([{ no_id: 's1', numero: 'A-01' }]);

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toBe('vaga: no_id nao e um candidate do grafo');
	});

	it('devolve 409 para numero ja usado por outra vaga', async () => {
		await comTopologia();
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/vagas`).send([
			{ no_id: 's1', numero: 'A-01' },
		]);

		const resposta = await comAutorizacao(
			'put',
			`/estacionamentos/${estacionamentoId}/vagas`,
		).send([{ no_id: 's2', numero: 'A-01' }]);

		expect(resposta.status).toBe(409);
		expect(resposta.body.campo).toBe('numero');
	});

	it('devolve 400 para tipo fora do enum', async () => {
		await comTopologia();

		const resposta = await comAutorizacao(
			'put',
			`/estacionamentos/${estacionamentoId}/vagas`,
		).send([{ no_id: 's1', numero: 'A-01', tipo: 'helicoptero' }]);

		expect(resposta.status).toBe(400);
	});

	it('devolve 400 para no_id repetido no corpo', async () => {
		await comTopologia();

		const resposta = await comAutorizacao(
			'put',
			`/estacionamentos/${estacionamentoId}/vagas`,
		).send([
			{ no_id: 's1', numero: 'A-01' },
			{ no_id: 's1', numero: 'A-02' },
		]);

		expect(resposta.status).toBe(400);
		expect(resposta.body.erro).toContain('no_id');
	});

	it('apaga a vaga e libera o no para sair do grafo', async () => {
		await comTopologia();
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/vagas`).send([
			{ no_id: 's1', numero: 'A-01' },
		]);

		const remocao = await comAutorizacao(
			'delete',
			`/estacionamentos/${estacionamentoId}/vagas/s1`,
		);
		const semONo = await comAutorizacao(
			'put',
			`/estacionamentos/${estacionamentoId}/topologia`,
		).send({ nodes: [GRAFO.nodes[0]], edges: [] });

		expect(remocao.status).toBe(204);
		expect(semONo.status).toBe(200);
	});

	it('devolve 404 ao apagar vaga inexistente', async () => {
		await comTopologia();

		const resposta = await comAutorizacao(
			'delete',
			`/estacionamentos/${estacionamentoId}/vagas/s1`,
		);

		expect(resposta.status).toBe(404);
	});

	it('recusa apagar vaga que nao esta livre', async () => {
		await comTopologia();
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/vagas`).send([
			{ no_id: 's1', numero: 'A-01' },
		]);
		await db().execute(
			"UPDATE vagas SET status = 'reservada' WHERE estacionamento_id = ? AND no_id = ?",
			[estacionamentoId, 's1'],
		);

		const resposta = await comAutorizacao(
			'delete',
			`/estacionamentos/${estacionamentoId}/vagas/s1`,
		);

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toContain('reservada');
	});

	it('abre o mapa vazio num estacionamento sem topologia', async () => {
		const resposta = await comAutorizacao('get', `/estacionamentos/${estacionamentoId}/mapa`);

		expect(resposta.status).toBe(200);
		expect(resposta.body).toEqual({ versao: 0, grafo: { nodes: [], edges: [] }, vagas: [] });
	});

	it('devolve grafo e vagas juntos, casados pelo no_id', async () => {
		await comTopologia();
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/vagas`).send([
			{ no_id: 's1', numero: 'A-01' },
		]);

		const resposta = await comAutorizacao('get', `/estacionamentos/${estacionamentoId}/mapa`);

		expect(resposta.status).toBe(200);
		expect(resposta.body.versao).toBe(1);
		expect(resposta.body.grafo).toEqual(GRAFO);
		expect(resposta.body.vagas).toHaveLength(1);
		expect(resposta.body.vagas[0].no_id).toBe('s1');
	});

	it('devolve 403 no mapa de outro dono', async () => {
		const tokenDoBruno = await tokenDeDono(OUTRO_DONO);

		const resposta = await request(app)
			.get(`/estacionamentos/${estacionamentoId}/mapa`)
			.set('Authorization', `Bearer ${tokenDoBruno}`);

		expect(resposta.status).toBe(403);
	});

	it('devolve 401 sem token', async () => {
		const mapa = await request(app).get(`/estacionamentos/${estacionamentoId}/mapa`);
		const gravacao = await request(app)
			.put(`/estacionamentos/${estacionamentoId}/vagas`)
			.send([{ no_id: 's1', numero: 'A-01' }]);

		expect(mapa.status).toBe(401);
		expect(gravacao.status).toBe(401);
	});
});

describe('publicacao', () => {
	const DONO = { ...CADASTRO, razao: 'Ana LTDA', cnpj: '12.345.678/0001-99' };

	const OUTRO_DONO = {
		nome: 'Bruno',
		email: 'bruno@ex.com',
		cpf: '555.666.777-88',
		senha: 'outra-senha',
		razao: 'Bruno LTDA',
		cnpj: '98.765.432/0001-11',
	};

	const GRAFO = {
		nodes: [
			{ id: 'e1', role: 'source', position: { x: 0, y: 0 } },
			{
				id: 's1',
				role: 'candidate',
				position: { x: 2, y: 0 },
				dimensions: { width: 2.5, length: 5 },
			},
		],
		edges: [{ from: 'e1', to: 's1', weight: 2 }],
	};

	let token: string;
	let estacionamentoId: number;

	function comAutorizacao(metodo: 'put' | 'post' | 'delete', rota: string) {
		return request(app)[metodo](rota).set('Authorization', `Bearer ${token}`);
	}

	beforeEach(async () => {
		await request(app).post('/donos').send(DONO);
		const entrada = await request(app)
			.post('/auth/login')
			.send({ email: DONO.email, senha: DONO.senha });
		token = entrada.body.token as string;

		const criado = await request(app)
			.post('/estacionamentos')
			.set('Authorization', `Bearer ${token}`)
			.send({ nome: 'Pátio Centro' });
		estacionamentoId = criado.body.id as number;
	});

	async function comLayout(): Promise<void> {
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/topologia`).send(GRAFO);
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/vagas`).send([
			{ no_id: 's1', numero: 'A-01' },
		]);
	}

	it('publica quando toda vaga alcanca uma entrada', async () => {
		await comLayout();

		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(200);
		expect(resposta.body).toMatchObject({ id: estacionamentoId, publicado: true });
	});

	it('recusa quando alguma vaga nao tem caminho ate a entrada (RN-11)', async () => {
		await comLayout();
		merlian.resposta = {
			porEntrada: [{ entradaId: 'e1', vagasAlcancaveis: [] }],
			vagasInalcancaveis: ['s1'],
		};

		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toBe('vagas sem caminho ate uma entrada: A-01');
	});

	it('ignora candidate do grafo que ainda nao virou vaga', async () => {
		await comLayout();
		merlian.resposta = {
			porEntrada: [{ entradaId: 'e1', vagasAlcancaveis: ['s1'] }],
			vagasInalcancaveis: ['s9'],
		};

		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(200);
	});

	it('recusa grafo sem entrada', async () => {
		await comLayout();
		merlian.resposta = { porEntrada: [], vagasInalcancaveis: [] };

		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toBe('grafo sem entrada');
	});

	it('recusa estacionamento sem topologia', async () => {
		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toBe('estacionamento sem topologia');
	});

	it('recusa estacionamento sem vagas', async () => {
		await comAutorizacao('put', `/estacionamentos/${estacionamentoId}/topologia`).send(GRAFO);

		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(422);
		expect(resposta.body.erro).toBe('estacionamento sem vagas');
	});

	it('devolve 503 quando o merlian esta fora', async () => {
		await comLayout();
		merlian.erro = new UnavailableError('merlian');

		const resposta = await comAutorizacao(
			'post',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(503);
		expect(resposta.body.erro).toBe('merlian indisponivel');
	});

	it('despublica sem consultar o merlian', async () => {
		await comLayout();
		await comAutorizacao('post', `/estacionamentos/${estacionamentoId}/publicacao`);
		merlian.erro = new UnavailableError('merlian');

		const resposta = await comAutorizacao(
			'delete',
			`/estacionamentos/${estacionamentoId}/publicacao`,
		);

		expect(resposta.status).toBe(200);
		expect(resposta.body.publicado).toBe(false);
	});

	it('devolve 403 ao publicar patio de outro dono', async () => {
		await comLayout();
		await request(app).post('/donos').send(OUTRO_DONO);
		const entrada = await request(app)
			.post('/auth/login')
			.send({ email: OUTRO_DONO.email, senha: OUTRO_DONO.senha });

		const resposta = await request(app)
			.post(`/estacionamentos/${estacionamentoId}/publicacao`)
			.set('Authorization', `Bearer ${entrada.body.token as string}`);

		expect(resposta.status).toBe(403);
	});
});
