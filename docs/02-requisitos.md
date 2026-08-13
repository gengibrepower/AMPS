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
- **RF-22** — Resolução das dimensões do veículo a partir do modelo (e ano) do cadastro, via catálogo interno, com fallback conservador quando o modelo não resolve. (RN-13, RN-14)
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
 
- **RF-19** — Menor caminho dirigível entre dois nós, respeitando o sentido das ruas. (RN-06, RN-07)
- **RF-20** — Recomendação da vaga de maior score, aplicando o filtro de compatibilidade de veículo e o viés de vizinhança. (RN-01, RN-04, RN-13, RN-14)
## Requisitos não-funcionais
 
- **RNF-01** — Isolamento multi-tenant: dados de um estacionamento/dono nunca vazam pra outro. (RN-10)
- **RNF-02** — Cálculo de recomendação com resposta interativa (meta inicial: sub-segundo em layouts típicos).
- **RNF-03** — Núcleo de domínio puro, sem I/O: pathfinding e scoring testáveis sem banco e substituíveis (ex.: Rust) sem tocar nos adaptadores.
- **RNF-04** — Segurança: senhas com hash forte, autenticação por sessão/token, autorização escopada por tenant.
- **RNF-05** — Proteção de dados pessoais (placa, modelo, e-mail, CNPJ) conforme LGPD.
- **RNF-06** — Persistência poliglota: Neo4j pra topologia (grafo), MySQL pro relacional (auth, dono, cliente, metadados, histórico).
- **RNF-07** — API como casca fina sobre o núcleo; contrato `{ nodes, edges }` estável entre back-end e front-end.
- **RNF-08** — Fonte de ocupação plugável: hoje check-in no app; integração com sensores depois, sem mudar o núcleo. (RN-17)