import type { ParkingGraph } from '@amps/contracts';
import { recommend } from '@amps/core';

export const wiringSmoke = (graph: ParkingGraph): typeof recommend => recommend;
