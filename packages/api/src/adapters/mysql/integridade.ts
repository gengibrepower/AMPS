import { UnprocessableError } from '../../errors.js';

// Os triggers de 03_integridade.sql sinalizam com SQLSTATE 45000, que o mysql2
// entrega como errno 1644 e mensagem já pronta para o usuario. A CHECK do
// formato do Merlian chega como 3819, com a mensagem do MySQL citando a
// restrição violada.
const ER_SIGNAL_EXCEPTION = 1644;
const ER_CHECK_CONSTRAINT_VIOLATED = 3819;

const RESTRICAO_PATTERN = /Check constraint '(.+?)' is violated/;

function errno(error: unknown): number | null {
	return error instanceof Error ? ((error as { errno?: number }).errno ?? null) : null;
}

export function asRegraDoBanco(error: unknown): unknown {
	if (!(error instanceof Error)) {
		return error;
	}

	if (errno(error) === ER_SIGNAL_EXCEPTION) {
		return new UnprocessableError(error.message);
	}

	if (errno(error) === ER_CHECK_CONSTRAINT_VIOLATED) {
		const match = RESTRICAO_PATTERN.exec(error.message);
		return new UnprocessableError(`restricao ${match?.[1] ?? 'do banco'} violada`);
	}

	return error;
}
