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
