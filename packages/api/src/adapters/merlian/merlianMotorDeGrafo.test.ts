import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnavailableError, UnprocessableError } from '../../errors.js';
import { MerlianMotorDeGrafo } from './merlianMotorDeGrafo.js';

const GRAFO = { nodes: [], edges: [] };

function responde(status: number, corpo: unknown): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(corpo), { status })),
	);
}

function motor(): MerlianMotorDeGrafo {
	return new MerlianMotorDeGrafo('http://merlian.teste');
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('MerlianMotorDeGrafo', () => {
	it('manda o grafo em graph e traduz a resposta', async () => {
		responde(200, {
			byEntrance: [{ entranceId: 'e1', reachableSlotIds: ['s1'] }],
			unreachableSlotIds: ['s2'],
		});

		const alcance = await motor().alcancabilidade(GRAFO);

		expect(alcance).toEqual({
			porEntrada: [{ entradaId: 'e1', vagasAlcancaveis: ['s1'] }],
			vagasInalcancaveis: ['s2'],
		});
		expect(fetch).toHaveBeenCalledWith(
			'http://merlian.teste/v1/reachability',
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ graph: GRAFO }) }),
		);
	});

	it('traduz 422 do merlian para recusa com as issues', async () => {
		responde(422, {
			error: {
				type: 'invalid_graph',
				issues: [{ path: 'edges[0].to', message: "no node with id 'x9'" }],
			},
		});

		const recusa = motor().alcancabilidade(GRAFO);

		await expect(recusa).rejects.toBeInstanceOf(UnprocessableError);
		await expect(recusa).rejects.toThrow("edges[0].to no node with id 'x9'");
	});

	it('traduz 400 do merlian, que e forma recusada pelo zod', async () => {
		responde(400, {
			error: { type: 'malformed_request', issues: [{ path: 'nodes[0].role', message: 'invalid' }] },
		});

		await expect(motor().alcancabilidade(GRAFO)).rejects.toBeInstanceOf(UnprocessableError);
	});

	it('trata erro do proprio merlian como indisponibilidade', async () => {
		responde(500, {});

		await expect(motor().alcancabilidade(GRAFO)).rejects.toBeInstanceOf(UnavailableError);
	});

	it('trata rede fora como indisponibilidade', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('fetch failed');
			}),
		);

		await expect(motor().alcancabilidade(GRAFO)).rejects.toBeInstanceOf(UnavailableError);
	});
});
