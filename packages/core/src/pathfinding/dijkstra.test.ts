import { describe, expect, it } from 'vitest';
import type { ParkingGraph } from '@amps/contracts';
import { dijkstra } from './dijkstra.js';

const line: ParkingGraph = {
  nodes: [
    { kind: 'entrance', id: 'A', position: { x: 0, y: 0 } },
    { kind: 'waypoint', id: 'B', position: { x: 1, y: 0 } },
    { kind: 'slot', id: 'C', position: { x: 2, y: 0 }, dimensions: { width: 2, length: 5 } },
  ],
  edges: [
    { from: 'A', to: 'B', weight: 1 },
    { from: 'B', to: 'C', weight: 1 },
  ],
};

describe('dijkstra', () => {
  it('encontra o menor caminho direcionado', () => {
    expect(dijkstra(line, 'A', 'C')).toEqual({ nodes: ['A', 'B', 'C'], totalWeight: 2 });
  });

  it('respeita o sentido das arestas e retorna null quando inalcançável', () => {
    expect(dijkstra(line, 'C', 'A')).toBeNull();
  });

  it('prefere a rota direcionada mais barata', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'entrance', id: 'A', position: { x: 0, y: 0 } },
        { kind: 'waypoint', id: 'B', position: { x: 1, y: 0 } },
        { kind: 'slot', id: 'C', position: { x: 2, y: 0 }, dimensions: { width: 2, length: 5 } },
      ],
      edges: [
        { from: 'A', to: 'C', weight: 10 },
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 1 },
      ],
    };
    expect(dijkstra(graph, 'A', 'C')).toEqual({ nodes: ['A', 'B', 'C'], totalWeight: 2 });
  });
});
