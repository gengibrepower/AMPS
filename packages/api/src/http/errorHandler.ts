import type { ErrorRequestHandler } from 'express';
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
	UnavailableError,
	UnprocessableError,
} from '../errors.js';

interface ErroDoCorpo {
	type: string;
	status: number;
}

function ehErroDoCorpo(error: unknown): error is ErroDoCorpo {
	if (typeof error !== 'object' || error === null) return false;
	const { type, status } = error as Partial<ErroDoCorpo>;
	return (
		(type === 'entity.parse.failed' || type === 'entity.too.large') &&
		typeof status === 'number' &&
		status >= 400 &&
		status < 500
	);
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	if (error instanceof ConflictError) {
		res.status(409).json({ erro: error.message, campo: error.campo });
		return;
	}
	if (error instanceof ForbiddenError) {
		res.status(403).json({ erro: error.message });
		return;
	}
	if (error instanceof NotFoundError) {
		res.status(404).json({ erro: error.message });
		return;
	}
	if (error instanceof UnprocessableError) {
		res.status(422).json({
			erro: error.message,
			...(error.vagas.length === 0 ? {} : { vagas: error.vagas }),
		});
		return;
	}
	if (error instanceof UnavailableError) {
		res.status(503).json({ erro: error.message });
		return;
	}
	// Corpo inválido (JSON malformado ou grande demais) é erro do cliente, não do
	// servidor: o body-parser do Express sinaliza com `type` e `status` 4xx.
	if (ehErroDoCorpo(error)) {
		res.status(error.status).json({
			erro: error.type === 'entity.too.large' ? 'corpo grande demais' : 'json invalido',
		});
		return;
	}
	res.status(500).json({ erro: 'erro interno' });
};
