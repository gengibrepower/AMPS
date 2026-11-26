import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Express, Request, RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// Arquivo de log de segurança lido pelo Fail2ban (jail amps-auth). Configurável.
const SECURITY_LOG = process.env['SECURITY_LOG'] ?? 'logs/seguranca.log';

// Em teste, não limitamos taxa nem gravamos log de segurança (os testes de
// integração fazem muitos logins de propósito).
const EM_TESTE = process.env['NODE_ENV'] === 'test';

// Limite de tentativas de login por IP numa janela — mitiga brute-force (RA3) e
// protege a disponibilidade. Ao estourar, responde 429.
const JANELA_MS = 60_000;
const MAX_TENTATIVAS = 10;

/**
 * Endurecimento global: cabeçalhos de segurança (helmet) e confiança no proxy
 * (Caddy, borda TLS) para que req.ip reflita o IP real via X-Forwarded-For.
 */
export function endurecer(app: Express): void {
	// Confia apenas em proxies de loopback (o Caddy roda em 127.0.0.1).
	app.set('trust proxy', 'loopback');
	app.use(helmet());
}

/** Rate limiter dedicado ao login. */
export const limiteLogin: RequestHandler = rateLimit({
	windowMs: JANELA_MS,
	limit: MAX_TENTATIVAS,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	skip: () => EM_TESTE,
	message: { erro: 'muitas tentativas de login; tente novamente em instantes' },
	handler: (req, res, _next, options) => {
		// Estourar o limite também é sinal de ataque: registra para o Fail2ban.
		void registrarEventoSeguranca('RATE_LIMIT', req);
		res.status(options.statusCode).json(options.message);
	},
});

/**
 * Registra um evento de segurança em formato estável (uma linha por evento),
 * pensado para ser casado por um filtro do Fail2ban:
 *   2026-11-26T12:00:00.000Z AUTH_FAIL ip=127.0.0.1 email=alvo@x
 */
export async function registrarEventoSeguranca(
	tipo: 'AUTH_FAIL' | 'RATE_LIMIT',
	req: Request,
	email?: string,
): Promise<void> {
	if (EM_TESTE) return;
	const ip = ipDoCliente(req);
	const alvo = email ? ` email=${email}` : '';
	const linha = `${new Date().toISOString()} ${tipo} ip=${ip}${alvo}\n`;
	try {
		await mkdir(dirname(SECURITY_LOG), { recursive: true });
		await appendFile(SECURITY_LOG, linha);
	} catch {
		// Log de segurança nunca deve derrubar a requisição.
	}
	// Espelha no stdout (útil em contêiner/observabilidade).
	process.stdout.write(linha);
}

function ipDoCliente(req: Request): string {
	// req.ip já considera X-Forwarded-For por causa do trust proxy.
	return (req.ip ?? req.socket.remoteAddress ?? 'desconhecido').replace('::ffff:', '');
}
