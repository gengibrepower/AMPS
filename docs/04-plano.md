# AMPS — Plano de Construção
 
Reconstrução do zero (greenfield). O código legado serve só de referência: não
migra, não apaga — consulta. Cada fatia roda de ponta a ponta desde cedo.
 
## Stack
 
| Camada | Tecnologia |
| --- | --- |
| Núcleo / API | TypeScript · Node.js · Express |
| Grafo / pathfinding | Neo4j |
| Relacional | MySQL |
| Front (editor + mapa) | Konva |
| Testes | Vitest |
 
TypeScript é a decisão atual pra API. Se mudar pra JS puro, a estrutura e os
nomes se mantêm.
 
## Arquitetura
 
Núcleo de domínio **puro** no centro (modelo do grafo, Dijkstra, scoring, regras
de tenant), sem nenhuma dependência de I/O. Ao redor, adaptadores para:
- **Persistência** — `SlotRepository` sobre Neo4j (topologia) e MySQL
  (auth, dono, cliente, histórico); `VehicleCatalog` (modelo→dimensões) sobre
  tabela curada no MySQL, com fallback conservador. Isolamento multi-tenant
  vive nessa fronteira.
- **API** — Express como casca fina: controllers só traduzem HTTP e chamam o domínio.
- **Front** — editor e mapa do cliente em Konva, consumindo o mesmo contrato.

Ocupação fica **fora** do grafo: é passada como parâmetro pro núcleo, que
permanece puro e determinístico.
 
## Ordem de construção
 
1. **Esqueleto + contratos** — tipos do modelo, interfaces SlotRepository, PathfindingService e VehicleCatalog.
2. **Núcleo puro, test-driven** — Dijkstra + scoring contra fakes em memória. Zero banco.
3. **Adaptadores de persistência** — Neo4j (topologia) + MySQL (relacional).
4. **API fina** — Express sobre o núcleo.
5. **Front** — Konva (editor + mapa) e ingestão de plantas.

## Roadmap
 
- Ingestão de plantas (DXF / PDF / imagem) → geração automática do grafo do pátio.
- Reimplementação do núcleo de pathfinding em Rust (WASM ou serviço à parte),
  aproveitando a fronteira limpa do domínio.

## Processo
 
- Sem push direto na branch padrão; todo trabalho via pull request pra `main`,
  com branch protection (GitHub rulesets).
- Projeto de time: outros membros contribuem. Relicenciar/privatizar depois
  exigiria consentimento de todos os contribuidores.

## Modelo Neo4j — passo 3 (RNF-06)

Materializa a topologia sob o contrato `{ nodes, edges }` (RNF-07). O adapter de
leitura (`SlotRepository`) traduz o grafo do banco pro contrato; o núcleo não
conhece Neo4j.

### Nós
Um label por tipo, espelhando o discriminante `kind` do contrato: `:Slot`,
`:Waypoint`, `:Entrance`, `:Poi`. Propriedades comuns: `id`, `tenantId`, `x`, `y`.
`:Slot` acrescenta `width` e `length`; `:Poi` acrescenta `label`. O adapter
reconstrói `kind` a partir do label e **não** propaga `tenantId` pro contrato
(é dado de fronteira, não de domínio).

### Arestas
Relacionamento direcionado `:VIA` com propriedade `weight`. Mão única = 1 `:VIA`;
mão dupla = 2 `:VIA`, uma por sentido, cada uma com seu `weight` (RN-07). O núcleo
já lê adjacência só no sentido `from→to`, então mão dupla não exige nada além da
segunda aresta.

### Isolamento multi-tenant (RNF-01, RN-02, RN-10)
Por propriedade `tenantId` em todo nó, filtrada numa fronteira só:
`SlotRepository.loadGraph(tenantId)`, com todo `MATCH` carregando
`WHERE n.tenantId = $tenantId`. Sem isolamento físico agora; banco-por-tenant
(multi-db do Neo4j 5) fica no roadmap se surgir necessidade de isolamento duro.