import { describe, expect, it } from 'vitest';
import type { Estacionamento, Vaga } from '../ports.js';
import { calcularMetricas } from './metricasService.js';

const PATIO: Estacionamento = {
	id: 1,
	donoId: 1,
	nome: 'Pátio Centro',
	publicado: false,
	endereco: {
		cep: null,
		logradouro: null,
		numero: null,
		bairro: null,
		complemento: null,
		cidade: null,
		estado: null,
	},
};

function vaga(noId: string, extra: Partial<Vaga> = {}): Vaga {
	return {
		id: 0,
		noId,
		numero: noId.toUpperCase(),
		tipo: 'comum',
		rotacaoGraus: 0,
		sensor: null,
		status: 'livre',
		carroId: null,
		...extra,
	};
}

const GRAFO = {
	nodes: [
		{ id: 'e1', role: 'source' },
		{ id: 'p1', role: 'attractor' },
		{ id: 't1', role: 'transit' },
		{ id: 's1', role: 'candidate' },
		{ id: 's2', role: 'candidate' },
		{ id: 's3', role: 'candidate' },
		{ id: 's4', role: 'candidate' },
	],
	edges: [{}, {}, {}],
};

describe('calcularMetricas', () => {
	it('conta vagas por status e calcula a ocupação com as reservadas', () => {
		const metricas = calcularMetricas(PATIO, 3, GRAFO, [
			vaga('s1'),
			vaga('s2', { status: 'ocupada', carroId: 9 }),
			vaga('s3', { status: 'reservada', carroId: 8 }),
			vaga('s4'),
		]);

		expect(metricas.vagas).toEqual({ total: 4, livre: 2, ocupada: 1, reservada: 1 });
		expect(metricas.taxaOcupacao).toBe(0.5);
		expect(metricas.versaoDesenho).toBe(3);
	});

	it('agrupa por tipo na ordem do enum e omite os tipos ausentes', () => {
		const metricas = calcularMetricas(PATIO, 1, GRAFO, [
			vaga('s1', { tipo: 'pcd' }),
			vaga('s2', { tipo: 'pcd', status: 'ocupada' }),
			vaga('s3'),
		]);

		expect(metricas.porTipo).toEqual([
			{ tipo: 'comum', total: 1, livres: 1 },
			{ tipo: 'pcd', total: 2, livres: 1 },
		]);
	});

	it('lê o desenho e aponta os candidates que ainda não viraram vaga', () => {
		const metricas = calcularMetricas(PATIO, 1, GRAFO, [
			vaga('s1', { sensor: 'sensor-1' }),
			vaga('s2'),
		]);

		expect(metricas.desenho).toEqual({
			entradas: 1,
			pontosDeInteresse: 1,
			vagasDesenhadas: 4,
			conexoes: 3,
		});
		expect(metricas.vagasSemCadastro).toBe(2);
		expect(metricas.comSensor).toBe(1);
	});

	it('não inventa ocupação num pátio sem topologia nem vagas', () => {
		const metricas = calcularMetricas(PATIO, 0, undefined, []);

		expect(metricas.taxaOcupacao).toBeNull();
		expect(metricas.porTipo).toEqual([]);
		expect(metricas.desenho).toEqual({
			entradas: 0,
			pontosDeInteresse: 0,
			vagasDesenhadas: 0,
			conexoes: 0,
		});
	});
});
