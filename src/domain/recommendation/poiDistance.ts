import type { NodeId, ParkingGraph, SlotNode, Vec2 } from "../model.js";

export function walkingDistanceToPoi(graph: ParkingGraph, slot: SlotNode, poiId: NodeId): number {
	const poi = graph.nodes.find((node) => node.kind === 'poi' && node.id === poiId);
	if (poi === undefined) throw new Error('POI nao foi encontrado: ${poiId}');
	return distance(slot.position, poi.position);
}

function distance(a: Vec2, b: Vec2): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

