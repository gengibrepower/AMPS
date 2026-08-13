import { describe, expect, it } from 'vitest';
import type { Vehicle } from '../model.js';
import { occupancyWeight } from './sizeBias.js';

const popular: Vehicle = { dimensions: { width: 1.7, length: 3.9 } };
const sedan: Vehicle = { dimensions: { width: 1.8, length: 4.7 } };
const pickup: Vehicle = { dimensions: { width: 1.95, length: 5.25 } };

describe('occupancyWeight (RN-14)', () => {
  it('veículo dentro do baseline não recebe viés extra (peso 1)', () => {
    expect(occupancyWeight(popular)).toBe(1);
  });

  it('viés cresce com o tamanho e é mais forte pra veículo grande', () => {
    expect(occupancyWeight(sedan)).toBeGreaterThan(1);
    expect(occupancyWeight(pickup)).toBeGreaterThan(occupancyWeight(sedan));
  });

  it('rampa contínua sem degrau: excesso relativo escala pela intensidade', () => {
    const params = { baselineWidth: 1.85, baselineLength: 4.5, intensity: 2 };
    expect(occupancyWeight(pickup, params)).toBeCloseTo(1 + 2 * (5.25 / 4.5 - 1), 10);
  });
})
