import { describe, expect, it } from 'vitest';
import type { ParkingGraph, SlotNode } from '../model.js';
import { neighborhoodOccupancy } from './neighborhood.js';

function slot(id: string, x: number, y: number, length = 5): SlotNode {
  return { kind: 'slot', id, position: { x, y }, dimensions: { width: 2.5, length } };
}

const target = slot('t', 0, 0, 5);

const graph: ParkingGraph = {
  nodes: [
    target,
    slot('near-a', 6, 0),
    slot('near-b', 0, 8),
    slot('far', 100, 100),
    { kind: 'waypoint', id: 'w', position: { x: 1, y: 1 } },
  ],
  edges: [],
};

describe('neighborhoodOccupancy', () => {
  it('fração de vizinhos ocupados dentro do raio 2x comprimento da vaga', () => {
    const occupancy = new Set(['near-a']);
    expect(neighborhoodOccupancy(graph, target, occupancy, 2)).toBe(0.5);
  });

  it('não conta vaga fora do raio nem waypoint', () => {
    const occupancy = new Set(['far']);
    expect(neighborhoodOccupancy(graph, target, occupancy, 2)).toBe(0);
  });

  it('vaga sem vizinhos no raio retorna 0', () => {
    const lonely: ParkingGraph = { nodes: [target, slot('far', 100, 100)], edges: [] };
    expect(neighborhoodOccupancy(lonely, target, new Set(), 2)).toBe(0);
  });
})

