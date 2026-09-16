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

## Topologia: grafo em JSON (RNF-06)

A topologia de cada estacionamento vive em `topologias.grafo`, uma coluna JSON,
**exatamente na forma que o Merlian aceita** em `POST /v1/recommendations`.
Enviar para ele é `SELECT grafo`, sem transformar nada.

O contrato de wire do Merlian não usa os mesmos nomes do núcleo dele. O que a
API aceita é `role`, não `kind`:

| núcleo do Merlian / docs antigos | wire (o que vai no banco) |
| --- | --- |
| `slot` | `candidate` — é quem leva `dimensions` |
| `poi` | `attractor` |
| `entrance` | `source` |
| `waypoint` | `transit` |

Tudo é `z.strictObject`: **qualquer chave a mais reprova a requisição inteira**.
Por isso nada específico do AMPS entra no nó. Número, tipo, sensor, rotação e
ocupação ficam em `vagas`, casados pelo `node.id`.

### Unidades

O grafo vai em **metros**. Não é escolha estética: o `sizeBias.ts` do Merlian tem
`baselineWidth: 1.85` e `baselineLength: 4.5` hardcoded, então grafo em milímetros
quebra o viés por tamanho da RN-14. `modelos` continua em milímetros inteiros —
é dado de catálogo e a comparação da RN-13 é exata. A conversão acontece no
adapter, ao montar `vehicle.dimensions`.

### O que o banco garante, e o que não garante

A CHECK `grafo_no_formato_do_merlian` usa `JSON_SCHEMA_VALID` replicando o
`strictObject`, `additionalProperties` incluso: um grafo que o Merlian recusaria
na requisição **não entra no banco**. Verificado nos dois lados — o mesmo grafo
com chave extra, com `role: 'slot'` ou com peso negativo é recusado pela CHECK e
pelo zod do Merlian.

O que o JSON custa, comparado a tabelas relacionais de nós e arestas: o banco
**não** garante que `from`/`to` apontem para nós existentes, que os ids sejam
únicos dentro do grafo, nem que `vagas.no_id` case com algum nó. Isso passa a ser
responsabilidade de quem grava. A validação da RN-11 (conectividade para publicar)
também é da aplicação — o `POST /v1/reachability` do Merlian serve para isso.

### Reconstrução do mapa

`JSON_TABLE` desmonta o grafo em linhas, então o mapa do cliente sai de uma query
comum, com `LEFT JOIN vagas` trazendo número, tipo, rotação e status por vaga.
`rotacao_graus` existe porque o contrato do Merlian não tem orientação e sem ela
não dá para desenhar a vaga inclinada.

### Ainda em aberto

- **Isolamento multi-tenant (RNF-01, RN-02, RN-10).** `estacionamentos.dono_id`
  agora é FK para `donos`, o que sustenta a RN-10. Como o grafo é um documento por
  estacionamento, não há como uma aresta cruzar pátios — mas isso vale porque o
  documento é por linha, não porque o banco verifique.
- **Como consumir o Merlian.** Ele não está publicado em registry e não expõe
  entry point de biblioteca (sem `main`, `exports` ou `types`; `express` é
  dependência de runtime). Ou o AMPS fala com ele por HTTP, ou o Merlian vira
  lib antes — mudança no outro repositório.
