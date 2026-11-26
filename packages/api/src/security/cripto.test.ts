import { describe, expect, it } from 'vitest';
import { cifrar, decifrar } from './cripto.js';

describe('cripto (AES-256-GCM em repouso)', () => {
	it('cifra e decifra de volta ao valor original', () => {
		const cpf = '123.456.789-09';
		const cifrado = cifrar(cpf);
		expect(cifrado).not.toBe(cpf);
		expect(cifrado.startsWith('enc:v1:')).toBe(true);
		expect(decifrar(cifrado)).toBe(cpf);
	});

	it('é determinístico (mesmo valor -> mesmo texto cifrado) p/ preservar UNIQUE', () => {
		expect(cifrar('529.982.247-25')).toBe(cifrar('529.982.247-25'));
	});

	it('valores diferentes geram textos cifrados diferentes', () => {
		expect(cifrar('111.111.111-11')).not.toBe(cifrar('222.222.222-22'));
	});

	it('é idempotente: cifrar algo já cifrado não re-cifra', () => {
		const uma = cifrar('000.000.000-00');
		expect(cifrar(uma)).toBe(uma);
	});

	it('trata valor legado em claro (sem prefixo) como passthrough', () => {
		expect(decifrar('123.456.789-09')).toBe('123.456.789-09');
	});

	it('detecta adulteração (GCM) e lança', () => {
		const cifrado = cifrar('987.654.321-00');
		const adulterado = cifrado.slice(0, -4) + (cifrado.endsWith('AAAA') ? 'BBBB' : 'AAAA');
		expect(() => decifrar(adulterado)).toThrow();
	});
});
