export type NodeId = string;
export type TenantId = string;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Dimensions {
  readonly width: number;
  readonly length: number;
}

export interface SlotNode {
  readonly kind: 'slot';
  readonly id: NodeId;
  readonly position: Vec2;
  readonly dimensions: Dimensions;
}

export interface WaypointNode {
  readonly kind: 'waypoint';
  readonly id: NodeId;
  readonly position: Vec2;
}

export interface EntranceNode {
  readonly kind: 'entrance';
  readonly id: NodeId;
  readonly position: Vec2;
}

export interface PoiNode {
  readonly kind: 'poi';
  readonly id: NodeId;
  readonly position: Vec2;
  readonly label: string;
}

export type GraphNode = SlotNode | WaypointNode | EntranceNode | PoiNode;

export interface Edge {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly weight: number;
}

export interface ParkingGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
}

export interface Vehicle {
  readonly dimensions: Dimensions;
}

export type Occupancy = ReadonlySet<NodeId>;
