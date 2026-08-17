# AMPS — Plano de Construção

Reconstrução do zero (greenfield). O código legado serve só de referência: não
migra, não apaga — consulta. Cada fatia roda de ponta a ponta desde cedo.

> **Mudança estrutural (esta revisão).** O núcleo de cálculo (Dijkstra + scoring)
> deixa de viver dentro do AMPS e passa a ser um **motor externo, stateless e
> documentado** (RNF-09), num repositório próprio e individual. O AMPS vira
> **consumidor**. Consequência direta no monorepo: o conteúdo puro de
> `@amps/core` (pathfinding + recommendation) **migra para o repo do motor**; no
> AMPS restam contratos, adaptadores de I/O, o cliente HTTP do motor e o front.
> Ver "Consequência no monorepo" abaixo.

## Stack

| Camada | Tecnologia |
| --- | --- |
| API / cola | TypeScript · Node.js · Express (casca fina) |
| Cálculo (recomendação + rota) | **Motor externo (RNF-09)**, consumido por HTTP |
| Persistência | MySQL — relacional + topologia como documento JSON |
| Front (editor + mapa) | Konva |
| Testes | Vitest |

> Neo4j **removido** desta stack (era topologia/pathfinding no banco). Sem
> travessia de grafo no AMPS, a topologia é um JSON guardado no MySQL e enviado
> inteiro ao motor por requisição.

TypeScript é a decisão atual pra API. Se mudar pra JS puro, a estrutura e os
nomes se mantêm.

## Arquitetura

O cálculo é externo. O AMPS orquestra em volta dele:

- **Persistência (MySQL)** — auth, dono, cliente, metadados, histórico; e a
  **topologia do layout como JSON** (`{ nodes, edges }`, RNF-07). O
  `SlotRepository` passa a ler/gravar esse documento (I/O trivial), não a
  traduzir um grafo de banco. O isolamento multi-tenant (RNF-01, RN-02, RN-10)
  vive nessa fronteira: cada consulta escopada por `tenantId` em coluna
  relacional. `VehicleCatalog` (modelo→dimensões) continua sobre tabela curada
  no MySQL, com fallback conservador.
- **Cliente do motor** — adaptador que implementa a port de cálculo como
  **cliente HTTP** do motor externo (RNF-09): monta `{ nodes, edges }` +
  ocupação + veículo (+ entrada), chama o motor, valida a resposta (Zod) e a
  devolve ao domínio. É aqui que o `kind` do AMPS vira `role` do motor. Chamado
  sempre pelo **back-end (proxy)**, nunca pelo browser.
- **API (Express)** — casca fina: controllers traduzem HTTP e orquestram
  persistência + cliente do motor.
- **Front (Konva)** — editor e mapa do cliente, consumindo o mesmo contrato
  `{ nodes, edges }`. Autoria e renderização são do AMPS; só o **cálculo**
  (recomendação, rota, preview) é delegado ao motor.

Ocupação fica **fora** do grafo: é passada como parâmetro na requisição ao
motor, que permanece stateless e determinístico.

## Ordem de construção

O caminho crítico vira **contract-first**: o contrato do motor é publicado e
mockado cedo, pra o time trabalhar o lado consumidor em paralelo à implementação
do motor.

1. **Esqueleto + contratos** — tipos do modelo, ports (SlotRepository, port de
   cálculo, VehicleCatalog). *(feito)*
2. **Núcleo puro, test-driven** — Dijkstra + scoring contra fakes em memória.
   Zero banco. *(feito — este código migra para o repo do motor.)*
3. **Contrato do motor + persistência JSON** *(substitui o antigo passo 3 de
   adaptadores Neo4j)*:
   - No **motor** (repo à parte): publicar OpenAPI + subir mock server.
   - No **AMPS**: `SlotRepository` sobre MySQL persistindo/lendo a topologia
     como JSON; relacional (auth, dono, cliente); `VehicleCatalog`.
4. **API fina + cliente do motor** — Express sobre a persistência; adaptador
   cliente HTTP do motor (proxy no back-end); mapeamento `kind`→`role` e
   validação Zod na borda.
5. **Front** — Konva (editor + mapa) e ingestão de plantas; cálculo via motor.

## Consequência no monorepo

Referência: `docs/migracao-monorepo.md` descreve os pacotes `@amps/contracts`,
`@amps/core`, `@amps/api`, `@amps/web`. Com a externalização:

- **`@amps/core`** — o conteúdo puro (`pathfinding/`, `recommendation/`) migra
  para o repo do motor. O que sobra no AMPS (tipos de entrada como `Occupancy`,
  ports) é pouco; o pacote encolhe drasticamente ou se dissolve. A invariante
  "núcleo mecanicamente incapaz de importar I/O" (RNF-03) passa a valer **no
  repo do motor**.
- **`@amps/contracts`** — permanece. Continua sendo `{ nodes, edges }` pro front
  e pra persistência. A **fonte de verdade** do contrato de wire com o motor é o
  **repo do motor** (OpenAPI/tipos publicados); o AMPS espelha/consome, não
  autora.
- **`@amps/api`** — o adaptador `adapters/neo4j/` **sai**; `adapters/mysql/`
  fica (agora também guarda a topologia JSON); o `adapters/pathfinding/` deixa
  de ser um Dijkstra local e vira o **cliente HTTP do motor**.
- **`@amps/web`** — inalterado (front, passo 5).

> A sincronização do `docs/migracao-monorepo.md` e das instruções do projeto é
> tarefa à parte; este doc só registra a consequência.

## Roadmap

- Ingestão de plantas (DXF / PDF / imagem) → geração automática do grafo do pátio.
- Generalização do motor para outros domínios (ex.: pátio de maquinário pesado),
  já habilitada pelo par `role`/`kind` — trabalho no **repo do motor**, não no AMPS.
- Reimplementação do núcleo do motor em Rust — transparente pro AMPS, já que o
  contrato trafega em HTTP/JSON agnóstico de linguagem. Não construir nada pra
  isso agora; o desenho apenas acomoda.

## Processo

- Sem push direto na branch padrão; todo trabalho via pull request pra `main`,
  com branch protection (GitHub rulesets).
- **AMPS é projeto de time**; o **motor é repositório individual do Felipe**
  (portfólio), com histórico e contribuições só dele — o que evita o gatilho de
  "relicenciar/privatizar exige consentimento de todos os contribuidores". Manter
  os dois repos separados preserva a autoria limpa do motor.
- No AMPS, relicenciar/privatizar depois exigiria consentimento de todos os
  contribuidores.
