import { UnprocessableError } from '../errors.js';

const SENHA_MINIMA = 8;

export function exigirSenhaValida(senha: string): void {
	if (senha.length < SENHA_MINIMA) {
		throw new UnprocessableError(`a senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`);
	}
}
