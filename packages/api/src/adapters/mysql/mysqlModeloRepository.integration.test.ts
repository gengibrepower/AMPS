import { beforeEach, describe, expect, it } from 'vitest';
import { MysqlModeloRepository } from './mysqlModeloRepository.js';
import { usarBancoDeTeste } from './testSupport.js';

const db = usarBancoDeTeste();

beforeEach(async () => {
	await db().execute(
		`INSERT INTO modelos (marca, nome, largura_mm, comprimento_mm) VALUES
		 ('Volkswagen', 'Gol', 1660, 3900),
		 ('Fiat', 'Toro', 1840, 4920),
		 ('Fiat', 'Mobi', 1640, 3570)`,
	);
});

describe('MysqlModeloRepository (integração)', () => {
	it('lista os modelos ordenados por marca e nome', async () => {
		const repo = new MysqlModeloRepository(db());

		const modelos = await repo.listAll();

		expect(modelos.map((modelo) => `${modelo.marca} ${modelo.nome}`)).toEqual([
			'Fiat Mobi',
			'Fiat Toro',
			'Volkswagen Gol',
		]);
	});

	it('não expõe as dimensões no wire', async () => {
		const repo = new MysqlModeloRepository(db());

		const [primeiro] = await repo.listAll();

		expect(Object.keys(primeiro ?? {}).sort()).toEqual(['id', 'marca', 'nome']);
	});

	it('devolve lista vazia quando não há modelos', async () => {
		await db().execute('DELETE FROM modelos');
		const repo = new MysqlModeloRepository(db());

		expect(await repo.listAll()).toEqual([]);
	});
});
