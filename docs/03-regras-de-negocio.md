# AMPS — Regras de Negócio

Invariantes do domínio, isoladas dos requisitos.

> **Split de responsabilidade (esta revisão).** Com o motor externo (RNF-09), as
> RNs se dividem em duas classes:
> - **Algoritmo** — como o score é composto, como a rota é achada, filtros de
>   elegibilidade. Vivem **no motor**; o texto autoritativo (parâmetros,
>   fórmulas) fica no doc da engine. Aqui ficam marcadas `[motor — RNF-09]` com
>   o invariante em uma linha, pra rastreabilidade, **sem duplicar** o
>   paramétrico (duplicar divergiria).
> - **Domínio** — o que as coisas significam e quando o AMPS age. Ficam aqui,
>   íntegras. O AMPS as garante montando/validando a entrada do motor e agindo
>   sobre a saída.

- **RN-01** — `[motor — RNF-09]` Uma vaga ocupada nunca é recomendada. Garantido pelo motor, que recebe a ocupação como entrada e exclui as indisponíveis. O AMPS garante que a ocupação enviada está correta (RN-17).
- **RN-02** — Só entram no cálculo as vagas do estacionamento consultado (escopo por tenant). O AMPS garante isso enviando ao motor **apenas** o grafo daquele estacionamento.
- **RN-03** — O número de vagas é derivado do layout; não é informado manualmente.
- **RN-04** — `[motor — RNF-09]` O score de uma vaga livre combina três fatores normalizados em [0,1] sobre as candidatas: distância a pé até o POI (peso 1) e ocupação da vizinhança (peso 1) pesam igual; a distância de dirigir da entrada até a vaga pesa menos (peso 0,1). Maior score = recomendada. Desempate: menor ocupação da vizinhança; persistindo, ordem determinística por id. O fator de dirigir só entra no check-in (com entrada); no standby, só POI + ocupação. Fórmula e pesos completos no doc do motor.
- **RN-05** — Só estacionamento publicado aparece na busca do cliente. Publicar
  exige metadados básicos preenchidos e layout válido.
- **RN-06** — `[motor — RNF-09]` A rota exibida é o caminho dirigível mais curto da entrada de chegada até a vaga recomendada (Dijkstra sobre arestas dirigidas ponderadas). Executado no motor.
- **RN-07** — Ruas têm sentido; toda rota respeita a mão de direção (arestas
  direcionadas). Mão dupla equivale a dois sentidos (duas arestas). Regra de
  **modelagem do layout** (editor, RF-13) e da montagem do grafo pelo AMPS; o
  motor consome as arestas dirigidas e as honra no roteamento (RN-06).
- **RN-08** — O cálculo só dispara quando estacionamento e POI estão ambos informados.
- **RN-09** — Enquanto o cliente não faz check-in numa entrada, a recomendação
  fica em standby; no check-in, a rota é traçada a partir da entrada informada.
- **RN-10** — Um dono só acessa e edita os próprios estacionamentos.
- **RN-11** — Layout válido pra publicação exige ao menos uma entrada, uma vaga e
  um POI, e toda vaga alcançável a partir de alguma entrada (conectividade).
  Verificação de **publicação** feita pelo AMPS. (No check-in, o motor também
  descarta vagas inalcançáveis a partir da entrada informada — RN-06.)
- **RN-12** — Os POIs oferecidos ao cliente são os cadastrados pelo dono naquele
  estacionamento.
- **RN-13** — `[motor — RNF-09]` Uma vaga que não comporta as dimensões do veículo nunca é recomendada (filtro rígido). Aplicado no motor sobre as dimensões recebidas na requisição; o AMPS resolve modelo→dimensões antes de enviar (RF-23).
- **RN-14** — `[motor — RNF-09]` Entre vagas equivalentes, viés por vagas com menos vizinhas ocupadas, mais forte pra veículos grandes (peso de ocupação escala contínua com o tamanho do veículo). Fórmula e constantes (W0, L0, k) no doc do motor. O refinamento de "canto real" fica pro split manobra/disputa do RN-18.
- **RN-15** — A vaga recomendada no standby é provisória e não reservada. A
  reserva ocorre no check-in do cliente na entrada; se a vaga provisória foi
  ocupada durante o standby, recalcula antes de reservar.
- **RN-16** — Se não há vaga livre compatível, o sistema não recomenda: informa
  "sem vaga" e oferece re-tentar. (O motor devolve conjunto vazio de candidatas;
  o AMPS traduz isso em "sem vaga".)
- **RN-17** — A ocupação inclui vagas ocupadas de fato **e** reservadas; ambas
  são indisponíveis pra recomendação. Hoje é alimentada pelo check-in dos
  clientes. Definição de **domínio**: o AMPS monta esse conjunto e o envia ao
  motor como parâmetro.
- **RN-18** — `[motor — RNF-09]` O score usa a ocupação da vizinhança como proxy de disputa/rotatividade. Medida real de rotatividade por zona é fonte de dado futura (ver Questão em aberto #7), plugável via RNF-08 sem mudar o motor.
