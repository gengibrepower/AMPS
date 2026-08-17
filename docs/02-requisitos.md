# AMPS — Requisitos

IDs rastreáveis: `RF` funcional, `RNF` não-funcional. Referências entre
parênteses apontam pras regras de negócio em `03-regras-de-negocio.md`.

## Requisitos funcionais

### Cliente

- **RF-01** — Cadastro de cliente com e-mail, senha, modelo do veículo e placa.
              (as dimensões usadas no cálculo são derivadas do modelo via RF-23, não digitadas pelo cliente).
- **RF-02** — Autenticação de cliente (login/logout).
- **RF-03** — Busca de estacionamentos por nome/local.
- **RF-04** — A busca lista apenas estacionamentos publicados. (RN-05)
- **RF-05** — Seleção de um estacionamento e de um POI dele para o cálculo. (RN-08, RN-12)
- **RF-06** — Entre as vagas livres que comportam o veículo, calcular e exibir a de maior score. (RN-01, RN-04, RN-13)
- **RF-07** — A recomendação em standby é provisória (não reservada) até o check-in do cliente. (RN-09, RN-15)
- **RF-08** — No check-in: reservar a vaga e exibir a rota da entrada informada até ela, recalculando se a vaga provisória foi ocupada no standby. (RN-06, RN-15)
- **RF-21** — Check-in do cliente na entrada (manual), com seleção da entrada de chegada; alimenta a ocupação. (RN-09, RN-17)
- **RF-22** — Quando não há vaga livre compatível, informar "sem vaga" e permitir re-tentar. (RN-16)
- **RF-23** — Resolução das dimensões do veículo a partir do modelo (e ano) do cadastro, via catálogo interno, com fallback conservador quando o modelo não resolve. (RN-13, RN-14)

> Correção de IDs (esta revisão): o requisito de resolução de dimensões estava
> duplicado como um segundo `RF-22`, enquanto o `RF-01` já o referenciava como
> `RF-23`. Renumerado para `RF-23`, eliminando a colisão e a referência quebrada.
> Se a intenção era outra, reverter.

### Dono

- **RF-09** — Cadastro de dono com e-mail, senha e CNPJ.
- **RF-10** — Autenticação de dono.
- **RF-11** — CRUD de estacionamentos (nome, local, dono, dados básicos).
- **RF-12** — Editor de layout: criar, mover e remover vagas, com dimensão e tipo.
- **RF-13** — Editor: criar ruas/corredores com sentido e comprimento.
- **RF-14** — Editor: marcar entradas.
- **RF-15** — Editor: cadastrar POIs com posição.
- **RF-16** — Publicação do estacionamento, condicionada a metadados + layout válidos. (RN-05, RN-11)
- **RF-17** — Número de vagas derivado do layout, não editável manualmente. (RN-03)
- **RF-18** — *(futuro)* Importar planta (DXF/PDF/imagem) e gerar layout inicial pra revisão no editor.

### Sistema / núcleo

- **RF-19** — Menor caminho dirigível entre dois nós, respeitando o sentido das ruas, **via motor externo (RNF-09)**. (RN-06, RN-07)
- **RF-20** — Recomendação da vaga de maior score, aplicando o filtro de compatibilidade de veículo e o viés de vizinhança, **via motor externo (RNF-09)**. (RN-01, RN-04, RN-13, RN-14)

> RF-19 e RF-20 permanecem requisitos do AMPS (capacidades que o produto
> entrega ao usuário); a **implementação** é delegada ao motor externo. O AMPS
> monta a requisição e consome a resposta.

## Requisitos não-funcionais

- **RNF-01** — Isolamento multi-tenant: dados de um estacionamento/dono nunca vazam pra outro. Vive na fronteira de persistência do AMPS (o motor é stateless e não conhece tenant; recebe só o grafo daquele estacionamento). (RN-10)
- **RNF-02** — Cálculo de recomendação com resposta interativa (meta inicial: sub-segundo em layouts típicos), incluindo o ida-e-volta HTTP ao motor.
- **RNF-03** — O cálculo de recomendação e pathfinding é um **núcleo puro, sem I/O**, hospedado no **motor externo (RNF-09)**: testável sem banco e substituível (ex.: reimplementação em Rust) sem tocar no AMPS. No AMPS, nenhum pacote consumidor reimplementa esse cálculo.
- **RNF-04** — Segurança: senhas com hash forte, autenticação por sessão/token, autorização escopada por tenant.
- **RNF-05** — Proteção de dados pessoais (placa, modelo, e-mail, CNPJ) conforme LGPD.
- **RNF-06** — Persistência do AMPS em **MySQL** (auth, dono, cliente, metadados, histórico) — e a **topologia do layout persistida como documento JSON** sob o contrato `{ nodes, edges }` (RNF-07). Neo4j **removido**: sem travessia de grafo no banco, já que o pathfinding roda em memória no motor externo (RNF-09), que recebe a topologia inteira por requisição. O que resta ao banco é guardar e devolver o layout — CRUD de documento, não consulta de grafo.

  > Mudança de decisão (esta revisão): a persistência deixa de ser poliglota
  > (Neo4j + MySQL) e passa a MySQL só. Ver `04-plano.md` para o impacto na
  > ordem de construção (o antigo passo 3 de adaptadores Neo4j sai).

- **RNF-07** — Contrato único `{ nodes, edges }`, **estável e versionado**, entre o AMPS e seus consumidores. Ele agora atravessa **duas** fronteiras: back-end ↔ front-end (renderização Konva) e AMPS ↔ **motor externo** (cálculo). Na fronteira com o motor é **validado (Zod) na borda** — request malformado falha com erro legível, não explode no cálculo. A API do AMPS permanece casca fina.
- **RNF-08** — Fonte de ocupação plugável: hoje check-in no app; integração com sensores depois, sem mudar o motor (a ocupação já entra como parâmetro por requisição). (RN-17)
- **RNF-09** — **Motor de recomendação e roteamento externo.** Serviço stateless, documentado e versionado (versionamento em path; breaking change ⇒ nova versão), consumido por HTTP. Recebe `{ nodes, edges }` + ocupação + veículo (+ entrada, opcional) e devolve vaga(s) recomendada(s) e/ou rota. O AMPS o consome pelo **próprio back-end (proxy)**, nunca do browser, mantendo token/tenant no servidor. O motor não persiste, não autora, não renderiza e não faz auth.

  > Requisito **novo** nesta revisão. Formaliza a fronteira descrita em
  > `01-contexto.md` e no `04-plano.md`.
