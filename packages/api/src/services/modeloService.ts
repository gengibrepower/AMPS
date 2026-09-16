import type { Modelo, ModeloRepository } from '../ports.js';

export class ModeloService {
	constructor(private readonly modelos: ModeloRepository) {}

	async listar(): Promise<readonly Modelo[]> {
		return this.modelos.listAll();
	}
}
