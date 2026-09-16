import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { ConflictError } from '../../errors.js';
import type { NovoUsuario } from '../../ports.js';
import { MysqlUsuarioRepository } from './mysqlUsuarioRepository.js';
import { createTestPool, wipe } from './testSupport.js';

let pool: Pool;

const ANA: NovoUsuario = {
	nome: 'Ana',
	email: 'ana@ex.com',
	cpf: '111.222.333-44',
	senhaHash: '$argon2id$fake',
	tipoConta: 'common_user',
};

beforeAll(() => {
	pool = createTestPool();
});

afterAll(async () => {
	await pool.end();
});

beforeEach(async () => {
	await wipe(pool);
});

describe('MysqlUsuarioRepository (integração)', () => {
	it('cria o usuario e devolve o id gerado', async () => {
		const repo = new MysqlUsuarioRepository(pool);

		const criado = await repo.create(ANA);

		expect(criado.id).toBeGreaterThan(0);
		expect(criado).toMatchObject({
			nome: 'Ana',
			email: 'ana@ex.com',
			cpf: '111.222.333-44',
			tipoConta: 'common_user',
		});
	});

	it('não devolve a senha no retorno de create', async () => {
		const repo = new MysqlUsuarioRepository(pool);

		const criado = await repo.create(ANA);

		expect(criado).not.toHaveProperty('senhaHash');
	});

	it('busca por id', async () => {
		const repo = new MysqlUsuarioRepository(pool);
		const criado = await repo.create(ANA);

		expect(await repo.findById(criado.id)).toEqual(criado);
	});

	it('devolve null para id inexistente', async () => {
		const repo = new MysqlUsuarioRepository(pool);

		expect(await repo.findById(999999)).toBeNull();
	});

	it('busca por email trazendo o hash da senha', async () => {
		const repo = new MysqlUsuarioRepository(pool);
		await repo.create(ANA);

		const encontrado = await repo.findByEmail('ana@ex.com');

		expect(encontrado?.senhaHash).toBe('$argon2id$fake');
		expect(encontrado?.nome).toBe('Ana');
	});

	it('devolve null para email inexistente', async () => {
		const repo = new MysqlUsuarioRepository(pool);

		expect(await repo.findByEmail('ninguem@ex.com')).toBeNull();
	});

	it('acusa conflito de email duplicado', async () => {
		const repo = new MysqlUsuarioRepository(pool);
		await repo.create(ANA);

		const duplicado = repo.create({ ...ANA, cpf: '555.666.777-88' });

		await expect(duplicado).rejects.toBeInstanceOf(ConflictError);
		await expect(duplicado).rejects.toMatchObject({ campo: 'email' });
	});

	it('acusa conflito de cpf duplicado', async () => {
		const repo = new MysqlUsuarioRepository(pool);
		await repo.create(ANA);

		const duplicado = repo.create({ ...ANA, email: 'outra@ex.com' });

		await expect(duplicado).rejects.toBeInstanceOf(ConflictError);
		await expect(duplicado).rejects.toMatchObject({ campo: 'cpf' });
	});
});
