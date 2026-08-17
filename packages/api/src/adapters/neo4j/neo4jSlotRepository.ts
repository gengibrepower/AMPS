import neo4j, { type Driver } from 'neo4j-driver';
import type { ParkingGraph, TenantId } from '@amps/contracts';
import type { SlotRepository } from '@amps/core';
import { mapGraph } from './graphMapper.js';
import type { RawEdge, RawNode } from './graphMapper.js';

const NODES_QUERY = `
MATCH (n)
WHERE n.tenantId = $tenantId
RETURN n
`;

const EDGES_QUERY = `
MATCH (a)-[r:VIA]->(b)
WHERE a.tenantId = $tenantId AND b.tenantId = $tenantId
RETURN a.id AS from, b.id AS to, r.weight AS weight
`;

export class Neo4jSlotRepository implements SlotRepository {
  constructor(
    private readonly driver: Driver,
    private readonly database: string,
  ) {}

  async loadGraph(tenantId: TenantId): Promise<ParkingGraph> {
    if (tenantId.trim() === '') {
      throw new Error('loadGraph: tenantId vazio');
    }

    const session = this.driver.session({
      database: this.database,
      defaultAccessMode: neo4j.session.READ,
    });
    try {
      const nodeResult = await session.run(NODES_QUERY, { tenantId });
      const edgeResult = await session.run(EDGES_QUERY, { tenantId });

      const nodes: RawNode[] = nodeResult.records.map((record) => {
        const node = record.get('n');
        return { id: node.properties.id, labels: node.labels, props: node.properties };
      });

      const edges: RawEdge[] = edgeResult.records.map((record) => ({
        from: record.get('from'),
        to: record.get('to'),
        weight: record.get('weight'),
      }));

      return mapGraph(nodes, edges);
    } finally {
      await session.close();
    }
  }
}

