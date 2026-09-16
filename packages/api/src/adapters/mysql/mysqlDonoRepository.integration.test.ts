import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ConflictError } from '../../errors.js';
import type { Dono, NovoUsuario } from '../../ports.js';
import { MysqlDonoRepository } from './mysqlDonoRepository.js';
import { createTestPool, wipe } from './testSupport.js';

let pool: Pool;

const USUARIO: NovoUsuario = {
	nome: 'Ana',
	email: 'ana@ex.com',
	cpf: '111.222.333-44',
	senhaHash: '$argon2id$fake',
	tipoConta: 'dono',
};

const DONO: Dono = { razao: 'Ana Estacionamentos LTDA', cnpj: '12.345.678/0001-99' };

async function contarUsuarios(): Promise<number> {
	const [rows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM usuarios');
	return Number(rows[0]?.['total'] ?? 0);
}

beforeAll(() => {
	pool = createTestPool();
});

afterAll(async () => {
	await pool.end();
});

beforeEach(async () => {
	await wipe(pool);
});

describe('MysqlDonoRepository (integração)', () => {
	it('cria usuario e dono na mesma transação', async () => {
		const repo = new MysqlDonoRepository(pool);

		const criado = await repo.create(USUARIO, DONO);

		expect(criado.usuario.id).toBeGreaterThan(0);
		expect(criado.usuario.tipoConta).toBe('dono');
		expect(criado.dono).toEqual(DONO);
	});

	it('liga o dono ao usuario criado', async () => {
		const repo = new MysqlDonoRepository(pool);
		const criado = await repo.create(USUARIO, DONO);

		const [rows] = await pool.execute<RowDataPacket[]>(
			'SELECT usuario_id, razao, cnpj FROM donos WHERE usuario_id = ?',
			[criado.usuario.id],
		);

		expect(rows[0]).toMatchObject({
			usuario_id: criado.usuario.id,
			razao: DONO.razao,
			cnpj: DONO.cnpj,
		});
	});

	it('acusa conflito de cnpj duplicado', async () => {
		const repo = new MysqlDonoRepository(pool);
		await repo.create(USUARIO, DONO);

		const duplicado = repo.create(
			{ ...USUARIO, email: 'outra@ex.com', cpf: '555.666.777-88' },
			DONO,
		);

		await expect(duplicado).rejects.toBeInstanceOf(ConflictError);
		await expect(duplicado).rejects.toMatchObject({ campo: 'cnpj' });
	});

	it('faz rollback do usuario quando o dono falha', async () => {
		const repo = new MysqlDonoRepository(pool);
		await repo.create(USUARIO, DONO);
		const antes = await contarUsuarios();

		await expect(
			repo.create({ ...USUARIO, email: 'outra@ex.com', cpf: '555.666.777-88' }, DONO),
		).rejects.toBeInstanceOf(ConflictError);

		expect(await contarUsuarios()).toBe(antes);
	});
});
