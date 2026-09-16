import { ConflictError } from '../../errors.js';

const ER_DUP_ENTRY = 1062;

// O mysql2 não expõe a coluna violada em campo próprio: ela só aparece dentro da
// mensagem, como "Duplicate entry 'x' for key 'usuarios.email'". Daí o parse.
const KEY_PATTERN = /for key '(?:.*\.)?(.+)'/;

function isDuplicateEntry(error: unknown): error is Error & { errno: number } {
	return error instanceof Error && (error as { errno?: number }).errno === ER_DUP_ENTRY;
}

export function asConflict(error: unknown): unknown {
	if (!isDuplicateEntry(error)) {
		return error;
	}
	const match = KEY_PATTERN.exec(error.message);
	return new ConflictError(match?.[1] ?? 'chave duplicada');
}
