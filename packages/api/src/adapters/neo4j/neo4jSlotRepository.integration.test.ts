import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import neo4j, { type Driver } from 'neo4j-driver';
import { Neo4jSlotRepository } from './neo4jSlotRepository.js';

const uri = process.env['NEO4J_URI'] ?? 'bolt://localhost:7687';
const user = process.env['NEO4J_USER'] ?? 'neo4j';
const password = process.env['NEO4J_PASSWORD'] ?? 'neo4j';
const database = process.env['NEO4J_DATABASE'] ?? 'neo4j';

const TENANT = 'test-tenant';
const OTHER = 'other-tenant';

let driver: Driver;

beforeAll(() => {
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    disableLosslessIntegers: true,
  });
});

afterAll(async () => {
  await driver.close();
});

async function wipe(tenant: string): Promise<void> {
  const session = driver.session({ database });
  try {
    await session.run('MATCH (n {tenantId: $tenant}) DETACH DELETE n', { tenant });
  } finally {
    await session.close();
  }
}

async function run(cypher: string, params: Record<string, unknown>): Promise<void> {
  const session = driver.session({ database });
  try {
    await session.run(cypher, params);
  } finally {
    await session.close();
  }
}

beforeEach(async () => {
  await wipe(TENANT);
  await wipe(OTHER);
  await run(
    `
    CREATE (s:Slot {tenantId: $t, id: 's1', x: 10, y: 20, width: 2.5, length: 5})
    CREATE (e:Entrance {tenantId: $t, id: 'e1', x: 0, y: 0})
    CREATE (e)-[:VIA {weight: 4}]->(s)
    `,
    { t: TENANT },
  );
});

describe('Neo4jSlotRepository (integração)', () => {
  it('carrega o grafo do tenant e mapeia label -> kind', async () => {
    const repo = new Neo4jSlotRepository(driver, database);
    const graph = await repo.loadGraph(TENANT);

    expect(graph.edges).toEqual([{ from: 'e1', to: 's1', weight: 4 }]);
    expect(graph.nodes).toContainEqual({
      kind: 'slot',
      id: 's1',
      position: { x: 10, y: 20 },
      dimensions: { width: 2.5, length: 5 },
    });
  });

  it('não vaza nós de outro tenant', async () => {
    await run(
      `CREATE (:Slot {tenantId: $t, id: 'x9', x: 1, y: 1, width: 2, length: 4})`,
      { t: OTHER },
    );

    const repo = new Neo4jSlotRepository(driver, database);
    const graph = await repo.loadGraph(TENANT);

    expect(graph.nodes.map((node) => node.id)).not.toContain('x9');
  });
});

