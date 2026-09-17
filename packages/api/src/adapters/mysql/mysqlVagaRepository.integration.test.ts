import { beforeEach, describe, expect, it } from 'vitest';
import type { ResultSetHeader } from 'mysql2/promise';
import { ConflictError, UnprocessableError } from '../../errors.js';
import type { VagaDoEditor } from '../../ports.js';
import { MysqlTopologiaRepository } from './mysqlTopologiaRepository.js';
import { MysqlVagaRepository } from './mysqlVagaRepository.js';
import { usarBancoDeTeste } from './testSupport.js';

const db = usarBancoDeTeste();
let estacionamentoId: number;

function candidato(id: string, x: number): Record<string, unknown> {
	return {
		id,
		role: 'candidate',
		position: { x, y: 0 },
		dimensions: { width: 2.5, length: 5 },
	};
}

const GRAFO = {
	nodes: [
		{ id: 'e1', role: 'source', position: { x: 0, y: 0 } },
		candidato('s1', 2),
		candidato('s2', 5),
	],
	edges: [
		{ from: 'e1', to: 's1', weight: 2 },
		{ from: 'e1', to: 's2', weight: 5 },
	],
};

const A01: VagaDoEditor = {
	noId: 's1',
	numero: 'A-01',
	tipo: 'comum',
	rotacaoGraus: 0,
	sensor: null,
};

const A02: VagaDoEditor = {
	noId: 's2',
	numero: 'A-02',
	tipo: 'pcd',
	rotacaoGraus: 90,
	sensor: 'sensor-2',
};

async function criarEstacionamento(): Promise<number> {
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
	return estacionamento.insertId;
}

beforeEach(async () => {
	estacionamentoId = await criarEstacionamento();
});

describe('MysqlVagaRepository (integração)', () => {
	it('exige a topologia antes das vagas', async () => {
		const repo = new MysqlVagaRepository(db());

		const semGrafo = repo.upsertAll(estacionamentoId, [A01]);

		await expect(semGrafo).rejects.toBeInstanceOf(UnprocessableError);
		await expect(semGrafo).rejects.toThrow('vaga: no_id nao e um candidate do grafo');
	});

	describe('com a topologia gravada', () => {
		beforeEach(async () => {
			await new MysqlTopologiaRepository(db()).save(estacionamentoId, GRAFO);
		});

		it('insere as vagas e devolve ordenado por numero', async () => {
			const repo = new MysqlVagaRepository(db());

			const salvas = await repo.upsertAll(estacionamentoId, [A02, A01]);

			expect(salvas.map((vaga) => vaga.numero)).toEqual(['A-01', 'A-02']);
			expect(salvas[1]).toMatchObject({
				noId: 's2',
				tipo: 'pcd',
				rotacaoGraus: 90,
				sensor: 'sensor-2',
				status: 'livre',
				carroId: null,
			});
		});

		it('atualiza a vaga existente pelo no_id, sem duplicar', async () => {
			const repo = new MysqlVagaRepository(db());
			await repo.upsertAll(estacionamentoId, [A01]);

			const salvas = await repo.upsertAll(estacionamentoId, [
				{ ...A01, numero: 'B-09', tipo: 'moto', rotacaoGraus: 45 },
			]);

			expect(salvas).toHaveLength(1);
			expect(salvas[0]).toMatchObject({ noId: 's1', numero: 'B-09', tipo: 'moto' });
		});

		it('preserva status e carro ao reeditar a vaga', async () => {
			const repo = new MysqlVagaRepository(db());
			await repo.upsertAll(estacionamentoId, [A01]);
			await db().execute(
				"UPDATE vagas SET status = 'reservada' WHERE estacionamento_id = ? AND no_id = ?",
				[estacionamentoId, 's1'],
			);

			const salvas = await repo.upsertAll(estacionamentoId, [{ ...A01, tipo: 'idoso' }]);

			expect(salvas[0]).toMatchObject({ tipo: 'idoso', status: 'reservada' });
		});

		it('acusa conflito de numero ja usado por outra vaga', async () => {
			const repo = new MysqlVagaRepository(db());
			await repo.upsertAll(estacionamentoId, [A01]);

			const repetido = repo.upsertAll(estacionamentoId, [{ ...A02, numero: 'A-01' }]);

			await expect(repetido).rejects.toBeInstanceOf(ConflictError);
			await expect(repetido).rejects.toMatchObject({ campo: 'numero' });
		});

		it('recusa no_id que nao e candidate do grafo', async () => {
			const repo = new MysqlVagaRepository(db());

			const naoCandidate = repo.upsertAll(estacionamentoId, [{ ...A01, noId: 'e1' }]);

			await expect(naoCandidate).rejects.toThrow('vaga: no_id nao e um candidate do grafo');
		});

		it('desfaz o lote inteiro quando uma vaga falha', async () => {
			const repo = new MysqlVagaRepository(db());

			await expect(
				repo.upsertAll(estacionamentoId, [A01, { ...A02, noId: 'fantasma' }]),
			).rejects.toThrow();

			expect(await repo.listByEstacionamento(estacionamentoId)).toEqual([]);
		});

		it('acha e apaga pelo no_id', async () => {
			const repo = new MysqlVagaRepository(db());
			await repo.upsertAll(estacionamentoId, [A01, A02]);

			expect(await repo.findByNoId(estacionamentoId, 's1')).toMatchObject({ numero: 'A-01' });

			await repo.deleteByNoId(estacionamentoId, 's1');

			expect(await repo.findByNoId(estacionamentoId, 's1')).toBeNull();
			expect(await repo.listByEstacionamento(estacionamentoId)).toHaveLength(1);
		});
	});
});
