import type { RequestHandler } from 'express';
import type { TokenClaims, TokenService } from '../security/jwt.js';

declare global {
	namespace Express {
		interface Request {
			auth?: TokenClaims;
		}
	}
}

const BEARER = /^Bearer (.+)$/;

export function autenticar(tokens: TokenService): RequestHandler {
	return async (req, res, next) => {
		const match = BEARER.exec(req.header('authorization') ?? '');
		const token = match?.[1];
		if (token === undefined) {
			res.status(401).json({ erro: 'token ausente' });
			return;
		}

		const claims = await tokens.verify(token);
		if (claims === null) {
			res.status(401).json({ erro: 'token invalido' });
			return;
		}

		req.auth = claims;
		next();
	};
}
