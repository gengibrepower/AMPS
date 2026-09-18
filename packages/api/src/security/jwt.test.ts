import { describe, expect, it } from 'vitest';
import { createTokenService } from './jwt.js';
import type { Usuario } from '../ports.js';

const SEGREDO = 'segredo-de-teste';

const ANA: Usuario = {
	id: 42,
	nome: 'Ana',
	email: 'ana@ex.com',
	cpf: '111.222.333-44',
	tipoConta: 'dono',
};

describe('createTokenService', () => {
	it('devolve o id e o tipo de conta de quem assinou', async () => {
		const tokens = createTokenService(SEGREDO);

		const claims = await tokens.verify(await tokens.sign(ANA));

		expect(claims).toEqual({ sub: 42, tipoConta: 'dono' });
	});

	it('recusa token vencido', async () => {
		const tokens = createTokenService(SEGREDO, '0s');

		expect(await tokens.verify(await tokens.sign(ANA))).toBeNull();
	});

	it('recusa token de outro segredo', async () => {
		const intruso = createTokenService('outro-segredo');

		expect(await createTokenService(SEGREDO).verify(await intruso.sign(ANA))).toBeNull();
	});
});
