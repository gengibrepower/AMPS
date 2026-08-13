import type { Vehicle } from "../model";

export interface SizeBiasParams {
	readonly baselineWidth: number;
	readonly baselineLength: number;
	readonly intensity: number;
}

export const DEFAULT_SIZE_BIAS: SizeBiasParams = {
	baselineWidth: 1.85,
	baselineLength: 4.5,
	intensity: 2,
}

export function occupancyWeight(vehicle: Vehicle, params: SizeBiasParams = DEFAULT_SIZE_BIAS): number {
	const sizeExcess = Math.max(
		0,
		vehicle.dimensions.width / params.baselineWidth - 1,
		vehicle.dimensions.length / params.baselineLength - 1,
	);
	return 1 + params.intensity * sizeExcess;
}

