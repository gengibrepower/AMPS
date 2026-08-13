# AMPS — Regras de Negócio
 
Invariantes do domínio, isoladas dos requisitos. São o que vira teste do núcleo
e, sempre que possível, vive na camada pura.
 
- **RN-01** — Uma vaga ocupada nunca é recomendada.
- **RN-02** — Só entram no cálculo as vagas do estacionamento consultado (escopo por tenant).
- **RN-03** — O número de vagas é derivado do layout; não é informado manualmente.
- **RN-04** — O score de uma vaga livre combina três fatores, cada um
  normalizado em [0,1] sobre as candidatas antes de ponderar: **distância a pé
  até o POI** (peso 1) e **ocupação da vizinhança** (peso 1) pesam igual; a
  **distância de dirigir da entrada até a vaga** pesa menos (peso 0,1). A de
  maior score (menor custo) é a recomendada. Desempate: menor ocupação da
  vizinhança; persistindo, ordem determinística por id. O fator de dirigir só
  entra no check-in — no standby (sem entrada), o score usa só POI + ocupação.
  A "ocupação da vizinhança" hoje acumula dois papéis (manobra + proxy de
  disputa), a serem separados quando o C entrar (ver RN-18).
- **RN-05** — Só estacionamento publicado aparece na busca do cliente. Publicar
  exige metadados básicos preenchidos e layout válido.
- **RN-06** — A rota exibida é o caminho dirigível mais curto da entrada de
  chegada até a vaga recomendada.
- **RN-07** — Ruas têm sentido; toda rota respeita a mão de direção (arestas
  direcionadas). Mão dupla equivale a dois sentidos.
- **RN-08** — O cálculo só dispara quando estacionamento e POI estão ambos informados.
- **RN-09** — Enquanto o cliente não faz check-in numa entrada, a recomendação
  fica em standby; no check-in, a rota é traçada a partir da entrada informada.
- **RN-10** — Um dono só acessa e edita os próprios estacionamentos.
- **RN-11** — Layout válido pra publicação exige ao menos uma entrada, uma vaga e
  um POI, e toda vaga alcançável a partir de alguma entrada (conectividade).
- **RN-12** — Os POIs oferecidos ao cliente são os cadastrados pelo dono naquele
  estacionamento.
- **RN-13** — Uma vaga que não comporta as dimensões do veículo nunca é
recomendada (filtro rígido).
- **RN-14** — Entre vagas equivalentes, há um viés por vagas com menos vizinhas ocupadas;
o viés é mais forte pra veículos grandes. Implementado escalando o peso do fator de ocupação
de forma contínua com o tamanho do veículo: occWeight = 1 + k · max(0, w/W0 − 1, l/L0 − 1),
com W0=1,85 m, L0=4,5 m, k=2; abaixo do baseline o peso é 1 (sem degrau). O refinamento de 
"canto real" (contagem absoluta de vizinhas, não só fração ocupada) fica pro split manobra/disputa do RN-18.
- **RN-15** — A vaga recomendada no standby é provisória e não reservada. A
  reserva ocorre no check-in do cliente na entrada; se a vaga provisória foi
  ocupada durante o standby, recalcula antes de reservar.
- **RN-16** — Se não há vaga livre compatível, o sistema não recomenda: informa
  "sem vaga" e oferece re-tentar.
- **RN-17** — A ocupação inclui vagas ocupadas de fato **e** reservadas; ambas
  são indisponíveis pra recomendação. Hoje é alimentada pelo check-in dos clientes.
- **RN-18** — O score usa a ocupação da vizinhança como proxy de disputa/rotatividade. Medida real de rotatividade por zona é fonte de dado futura (ver Questão em aberto).