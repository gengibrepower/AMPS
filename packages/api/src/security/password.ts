import { hash, verify } from '@node-rs/argon2';

// argon2id é o default da lib; o enum Algorithm é const enum e não passa no verbatimModuleSyntax.
// O teste do prefixo $argon2id$ é o que garante que esse default não mude sem aviso.

export async function hashPassword(password: string): Promise<string> {
	if (password === '') {
		throw new Error('hashPassword: senha vazia');
	}
	return hash(password);
}

export async function verifyPassword(password: string, digest: string): Promise<boolean> {
	try {
		return await verify(digest, password);
	} catch {
		return false;
	}
}
