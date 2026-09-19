export class ConflictError extends Error {
	constructor(readonly campo: string) {
		super(`ja existe registro com ${campo}`);
		this.name = 'ConflictError';
	}
}

export class NotFoundError extends Error {
	constructor(readonly recurso: string) {
		super(`${recurso} nao encontrado`);
		this.name = 'NotFoundError';
	}
}

export class ForbiddenError extends Error {
	constructor(readonly motivo: string) {
		super(motivo);
		this.name = 'ForbiddenError';
	}
}

// `vagas` acompanha o motivo quando a recusa aponta para vagas especificas,
// como faz o `campo` do ConflictError. Sem isso o cliente teria de interpretar
// a mensagem em portugues para saber quais vagas realcar.
export class UnprocessableError extends Error {
	constructor(
		readonly motivo: string,
		readonly vagas: readonly string[] = [],
	) {
		super(motivo);
		this.name = 'UnprocessableError';
	}
}

export class UnavailableError extends Error {
	constructor(readonly servico: string) {
		super(`${servico} indisponivel`);
		this.name = 'UnavailableError';
	}
}
