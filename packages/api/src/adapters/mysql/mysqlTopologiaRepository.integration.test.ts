import { beforeEach, describe, expect, it } from 'vitest';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { UnprocessableError } from '../../errors.js';
import { MysqlTopologiaRepository } from './mysqlTopologiaRepository.js';
import { usarBancoDeTeste } from './testSupport.js';

const db = usarBancoDeTeste();
let estacionamentoId: number;

const ENTRADA = { id: 'e1', role: 'source', position: { x: 0, y: 0 } };
const VAGA = {
	id: 's1',
	role: 'candidate',
	position: { x: 2, y: 0 },
	dimensions: { width: 2.5, length: 5 },
};

const GRAFO = { nodes: [ENTRADA, VAGA], edges: [{ from: 'e1', to: 's1', weight: 2 }] };

async function grafoGravado(): Promise<unknown> {
	const [rows] = await db().execute<RowDataPacket[]>(
		'SELECT grafo FROM topologias WHERE estacionamento_id = ?',
		[estacionamentoId],
	);
	return rows[0]?.['grafo'];
}

beforeEach(async () => {
	const [usuario] = await db().execute<ResultSetHeader>(
		'INSERT INTO usuarios (nome, email, cpf, senha, tipo_conta) VALUES (?, ?, ?, ?, ?)',
		['Ana', 'ana@ex.com', '111.222.333-44', '$argon2id$fake', 'dono'],
	);
	const [dono] = await db().execute<ResultSetHeader>(
		'INSERT INTO donos (usuario_id, razao, cnpj) VALUES (?, ?, ?)',
		[usuario.insertId, 'Ana LTDA', '12.345.678/0001-99'],
	);
	const [estacionamento] = await db().execute<ResultSetHeader>(
		'INSERT INTO estacionamentos (dono_id, nome_estacionamento) VALUES (?, ?)',
		[dono.insertId, 'Pátio Centro'],
	);
	estacionamentoId = estacionamento.insertId;
});

describe('MysqlTopologiaRepository (integração)', () => {
	it('grava a primeira topologia na versao 1', async () => {
		const repo = new MysqlTopologiaRepository(db());

		const salva = await repo.save(estacionamentoId, GRAFO);

		expect(salva).toEqual({ estacionamentoId, versao: 1 });
		expect(await grafoGravado()).toEqual(GRAFO);
	});

	it('sobe a versao e troca o grafo ao regravar', async () => {
		const repo = new MysqlTopologiaRepository(db());
		await repo.save(estacionamentoId, GRAFO);
		const semArestas = { nodes: [ENTRADA, VAGA], edges: [] };

		const salva = await repo.save(estacionamentoId, semArestas);

		expect(salva.versao).toBe(2);
		expect(await grafoGravado()).toEqual(semArestas);
	});

	it('recusa aresta para no inexistente com a mensagem do trigger', async () => {
		const repo = new MysqlTopologiaRepository(db());

		const orfa = repo.save(estacionamentoId, {
			nodes: [ENTRADA],
			edges: [{ from: 'e1', to: 'fantasma', weight: 1 }],
		});

		await expect(orfa).rejects.toBeInstanceOf(UnprocessableError);
		await expect(orfa).rejects.toThrow('grafo: aresta aponta para no inexistente');
	});

	it('recusa ids de no repetidos', async () => {
		const repo = new MysqlTopologiaRepository(db());

		const repetido = repo.save(estacionamentoId, { nodes: [ENTRADA, ENTRADA], edges: [] });

		await expect(repetido).rejects.toThrow('grafo: ha ids de no repetidos');
	});

	it('recusa candidate sem dimensions', async () => {
		const repo = new MysqlTopologiaRepository(db());

		const semDimensoes = repo.save(estacionamentoId, {
			nodes: [{ id: 's1', role: 'candidate', position: { x: 0, y: 0 } }],
			edges: [],
		});

		await expect(semDimensoes).rejects.toThrow('grafo: candidate sem dimensions');
	});

	it('recusa no com chave a mais, que o Merlian tambem recusaria', async () => {
		const repo = new MysqlTopologiaRepository(db());

		const comExtra = repo.save(estacionamentoId, {
			nodes: [{ ...VAGA, numero: 'A-12' }],
			edges: [],
		});

		await expect(comExtra).rejects.toBeInstanceOf(UnprocessableError);
		await expect(comExtra).rejects.toThrow('grafo_no_formato_do_merlian');
	});

	it('recusa remover no que ainda tem vaga', async () => {
		const repo = new MysqlTopologiaRepository(db());
		await repo.save(estacionamentoId, GRAFO);
		await db().execute(
			'INSERT INTO vagas (estacionamento_id, no_id, numero) VALUES (?, ?, ?)',
			[estacionamentoId, 's1', 'A-12'],
		);

		const semAVaga = repo.save(estacionamentoId, { nodes: [ENTRADA], edges: [] });

		await expect(semAVaga).rejects.toThrow('grafo: remove no que ainda tem vaga');
	});
});
