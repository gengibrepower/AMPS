# AMPS — Plano de Construção
 
Reconstrução do zero (greenfield). O código legado serve só de referência: não
migra, não apaga — consulta. Cada fatia roda de ponta a ponta desde cedo.
 
## Stack
 
| Camada | Tecnologia |
| --- | --- |
| API | TypeScript · Node.js · Express |
| Grafo / pathfinding | [Merlian](https://github.com/gengibrepower/Merlian) (serviço à parte) |
| Relacional | MySQL |
| Front (editor + mapa) | Konva |
| Testes | Vitest |
 
TypeScript é a decisão atual pra API. Se mudar pra JS puro, a estrutura e os
nomes se mantêm.
 
## Arquitetura
 
Núcleo de domínio **puro** (modelo do grafo, Dijkstra, scoring), sem nenhuma
dependência de I/O — extraído para o [Merlian](https://github.com/gengibrepower/Merlian),
repositório à parte e stateless. O AMPS é a aplicação em volta:
- **Persistência** — MySQL para auth, dono, cliente, modelos, metadados e vagas.
  O catálogo modelo→dimensões é a tabela `modelos`. Onde a topologia (nós e
  arestas) passa a ser guardada é questão em aberto — ver abaixo.
- **API** — Express como casca fina: controllers só traduzem HTTP e chamam o domínio.
- **Front** — editor e mapa do cliente em Konva, consumindo o mesmo contrato.

Ocupação fica **fora** do grafo: é passada como parâmetro pro núcleo, que
permanece puro e determinístico.
 
## Ordem de construção
 
1. ~~**Esqueleto + contratos**~~ — feito, depois extraído para o Merlian.
2. ~~**Núcleo puro, test-driven**~~ — feito, hoje vive no Merlian.
3. **Adaptador de persistência** — MySQL (relacional). Feito para auth, donos, modelos e carros; topologia pendente.
4. **API fina** — Express. Cadastro, login, modelos e carros feitos.
5. **Front** — Konva (editor + mapa) e ingestão de plantas.
6. **Integração com o Merlian** — enviar o grafo e consumir recomendação e rota.

## Roadmap
 
- Ingestão de plantas (DXF / PDF / imagem) → geração automática do grafo do pátio.
- Reimplementação do núcleo de pathfinding em Rust, aproveitando a fronteira
  limpa do domínio — agora atrás da API do Merlian, o que torna a troca opaca
  para o AMPS.

## Processo
 
- Sem push direto na branch padrão; todo trabalho via pull request pra `main`,
  com branch protection (GitHub rulesets).
- Projeto de time: outros membros contribuem. Relicenciar/privatizar depois
  exigiria consentimento de todos os contribuidores.

## Topologia: questão em aberto (RNF-06)

A topologia era materializada no Neo4j — um label por tipo de nó (`:Slot`,
`:Waypoint`, `:Entrance`, `:Poi`), relacionamento `:VIA` com `weight` para as
arestas, e `tenantId` em todo nó filtrado numa fronteira só
(`SlotRepository.loadGraph(tenantId)`). Isso saiu do repositório junto com o
adapter.

O Merlian é **stateless**: recebe o grafo `{ nodes, edges }` na requisição e
devolve recomendação ou rota. Ou seja, guardar a topologia continua sendo
responsabilidade do AMPS, e hoje não há onde: o schema MySQL tem
`estacionamentos` e `vagas`, mas nenhuma tabela de arestas, waypoints ou POIs.

Três coisas precisam de decisão antes do passo 6:

- **Onde guardar nós e arestas.** Tabelas relacionais no MySQL, JSON numa coluna,
  ou trazer de volta um banco de grafo.
- **Isolamento multi-tenant (RNF-01, RN-02, RN-10).** Vivia no filtro por
  `tenantId` do repositório Neo4j. O schema atual não tem coluna de tenant em
  tabela nenhuma, então hoje não existe isolamento nessa camada.
- **Como consumir o Merlian.** Ele não está publicado em registry e não expõe
  entry point de biblioteca (sem `main`, `exports` ou `types`; `express` é
  dependência de runtime). Ou o AMPS fala com ele por HTTP, ou o Merlian vira
  lib antes — mudança no outro repositório.
