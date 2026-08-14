import type { Dimensions, ParkingGraph, SlotNode } from '@amps/contracts';
import type { Occupancy, Vehicle } from '../model.js';

export function eligibleSlots  (
	graph: ParkingGraph,
	vehicle: Vehicle,
	occupancy: Occupancy,
): readonly SlotNode[]{
	return graph.nodes.filter(
		(node) : node is  SlotNode =>
			node.kind === 'slot' &&
		!occupancy.has(node.id) &&
		accomodates(node.dimensions, vehicle.dimensions),

	);
}

function accomodates(slot: Dimensions, vehicle: Dimensions): boolean {
	return slot.width >= vehicle.width && slot.length >= vehicle.length;
}
