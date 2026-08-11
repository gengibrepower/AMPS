import type { NodeId, ParkingGraph } from '../model.js';
import type { Path, PathfindingService } from '../ports.js';

export function dijkstra(graph: ParkingGraph, from: NodeId, to: NodeId): Path | null {
  const adjacency = new Map<NodeId, readonly { readonly to: NodeId; readonly weight: number }[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    const outgoing = adjacency.get(edge.from);
    if (outgoing) adjacency.set(edge.from, [...outgoing, { to: edge.to, weight: edge.weight }]);
  }

  const distance = new Map<NodeId, number>([[from, 0]]);
  const previous = new Map<NodeId, NodeId>();
  const settled = new Set<NodeId>();

  while (true) {
    let current: NodeId | null = null;
    let currentDistance = Infinity;
    for (const [id, dist] of distance) {
      if (!settled.has(id) && dist < currentDistance) {
        current = id;
        currentDistance = dist;
      }
    }
    if (current === null || current === to) break;
    settled.add(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const tentative = currentDistance + neighbor.weight;
      if (tentative < (distance.get(neighbor.to) ?? Infinity)) {
        distance.set(neighbor.to, tentative);
        previous.set(neighbor.to, current);
      }
    }
  }

  const totalWeight = distance.get(to);
  if (totalWeight === undefined) return null;

  const nodes: NodeId[] = [];
  let step: NodeId | undefined = to;
  while (step !== undefined) {
    nodes.unshift(step);
    step = previous.get(step);
  }
  return { nodes, totalWeight };
}

export const dijkstraPathfinding: PathfindingService = {
  shortestPath: dijkstra,
};
