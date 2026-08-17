import { describe, expect, it } from 'vitest';
import { mapGraph } from './graphMapper.js';
import type { RawNode } from './graphMapper.js';

function node(labels: readonly string[], props: Record<string, unknown>): RawNode {
  return { id: props['id'] as string, labels, props };
}

describe('mapGraph — guardas de integridade', () => {
  it('lança em nó sem label conhecido', () => {
    const nodes = [node(['Vaga'], { id: 'x1', tenantId: 't1', x: 0, y: 0 })];
    expect(() => mapGraph(nodes, [])).toThrow(/x1.*label conhecido/);
  });

  it('lança quando coordenada não é number', () => {
    const nodes = [node(['Waypoint'], { id: 'w1', tenantId: 't1', x: '0', y: 0 })];
    expect(() => mapGraph(nodes, [])).toThrow(/w1.*x.*number/);
  });

  it('lança quando Poi não tem label string', () => {
    const nodes = [node(['Poi'], { id: 'p1', tenantId: 't1', x: 0, y: 0 })];
    expect(() => mapGraph(nodes, [])).toThrow(/p1.*label.*string/);
  });
});
