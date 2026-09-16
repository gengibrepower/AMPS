import { SignJWT, jwtVerify } from 'jose';
import type { TipoConta, Usuario } from '../ports.js';

const ALGORITHM = 'HS256';
const TTL = '15m';

export interface TokenClaims {
	readonly sub: number;
	readonly tipoConta: TipoConta;
}

export interface TokenService {
	sign(usuario: Usuario): Promise<string>;
	verify(token: string): Promise<TokenClaims | null>;
}

const TIPOS: readonly TipoConta[] = ['common_user', 'dono', 'p_admin'];

function isTipoConta(value: unknown): value is TipoConta {
	return typeof value === 'string' && TIPOS.includes(value as TipoConta);
}

export function createTokenService(secret: string): TokenService {
	const key = new TextEncoder().encode(secret);

	return {
		async sign(usuario) {
			return new SignJWT({ tipo_conta: usuario.tipoConta })
				.setProtectedHeader({ alg: ALGORITHM })
				// sub é string por definição do JWT; o id volta para número no verify.
				.setSubject(String(usuario.id))
				.setIssuedAt()
				.setExpirationTime(TTL)
				.sign(key);
		},

		async verify(token) {
			try {
				const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
				const sub = Number(payload.sub);
				const tipo = payload['tipo_conta'];
				if (!Number.isInteger(sub) || !isTipoConta(tipo)) {
					return null;
				}
				return { sub, tipoConta: tipo };
			} catch {
				return null;
			}
		},
	};
}
