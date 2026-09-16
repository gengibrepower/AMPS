import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { ConflictError } from '../../errors.js';
import { MysqlCarroRepository } from './mysqlCarroRepository.js';
import { createTestPool, wipe } from './testSupport.js';

let pool: Pool;
let modeloId: number;

beforeAll(() => {
	pool = createTestPool();
});

afterAll(async () => {
	await pool.end();
});

beforeEach(async () => {
	await wipe(pool);
	const [result] = await pool.execute<ResultSetHeader>(
		'INSERT INTO modelos (marca, nome, largura_mm, comprimento_mm) VALUES (?, ?, ?, ?)',
		['Fiat', 'Mobi', 1640, 3570],
	);
	modeloId = result.insertId;
});

describe('MysqlCarroRepository (integração)', () => {
	it('cria o carro e devolve o id gerado', async () => {
		const repo = new MysqlCarroRepository(pool);

		const criado = await repo.create({
			placa: 'ABC1D23',
			modeloId,
			proprietario: 'Ana',
		});

		expect(criado.id).toBeGreaterThan(0);
		expect(criado).toMatchObject({ placa: 'ABC1D23', modeloId, proprietario: 'Ana' });
	});

	it('acusa conflito de placa duplicada', async () => {
		const repo = new MysqlCarroRepository(pool);
		await repo.create({ placa: 'ABC1D23', modeloId, proprietario: 'Ana' });

		const duplicado = repo.create({ placa: 'ABC1D23', modeloId, proprietario: 'Bruno' });

		await expect(duplicado).rejects.toBeInstanceOf(ConflictError);
		await expect(duplicado).rejects.toMatchObject({ campo: 'placa' });
	});

	it('recusa modelo inexistente sem tratar como conflito', async () => {
		const repo = new MysqlCarroRepository(pool);

		const orfao = repo.create({ placa: 'XYZ9W88', modeloId: 999999, proprietario: 'Ana' });

		await expect(orfao).rejects.toThrow();
		await expect(orfao).rejects.not.toBeInstanceOf(ConflictError);
	});
});
