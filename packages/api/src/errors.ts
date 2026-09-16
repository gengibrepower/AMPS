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
