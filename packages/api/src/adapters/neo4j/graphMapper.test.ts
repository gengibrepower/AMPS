import { describe, expect, it } from 'vitest';
import type { ParkingGraph } from '@amps/contracts';
import { mapGraph } from './graphMapper.js';
import type { RawNode, RawEdge } from './graphMapper.js';

const rawNodes: readonly RawNode[] = [
  { id: 's1', labels: ['Slot'], props: { id: 's1', tenantId: 't1', x: 10, y: 20, width: 2.5, length: 5 } },
  { id: 'e1', labels: ['Entrance'], props: { id: 'e1', tenantId: 't1', x: 0, y: 0 } },
  { id: 'p1', labels: ['Poi'], props: { id: 'p1', tenantId: 't1', x: 5, y: 5, label: 'Loja' } },
  { id: 'w1', labels: ['Waypoint'], props: { id: 'w1', tenantId: 't1', x: 3, y: 3 } },
];

const rawEdges: readonly RawEdge[] = [{ from: 'e1', to: 'w1', weight: 4 }];

describe('mapGraph', () => {
  it('mapeia label -> kind e monta { nodes, edges } sem vazar tenantId', () => {
    const expected: ParkingGraph = {
      nodes: [
        { kind: 'slot', id: 's1', position: { x: 10, y: 20 }, dimensions: { width: 2.5, length: 5 } },
        { kind: 'entrance', id: 'e1', position: { x: 0, y: 0 } },
        { kind: 'poi', id: 'p1', position: { x: 5, y: 5 }, label: 'Loja' },
        { kind: 'waypoint', id: 'w1', position: { x: 3, y: 3 } },
      ],
      edges: [{ from: 'e1', to: 'w1', weight: 4 }],
    };

    expect(mapGraph(rawNodes, rawEdges)).toEqual(expected);
  });
});

