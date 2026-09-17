import { UnavailableError, UnprocessableError } from '../../errors.js';
import type { Alcancabilidade, MotorDeGrafo } from '../../ports.js';

const SERVICO = 'merlian';

interface RespostaAlcancabilidade {
	byEntrance?: readonly { entranceId?: string; reachableSlotIds?: readonly string[] }[];
	unreachableSlotIds?: readonly string[];
}

interface CorpoDeErro {
	error?: { issues?: readonly { path?: string; message?: string }[] };
}

// O Merlian recusa em dois graus: 400 quando a forma nao passa no zod, 422
// quando o grafo e incoerente. Os dois trazem issues aproveitaveis; o resto
// (rede fora, 500 dele) e indisponibilidade.
function comoRecusa(status: number, corpo: unknown): Error {
	if (status !== 400 && status !== 422) {
		return new UnavailableError(SERVICO);
	}

	const issues = (corpo as CorpoDeErro).error?.issues ?? [];
	const detalhe = issues
		.map((issue) => [issue.path, issue.message].filter(Boolean).join(' '))
		.join('; ');
	return new UnprocessableError(
		detalhe === '' ? 'grafo recusado pelo merlian' : `grafo recusado pelo merlian: ${detalhe}`,
	);
}

export class MerlianMotorDeGrafo implements MotorDeGrafo {
	constructor(private readonly baseUrl: string) {}

	async alcancabilidade(grafo: unknown): Promise<Alcancabilidade> {
		const corpo = await this.post('/v1/reachability', { graph: grafo });
		const resposta = corpo as RespostaAlcancabilidade;

		return {
			porEntrada: (resposta.byEntrance ?? []).map((entrada) => ({
				entradaId: entrada.entranceId ?? '',
				vagasAlcancaveis: entrada.reachableSlotIds ?? [],
			})),
			vagasInalcancaveis: resposta.unreachableSlotIds ?? [],
		};
	}

	private async post(rota: string, corpo: unknown): Promise<unknown> {
		let resposta: Response;
		try {
			resposta = await fetch(`${this.baseUrl}${rota}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(corpo),
			});
		} catch {
			throw new UnavailableError(SERVICO);
		}

		const lido: unknown = await resposta.json().catch(() => null);
		if (!resposta.ok) {
			throw comoRecusa(resposta.status, lido);
		}
		return lido;
	}
}
