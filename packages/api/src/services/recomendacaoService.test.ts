import { describe, expect, it } from 'vitest';
import { UnprocessableError } from '../errors.js';
import type { Vaga } from '../ports.js';
import { montarPedido } from './recomendacaoService.js';

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
		{ id: 's5', role: 'candidate' },
	],
	edges: [],
};

const HB20 = { larguraMm: 1720, comprimentoMm: 3940 };
const ESCOLHA = { carroId: 1, poiId: 'p1', entradaId: 'e1' };

describe('montarPedido', () => {
	it('deixa de fora quem não é vaga comum livre e cadastrada', () => {
		const pedido = montarPedido(
			GRAFO,
			[
				vaga('s1'),
				vaga('s2', { status: 'ocupada', carroId: 9 }),
				vaga('s3', { status: 'reservada', carroId: 8 }),
				vaga('s4', { tipo: 'pcd' }),
			],
			HB20,
			ESCOLHA,
		);

		expect(pedido.indisponiveis).toEqual(['s2', 's3', 's4', 's5']);
	});

	it('converte as dimensões do modelo de milímetros para metros', () => {
		const pedido = montarPedido(GRAFO, [vaga('s1')], HB20, ESCOLHA);

		expect(pedido.veiculo).toEqual({ largura: 1.72, comprimento: 3.94 });
	});

	it('recusa destino que não é ponto de interesse', () => {
		expect(() =>
			montarPedido(GRAFO, [vaga('s1')], HB20, { ...ESCOLHA, poiId: 't1' }),
		).toThrow(UnprocessableError);
	});

	it('recusa entrada que não existe no pátio', () => {
		expect(() =>
			montarPedido(GRAFO, [vaga('s1')], HB20, { ...ESCOLHA, entradaId: 'e9' }),
		).toThrow(UnprocessableError);
	});
});
