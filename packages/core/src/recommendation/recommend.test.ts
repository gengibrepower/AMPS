import { describe, expect, it } from 'vitest';
import type { ParkingGraph } from '@amps/contracts';
import type { Vehicle } from '../model.js';
import { recommend } from './recommend.js';

const vehicle: Vehicle = { dimensions: { width: 2, length: 4 } };
const fits = { width: 2.5, length: 5 };

describe('recommend', () => {
  it('retorna null quando nenhuma vaga comporta o veículo (sem vaga, RN-16)', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 's', position: { x: 1, y: 0 }, dimensions: { width: 1, length: 2 } },
      ],
      edges: [],
    };
    expect(recommend({ graph, vehicle, occupancy: new Set<string>(), poiId: 'p' })).toBeNull();
  });

  it('vaga única elegível é retornada', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 's', position: { x: 3, y: 4 }, dimensions: fits },
      ],
      edges: [],
    };
    expect(recommend({ graph, vehicle, occupancy: new Set<string>(), poiId: 'p' })?.id).toBe('s');
  });

  it('provisório: mais perto do POI vence quando ocupação empata', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 'A', position: { x: 3, y: 4 }, dimensions: fits },
        { kind: 'slot', id: 'B', position: { x: 30, y: 40 }, dimensions: fits },
      ],
      edges: [],
    };
    expect(recommend({ graph, vehicle, occupancy: new Set<string>(), poiId: 'p' })?.id).toBe('A');
  });

  it('provisório: vizinhança menos ocupada vence quando POI empata', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 'A', position: { x: 10, y: 0 }, dimensions: fits },
        { kind: 'slot', id: 'B', position: { x: -10, y: 0 }, dimensions: fits },
        { kind: 'slot', id: 'na', position: { x: 12, y: 0 }, dimensions: fits },
      ],
      edges: [],
    };
    expect(recommend({ graph, vehicle, occupancy: new Set(['na']), poiId: 'p' })?.id).toBe('B');
  });

  it('check-in: dirigir (0,1x) desempata e pode mudar a escolha', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'entrance', id: 'E', position: { x: 0, y: -5 } },
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 'A', position: { x: 10, y: 0 }, dimensions: fits },
        { kind: 'slot', id: 'B', position: { x: 0, y: 10 }, dimensions: fits },
      ],
      edges: [
        { from: 'E', to: 'A', weight: 5 },
        { from: 'E', to: 'B', weight: 1 },
      ],
    };
    const base = { graph, vehicle, occupancy: new Set<string>(), poiId: 'p' };
    expect(recommend(base)?.id).toBe('A');
    expect(recommend({ ...base, entranceId: 'E' })?.id).toBe('B');
  });

  it('check-in: descarta vaga sem rota dirigível a partir da entrada', () => {
    const graph: ParkingGraph = {
      nodes: [
        { kind: 'entrance', id: 'E', position: { x: 0, y: -5 } },
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 'A', position: { x: 10, y: 0 }, dimensions: fits },
        { kind: 'slot', id: 'B', position: { x: 1, y: 0 }, dimensions: fits },
      ],
      edges: [{ from: 'E', to: 'A', weight: 1 }],
    };
    expect(recommend({ graph, vehicle, occupancy: new Set<string>(), poiId: 'p', entranceId: 'E' })?.id).toBe('A');
  });

  it('RN-14: veículo grande foge de vizinhança cheia (mesmo grafo, escolha muda)', () => {
    const big = { width: 2.5, length: 5.5 };
    const popular: Vehicle = { dimensions: { width: 1.7, length: 3.9 } };
    const pickup: Vehicle = { dimensions: { width: 1.95, length: 5.25 } };

    const graph: ParkingGraph = {
      nodes: [
        { kind: 'poi', id: 'p', position: { x: 0, y: 0 }, label: 'L' },
        { kind: 'slot', id: 'A', position: { x: 4, y: 0 }, dimensions: big },
        { kind: 'slot', id: 'B', position: { x: 30, y: 0 }, dimensions: big },
        { kind: 'slot', id: 'C', position: { x: 0, y: 40 }, dimensions: big },
        { kind: 'slot', id: 'oa1', position: { x: 4, y: 2 }, dimensions: big },
        { kind: 'slot', id: 'oa2', position: { x: 6, y: 0 }, dimensions: big },
        { kind: 'slot', id: 'sa', position: { x: 4, y: -3 }, dimensions: { width: 1, length: 2 } },
        { kind: 'slot', id: 'oc1', position: { x: 0, y: 42 }, dimensions: big },
        { kind: 'slot', id: 'oc2', position: { x: 2, y: 40 }, dimensions: big },
      ],
      edges: [],
    };
    const occupancy = new Set(['oa1', 'oa2', 'oc1', 'oc2']);

    expect(recommend({ graph, vehicle: popular, occupancy, poiId: 'p' })?.id).toBe('A');
    expect(recommend({ graph, vehicle: pickup, occupancy, poiId: 'p' })?.id).toBe('B');
  });
})
