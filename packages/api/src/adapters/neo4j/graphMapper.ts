import type { Edge, GraphNode, ParkingGraph, Vec2 } from '@amps/contracts';

export interface RawNode {
  readonly id: string;
  readonly labels: readonly string[];
  readonly props: Readonly<Record<string, unknown>>;
}

export interface RawEdge {
  readonly from: string;
  readonly to: string;
  readonly weight: number;
}

const KNOWN_LABELS = ['Slot', 'Waypoint', 'Entrance', 'Poi'] as const;
type KnownLabel = (typeof KNOWN_LABELS)[number];

function labelOf(node: RawNode): KnownLabel {
  const match = node.labels.find((candidate): candidate is KnownLabel =>
    (KNOWN_LABELS as readonly string[]).includes(candidate),
  );
  if (!match) {
    throw new Error(`nó ${node.id} sem label conhecido (${node.labels.join(', ') || 'nenhum'})`);
  }
  return match;
}

function num(node: RawNode, key: string): number {
  const value = node.props[key];
  if (typeof value !== 'number') {
    throw new Error(`nó ${node.id}: ${key} deveria ser number, veio ${typeof value}`);
  }
  return value;
}

function str(node: RawNode, key: string): string {
  const value = node.props[key];
  if (typeof value !== 'string') {
    throw new Error(`nó ${node.id}: ${key} deveria ser string, veio ${typeof value}`);
  }
  return value;
}

function position(node: RawNode): Vec2 {
  return { x: num(node, 'x'), y: num(node, 'y') };
}

function toNode(node: RawNode): GraphNode {
  const id = node.id;
  switch (labelOf(node)) {
    case 'Slot':
      return {
        kind: 'slot',
        id,
        position: position(node),
        dimensions: { width: num(node, 'width'), length: num(node, 'length') },
      };
    case 'Waypoint':
      return { kind: 'waypoint', id, position: position(node) };
    case 'Entrance':
      return { kind: 'entrance', id, position: position(node) };
    case 'Poi':
      return { kind: 'poi', id, position: position(node), label: str(node, 'label') };
  }
}

function toEdge(edge: RawEdge): Edge {
  return { from: edge.from, to: edge.to, weight: edge.weight };
}

export function mapGraph(nodes: readonly RawNode[], edges: readonly RawEdge[]): ParkingGraph {
  return {
    nodes: nodes.map(toNode),
    edges: edges.map(toEdge),
  };
}
