import type { Occupancy, ParkingGraph, SlotNode, Vec2 } from "../model.ts";

export function neighborhoodOccupancy(
	graph: ParkingGraph,
	slot: SlotNode,
	occupancy: Occupancy,
	radiusFactor: number,
): number {
	const radius = radiusFactor * slot.dimensions.length;
	const neighbors = graph.nodes.filter(
		(node): node is SlotNode =>
			node.kind === 'slot' && 
		node.id !== slot.id &&
		distance(node.position, slot.position) <= radius,
	);

	if (neighbors.length === 0) return 0;

	const occupied = neighbors.filter((neighbor) => occupancy.has(neighbor.id));
	return occupied.length / neighbors.length;
}

function distance(a: Vec2, b: Vec2): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

