import type { NodeId, ParkingGraph, TenantId } from './model.js';

export interface Path {
  readonly nodes: readonly NodeId[];
  readonly totalWeight: number;
}

export interface PathfindingService {
  shortestPath(graph: ParkingGraph, from: NodeId, to: NodeId): Path | null;
}

export interface SlotRepository {
  loadGraph(tenantId: TenantId): Promise<ParkingGraph>;
}
