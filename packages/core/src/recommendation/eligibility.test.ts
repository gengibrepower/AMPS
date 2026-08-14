import { describe, expect, it } from 'vitest';
import type { ParkingGraph } from '@amps/contracts';
import type { Vehicle } from '../model.js';
import { eligibleSlots } from './eligibility.js';

const graph: ParkingGraph = {
  nodes: [
    { kind: 'entrance', id: 'E', position: { x: 0, y: 0 } },
    { kind: 'waypoint', id: 'W', position: { x: 1, y: 0 } },
    { kind: 'poi', id: 'P', position: { x: 2, y: 0 }, label: 'Loja' },
    { kind: 'slot', id: 's-small', position: { x: 3, y: 0 }, dimensions: { width: 2, length: 4 } },
    { kind: 'slot', id: 's-ok', position: { x: 4, y: 0 }, dimensions: { width: 2.5, length: 5 } },
    { kind: 'slot', id: 's-occupied', position: { x: 5, y: 0 }, dimensions: { width: 3, length: 6 } },
    { kind: 'slot', id: 's-narrow', position: { x: 6, y: 0 }, dimensions: { width: 1.8, length: 5 } },
  ],
  edges: [],
};

const vehicle: Vehicle = { dimensions: { width: 2.2, length: 4.8 } };

describe('eligibleSlots', () => {
  it('retorna só vagas livres que comportam o veículo, ignorando não-vagas', () => {
    const occupancy = new Set(['s-occupied']);
    const result = eligibleSlots(graph, vehicle, occupancy).map((s) => s.id);
    expect(result).toEqual(['s-ok']);
  });

  it('retorna vazio quando nenhuma vaga livre comporta o veículo', () => {
    const big: Vehicle = { dimensions: { width: 5, length: 10 } };
    expect(eligibleSlots(graph, big, new Set())).toEqual([]);
  });
});
