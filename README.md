# AMPS — Advanced Parking Management System

Sistema de gerenciamento de estacionamento baseado em grafo: mapeia o pátio como um grafo de vagas e vias, localiza o cliente e recomenda a melhor vaga livre com roteamento por caminho mínimo.

## O que faz

Três capacidades que formam o fluxo de ponta a ponta:

- **Editor de pátio** — ferramenta visual (Konva) pra desenhar o estacionamento como grafo: vagas, vias e as conexões entre elas. Suporta ingestão de plantas (DXF / PDF / imagem) pra gerar o mapa base e revisar no editor.
- **Pesquisa de local do cliente** — o cliente informa onde está (ou seu destino dentro do pátio) e o sistema resolve o ponto de entrada correspondente no grafo.
- **Recomendação de vaga** — a partir da posição do cliente, um pathfinding (Dijkstra) sobre o grafo, combinado com um *scoring* (distância + ocupação), recomenda a melhor vaga livre e a rota até ela.

## Arquitetura

O sistema é organizado em torno de **adaptadores plugáveis** sobre um motor de grafo que vive fora deste repositório. O AMPS é a aplicação — auth, cadastro, persistência e UI; o motor — modelo `{nodes, edges}`, Dijkstra e scoring — é o [Merlian](https://github.com/gengibrepower/Merlian), consumido como serviço.

- **Motor de grafo** — pathfinding, scoring e recomendação vivem no [Merlian](https://github.com/gengibrepower/Merlian), repositório à parte, stateless e consumido por HTTP.
- **Persistência** — **MySQL** guarda usuários, donos, modelos, carros, metadados do estacionamento e vagas.
- **API** — Express como casca fina: os controllers só traduzem HTTP e chamam o domínio. Essa API é o contrato que o front consome.
- **Front** — editor e mapa do cliente em Konva, consumindo o mesmo contrato `{nodes, edges}`.

O isolamento **multi-tenant** (cada estacionamento é isolado) vive na fronteira da camada de repositório, num lugar só, em vez de espalhado por queries pelo código.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js · Express |
| Grafo / pathfinding | [Merlian](https://github.com/gengibrepower/Merlian) (serviço à parte) |
| Relacional | MySQL |
| Front (editor + mapa) | Konva |

## Status

Em **reconstrução do zero** (greenfield). O código legado serve apenas como referência; esta base está sendo montada em fatias verticais a partir do núcleo de domínio, cada fatia rodando de ponta a ponta.

Ordem de construção:

1. Esqueleto + contratos do domínio (tipos do modelo, interfaces de repositório e de pathfinding)
2. Motor de grafo extraído para o Merlian (Dijkstra + scoring), repositório à parte
3. Adaptador de persistência (MySQL)
4. API fina (Express) — cadastro, login e carros
5. Front (Konva) + ingestão de plantas

## Roadmap

- Ingestão de plantas (DXF / PDF / imagem) → geração automática do grafo do pátio
- Reimplementação do núcleo de pathfinding em Rust (via WASM ou serviço à parte), aproveitando a fronteira limpa do domínio
