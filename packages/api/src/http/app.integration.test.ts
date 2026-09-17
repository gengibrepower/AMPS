import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { ResultSetHeader } from 'mysql2/promise';
import { usarBancoDeTeste } from '../adapters/mysql/testSupport.js';
import { createTokenService } from '../security/jwt.js';
import { montarApp } from '../composition.js';

const db = usarBancoDeTeste();
let app: Express;
let modeloId: number;

const SEGREDO = 'segredo-de-teste';

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
	});
});

beforeEach(async () => {
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
