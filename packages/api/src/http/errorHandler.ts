import type { ErrorRequestHandler } from 'express';
import { ConflictError, NotFoundError } from '../errors.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	if (error instanceof ConflictError) {
		res.status(409).json({ erro: error.message, campo: error.campo });
		return;
	}
	if (error instanceof NotFoundError) {
		res.status(404).json({ erro: error.message });
		return;
	}
	res.status(500).json({ erro: 'erro interno' });
};
