# AMPS — Contexto e Visão
 
## Problema
 
Procurar vaga em estacionamento grande (shopping, faculdade, parque) desperdiça
tempo: o motorista circula sem saber onde há vaga livre nem qual fica mais perto
de onde ele realmente quer ir. E quem tem carro grande sofre um problema extra —
achar vaga onde o carro caiba. O AMPS elimina essa busca recomendando a vaga
ideal com base na **ocupação atual** do estacionamento, na **distância até o
ponto de interesse (POI)** do motorista e nas **dimensões do veículo**.
 
## Visão
 
Site/app que, dado um estacionamento e um POI, recomenda e roteia o motorista
até a melhor vaga livre que comporte o carro dele — e que dá ao dono do
estacionamento um editor pra modelar o layout (vagas, ruas com sentido, POIs)
que alimenta esse cálculo.
 
## Atores
 
- **Cliente (motorista)** — busca estacionamento, informa um POI, recebe a
  recomendação e a rota. Cadastra dados pessoais e do veículo (modelo, placa).
- **Dono de estacionamento** — cadastra estabelecimentos (via CNPJ), modela o
  layout no editor e publica pra uso dos clientes.
- **Administrador do sistema** — *ainda não descrito* (ver Questões em aberto).
## Conceitos do domínio (glossário)
 
- **Estacionamento (tenant)** — unidade isolada; pertence a um dono. Toda
  ocupação, layout e busca é escopada por estacionamento.
- **Vaga (slot)** — posição estacionável, com dimensão e tipo/tamanho.
- **Waypoint** — nó de navegação sem vaga (cruzamento, curva).
- **Rua / corredor (aresta)** — trecho dirigível entre dois nós, com **sentido**
  (mão única ou dupla) e comprimento (peso).
- **Entrada** — nó por onde o motorista entra no estacionamento; ponto de
  partida da rota.
- **POI (ponto de interesse)** — destino do motorista dentro/junto ao
  estacionamento (loja, bloco, portão). Cadastrado pelo dono no layout.
- **Layout** — o grafo desenhado no editor: vagas + waypoints + arestas +
  entradas + POIs.
- **Ocupação (occupancy)** — conjunto de vagas indisponíveis num instante:
  ocupadas de fato **mais** reservadas. Hoje alimentada pelo check-in dos clientes.
- **Reserva (hold)** — vaga travada pra um cliente que já fez check-in; conta
  como indisponível pros demais.
- **Check-in** — ação do cliente ao chegar numa entrada, informando presença e
  qual entrada. Por enquanto é também a fonte da ocupação.
- **Rota (path)** — caminho dirigível da entrada até a vaga.
- **Score / vaga ideal** — critério que ordena as vagas livres compatíveis; a de
  maior score é a recomendada.
## Fluxo do cliente
 
1. Entra no site e faz login/cadastro (e-mail, senha, modelo do carro, placa).
2. Pesquisa o estacionamento de destino (shopping, faculdade, parque).
3. É levado à página de mapa, onde informa o POI pra fechar o cálculo.
4. Com estacionamento + POI informados, o sistema calcula uma vaga ideal
   **provisória** e o mapa fica em standby até o cliente chegar a uma entrada. A
   vaga provisória **não** é reservada.
5. Ao chegar, o cliente faz check-in informando a entrada. O sistema reserva a
   vaga e traça a rota a partir dela. Se a vaga provisória tiver sido ocupada
   durante o standby, o sistema recalcula antes de reservar.
## Fluxo do dono
 
1. Entra no site e faz login/cadastro (e-mail, senha, CNPJ).
2. Registra os dados básicos dos seus estacionamentos (nome, local, dono...).
3. Entra num estacionamento e escolhe adicionar o layout.
4. No editor, posiciona vagas, ruas (com sentido), POIs e as dimensões de tudo.
5. Com dados básicos + layout preenchidos, libera o estacionamento pro cliente;
   dados como número de vagas são inferidos do editor.
## Questões em aberto
 
Pontos que ainda mudam a modelagem ou o produto:
 
1. **Definição de "vaga sem carros ao redor"** — vizinhança por adjacência no
   grafo ou por proximidade espacial (raio)? Afeta o modelo. *Lean: proximidade
   espacial.* RESOLVIDO: proximidade espacial. Vizinhança = vagas dentro de raio radiusFactor (2) × comprimento da vaga.
2. **Vaga PCD/acessível** — restringir a recomendação a quem tem direito?
3. **Expiração da reserva** — o hold libera sozinho se o cliente desistir? Em
   quanto tempo?
4. **Administrador de sistema** — existe? Modera/aprova estacionamentos publicados?
5. **Veículos por conta** — um só ou vários?
6. **Histórico** — o cliente enxerga os estacionamentos que já usou?
7. **Certeza de vaga / rotatividade** — medir probabilidade de a vaga continuar livre até a chegada exige dado de rotatividade por zona (histórico/sensores), inexistente hoje. Fatia futura; plugável via RNF-08.