import type { Dimensions, NodeId } from '@amps/contracts';

export interface Vehicle {
  readonly dimensions: Dimensions;
}

export type Occupancy = ReadonlySet<NodeId>;
