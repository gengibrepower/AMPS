import { describe, expect, it } from 'vitest';
import type { ParkingGraph, SlotNode } from '../model.js';
import { walkingDistanceToPoi } from './poiDistance.js';

const slot: SlotNode = { kind: 'slot', id: 's', position: { x: 0, y: 0 }, dimensions: { width: 2.5, length: 5 } };

const graph: ParkingGraph = {
  nodes: [
    slot,
    { kind: 'poi', id: 'p', position: { x: 3, y: 4 }, label: 'Loja' },
  ],
  edges: [],
};

describe('walkingDistanceToPoi', () => {
  it('distância euclidiana do centro da vaga ao POI', () => {
    expect(walkingDistanceToPoi(graph, slot, 'p')).toBe(5);
  });

  it('lança quando o POI não existe no grafo', () => {
    expect(() => walkingDistanceToPoi(graph, slot, 'inexistente')).toThrow();
  });
})
