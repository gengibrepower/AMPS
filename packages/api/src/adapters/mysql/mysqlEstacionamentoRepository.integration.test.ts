import { beforeEach, describe, expect, it } from 'vitest';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Endereco } from '../../ports.js';
import { MysqlEstacionamentoRepository } from './mysqlEstacionamentoRepository.js';
import { usarBancoDeTeste } from './testSupport.js';

const db = usarBancoDeTeste();
let donoId: number;

const SEM_ENDERECO: Endereco = {
	cep: null,
	logradouro: null,
	numero: null,
	bairro: null,
	complemento: null,
	cidade: null,
	estado: null,
};

const ENDERECO: Endereco = {
	cep: '89010-000',
	logradouro: 'Rua XV de Novembro',
	numero: '1200',
	bairro: 'Centro',
	complemento: 'subsolo',
	cidade: 'Blumenau',
	estado: 'SC',
};

const GRAFO = {
	nodes: [
		{
			id: 's1',
			role: 'candidate',
			position: { x: 0, y: 0 },
			dimensions: { width: 2.5, length: 5 },
		},
	],
	edges: [],
};

async function criarDono(email: string, cpf: string, cnpj: string): Promise<number> {
	const [usuario] = await db().execute<ResultSetHeader>(
		'INSERT INTO usuarios (nome, email, cpf, senha, tipo_conta) VALUES (?, ?, ?, ?, ?)',
		['Ana', email, cpf, '$argon2id$fake', 'dono'],
	);
	const [dono] = await db().execute<ResultSetHeader>(
		'INSERT INTO donos (usuario_id, razao, cnpj) VALUES (?, ?, ?)',
		[usuario.insertId, 'Ana LTDA', cnpj],
	);
	return dono.insertId;
}

beforeEach(async () => {
	donoId = await criarDono('ana@ex.com', '111.222.333-44', '12.345.678/0001-99');
});

describe('MysqlEstacionamentoRepository (integração)', () => {
	it('cria nao publicado e devolve o id gerado', async () => {
		const repo = new MysqlEstacionamentoRepository(db());

		const criado = await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });

		expect(criado.id).toBeGreaterThan(0);
		expect(criado).toMatchObject({ donoId, nome: 'Pátio Centro', publicado: false });
	});

	it('devolve o endereço como foi gravado', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		await repo.create({ donoId, nome: 'Pátio Centro', endereco: ENDERECO });

		const [lido] = await repo.listByDono(donoId);

		expect(lido?.endereco).toEqual(ENDERECO);
	});

	it('devolve campos de endereço ausentes como null', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });

		const [lido] = await repo.listByDono(donoId);

		expect(lido?.endereco).toEqual(SEM_ENDERECO);
	});

	it('lista apenas os estacionamentos do dono pedido', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		const outroDono = await criarDono('bruno@ex.com', '555.666.777-88', '98.765.432/0001-11');
		await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });
		await repo.create({ donoId: outroDono, nome: 'Pátio do Bruno', endereco: SEM_ENDERECO });

		const meus = await repo.listByDono(donoId);

		expect(meus.map((e) => e.nome)).toEqual(['Pátio Centro']);
	});

	it('acha pelo id, com o dono junto para a checagem de propriedade', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		const criado = await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });

		const achado = await repo.findById(criado.id);

		expect(achado).toEqual(criado);
	});

	it('devolve null para id inexistente', async () => {
		const repo = new MysqlEstacionamentoRepository(db());

		expect(await repo.findById(999999)).toBeNull();
	});

	it('troca nome e endereco, mantendo dono e publicacao', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		const criado = await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });
		await repo.setPublicado(criado.id, true);

		const editado = await repo.update(criado.id, { nome: 'Pátio Norte', endereco: ENDERECO });

		expect(editado).toEqual({
			id: criado.id,
			donoId,
			nome: 'Pátio Norte',
			publicado: true,
			endereco: ENDERECO,
		});
	});

	it('apaga campo de endereco que voltou vazio', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		const criado = await repo.create({ donoId, nome: 'Pátio Centro', endereco: ENDERECO });

		const editado = await repo.update(criado.id, {
			nome: 'Pátio Centro',
			endereco: SEM_ENDERECO,
		});

		expect(editado.endereco).toEqual(SEM_ENDERECO);
	});

	it('apaga o estacionamento', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		const criado = await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });

		await repo.delete(criado.id);

		expect(await repo.findById(criado.id)).toBeNull();
	});

	it('leva topologia e vagas junto, por cascade', async () => {
		const repo = new MysqlEstacionamentoRepository(db());
		const criado = await repo.create({ donoId, nome: 'Pátio Centro', endereco: SEM_ENDERECO });
		await db().execute('INSERT INTO topologias (estacionamento_id, grafo) VALUES (?, ?)', [
			criado.id,
			JSON.stringify(GRAFO),
		]);
		await db().execute(
			'INSERT INTO vagas (estacionamento_id, no_id, numero) VALUES (?, ?, ?)',
			[criado.id, 's1', 'A-01'],
		);

		await repo.delete(criado.id);

		const [topologias] = await db().execute<RowDataPacket[]>(
			'SELECT id FROM topologias WHERE estacionamento_id = ?',
			[criado.id],
		);
		const [vagas] = await db().execute<RowDataPacket[]>(
			'SELECT id FROM vagas WHERE estacionamento_id = ?',
			[criado.id],
		);
		expect(topologias).toEqual([]);
		expect(vagas).toEqual([]);
	});

	it('recusa dono inexistente', async () => {
		const repo = new MysqlEstacionamentoRepository(db());

		const orfao = repo.create({ donoId: 999999, nome: 'Pátio Fantasma', endereco: SEM_ENDERECO });

		await expect(orfao).rejects.toThrow();
	});
});
