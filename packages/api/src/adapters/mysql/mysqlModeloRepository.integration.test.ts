import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { MysqlModeloRepository } from './mysqlModeloRepository.js';
import { createTestPool, wipe } from './testSupport.js';

let pool: Pool;

beforeAll(() => {
	pool = createTestPool();
});

afterAll(async () => {
	await pool.end();
});

beforeEach(async () => {
	await wipe(pool);
	await pool.execute(
		`INSERT INTO modelos (marca, nome, largura_mm, comprimento_mm) VALUES
		 ('Volkswagen', 'Gol', 1660, 3900),
		 ('Fiat', 'Toro', 1840, 4920),
		 ('Fiat', 'Mobi', 1640, 3570)`,
	);
});

describe('MysqlModeloRepository (integração)', () => {
	it('lista os modelos ordenados por marca e nome', async () => {
		const repo = new MysqlModeloRepository(pool);

		const modelos = await repo.listAll();

		expect(modelos.map((modelo) => `${modelo.marca} ${modelo.nome}`)).toEqual([
			'Fiat Mobi',
			'Fiat Toro',
			'Volkswagen Gol',
		]);
	});

	it('não expõe as dimensões no wire', async () => {
		const repo = new MysqlModeloRepository(pool);

		const [primeiro] = await repo.listAll();

		expect(Object.keys(primeiro ?? {}).sort()).toEqual(['id', 'marca', 'nome']);
	});

	it('devolve lista vazia quando não há modelos', async () => {
		await pool.execute('DELETE FROM modelos');
		const repo = new MysqlModeloRepository(pool);

		expect(await repo.listAll()).toEqual([]);
	});
});
