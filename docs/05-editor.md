# AMPS — Editor de pátio

O que a API já oferece ao editor, as armadilhas que não são visíveis pelo
código daqui, e o plano do front. Complementa o `04-plano.md`, que explica por
que a topologia é JSON e como o Merlian entra.

## Estado atual

A API do editor está completa e o editor edita e salva. Falta **publicar**.

| rota | o que faz |
| --- | --- |
| `POST /estacionamentos` · `GET /estacionamentos` | cria e lista os do dono do token |
| `GET /estacionamentos/:id` | um pátio do dono; 404 se não existe, 403 se é de outro |
| `PUT /estacionamentos/:id/topologia` | o corpo **é** o grafo; devolve `{ estacionamento_id, versao }` |
| `PUT /estacionamentos/:id/vagas` | upsert em lote pelo `no_id`; nunca apaga |
| `DELETE /estacionamentos/:id/vagas/:noId` | 422 se a vaga não estiver livre |
| `GET /estacionamentos/:id/mapa` | `{ versao, grafo, vagas }` |
| `POST`/`DELETE /estacionamentos/:id/publicacao` | RN-11: entrada, vaga e POI conferidos aqui; alcançabilidade no Merlian |

No front, `owner/estacionamentos.html` lista e cria pátios, e
`owner/editor.html` abre o pátio, desenha o grafo em metros sobre uma grade e
deixa criar, mover, ligar e apagar nó, com desfazer, mais o inspetor à direita
para rótulo, número, tipo, rotação e peso. O botão Salvar grava na ordem que
os triggers impõem. `src/client-map/` continua vazia.

## A ordem de gravação é obrigatória

Salvar não é mandar tudo. Os triggers de `03_integridade.sql` impõem a
sequência:

1. **`DELETE` das vagas que sumiram** — o trigger recusa tirar do grafo um nó
   que ainda tem vaga.
2. **`PUT /topologia`** — `vagas_valida_no_insert` exige que o `no_id` já seja
   um `candidate` **no grafo gravado**.
3. **`PUT /vagas`** com o resto.

Cada passo só roda se houve mudança. No front isso deve ser uma função pura que
recebe estado do servidor + estado local e devolve a lista de requisições — é a
peça com mais risco do editor e a que mais merece teste.

## O que o cliente tem que impedir

O banco recusa com 422 e mensagem do trigger, mas o editor não deveria chegar
lá: id de nó repetido, aresta apontando para nó inexistente, `candidate` sem
`dimensions`, vaga em nó que não é `candidate`, número de vaga duplicado. Tudo
isso é impossível de construir se a ferramenta for feita direito. O 422 é rede
de segurança, não fluxo normal.

## Decisões de modelo

- **Metros, sempre.** O Merlian tem `baselineWidth: 1.85` e
  `baselineLength: 4.5` hardcoded; grafo em outra unidade quebra o viés por
  tamanho da RN-14. Pixel só existe na hora de desenhar, num módulo só.
- **Id de nó é imutável.** `vagas.no_id` casa com `node.id`; renomear órfã a
  vaga e o trigger recusa. O que se renomeia é o `label` (cosmético, o Merlian
  ecoa) e o `numero` da vaga.
- **Peso de aresta não se recalcula sozinho.** Nasce como a distância
  euclidiana, mas o `strictObject` do Merlian não deixa guardar "esse peso foi
  editado à mão" — não cabe chave extra. Recalcular ao mover um nó destruiria
  em silêncio um ajuste deliberado (rampa, mão única). Recálculo é ação
  explícita.
- **Rotação da vaga vive em `vagas`, não no grafo.** O contrato do Merlian não
  tem orientação. Um `candidate` sem linha em `vagas` desenha sem rotação.

## Duas armadilhas do banco

**`vagas` tem dois UNIQUE**: `(estacionamento_id, no_id)` e
`(estacionamento_id, numero)`. Um `ON DUPLICATE KEY UPDATE` casa também pelo
número e **atualiza a vaga errada** em silêncio. Por isso o
`MysqlVagaRepository` faz `UPDATE` pelo `no_id` e só insere se não afetou
linha.

**O MySQL reordena as chaves do JSON** ao guardar (`edges` antes de `nodes`,
`to` antes de `from`). Semanticamente idêntico e o zod do Merlian não liga, mas
editor que comparar string para detectar "não salvo" dá falso positivo sempre.
Compare estrutura.

## Por que o `GET /mapa` não usa `JSON_TABLE`

A query com `JSON_TABLE` desmonta o grafo em linhas e serve para filtrar ou
agregar em SQL sem puxar o documento (contar livres por tipo, a view do
cliente). Para o editor ela não serve: **achata os nós e perde as arestas**, e o
editor precisa das arestas para desenhar as vias e do grafo intacto para mandar
ao Merlian. Por isso o mapa devolve o grafo verbatim mais as linhas de `vagas`,
casadas pelo `no_id` no front.

```sql
SELECT n.no_id, n.role, n.x, n.y, n.largura, n.comprimento, n.rotulo,
       v.numero, v.tipo, v.rotacao_graus, v.status
FROM topologias t
JOIN JSON_TABLE(t.grafo, '$.nodes[*]' COLUMNS (
       no_id       VARCHAR(50)   PATH '$.id',
       role        VARCHAR(20)   PATH '$.role',
       x           DECIMAL(10,2) PATH '$.position.x',
       y           DECIMAL(10,2) PATH '$.position.y',
       largura     DECIMAL(6,2)  PATH '$.dimensions.width',
       comprimento DECIMAL(6,2)  PATH '$.dimensions.length',
       rotulo      VARCHAR(150)  PATH '$.label'
     )) AS n
LEFT JOIN vagas v
  ON v.estacionamento_id = t.estacionamento_id AND v.no_id = n.no_id
WHERE t.estacionamento_id = ?;
```

## A linguagem do desenho

O editor não desenha um diagrama de nós e setas: desenha a **planta** do pátio.
Quem mexer nisso precisa saber por quê, senão "conserta" e quebra.

- **O canvas é papel.** Fundo branco e traço escuro, com a interface em volta
  (cabeçalho, barra de status) continuando escura. A paleta do desenho vive em
  `render/tinta.ts`, separada do `vars.css`: o verde `#17724C` da interface, que
  serve para botão, vira 2,3:1 de contraste quando é traço de 1 px sobre fundo
  escuro, e some.
- **O corredor tem largura de verdade** — 3,2 m por sentido, 6,4 m na mão dupla.
  Desenhar a via como linha fina foi o erro que fez a vaga de 2,5 × 5 m parecer
  desproporcional: tudo está em escala, então a rua também precisa estar.
- **O sentido é pintado ao longo da via**, com setas repetidas a cada 5 m, como
  no asfalto. Seta só na ponta não deixa ler o sentido no meio de um trecho
  longo, que é onde a dúvida aparece.
- **A vaga se deita perpendicular à rua mais próxima** e encosta nela na
  projeção do seu centro sobre o corredor — não no nó a que a aresta a liga.
  Cada vaga aparece **uma vez só**, na rua em que de fato encosta: é isso que
  faz uma via sobrecarregada mostrar as vagas empilhadas em vez de escondê-las
  penduradas num nó distante. Vaga fora de lugar aparece com um toco tracejado
  até o meio-fio.
- **A rotação da vaga vem do banco, não da geometria.** `vagas.rotacao_graus`
  existe justamente porque o contrato do Merlian não tem orientação, então é
  ela que manda. A dedução pela rua mais próxima só vale enquanto a vaga não
  foi cadastrada — aí serve de sugestão na hora de criar, para ser gravada como
  qualquer outro campo. Sem essa regra, uma vaga em espinha de peixe a 45°
  seria desenhada perpendicular, contrariando o banco.
- **O número e o tipo da vaga saem da tabela `vagas`.** Número pintado no chão,
  em escala, que some abaixo de 60% de zoom; tipo por hachura de fundo, com o
  traço igual para todos. `candidate` sem linha em `vagas` desenha vazio — é
  uma vaga rascunhada, ainda não cadastrada.
- **O que não é rua fica fora do mapa até ser preciso.** A aresta de acesso da
  vaga aparece só quando a vaga ou ela própria está selecionada; o peso da
  aresta, só na aresta selecionada. Planta não tem número em cima de cada via.

## Plano do front

Arquitetura pensada para as pastas que já existem. `graph/` é puro: sem DOM,
sem Konva, sem fetch — é o que dá para testar.

```
owner/editor.html
src/graph/tipos.ts             espelho do wire do Merlian
src/graph/modelo.ts            criar/mover/remover nó e aresta, gerador de id
src/graph/geometria.ts         metros↔pixels, snap, distância
src/graph/render/              palco, nós, arestas
src/editor/estado.ts           grafo + vagas + seleção + sujo + undo
src/editor/gravacao.ts         o planner da ordem de gravação
src/editor/tools/              ferramentas · no · aresta · apagar
```

Mover e ampliar: arrastar o fundo desloca (e continua valendo espaço+arrastar e
botão do meio); o arrasto só começa depois de 4 px, senão clicar para
selecionar fica impossível. Roda de mouse dá zoom ancorado no cursor, dois
dedos no trackpad deslocam, pinça dá zoom. Não há como perguntar ao navegador
qual aparelho é: a pista é que trackpad manda delta em pixel, com eixo x e
valores pequenos, enquanto a roda manda passos grandes e inteiros só no eixo y.

Interação: barra de ferramentas à esquerda, canvas no meio, inspetor à direita,
barra de status com cursor em metros, zoom, `versao` e estado sujo. Atalhos
`V` · `1` vaga · `2` entrada · `3` via · `4` POI · `A` aresta · `Del` · `Esc` ·
`Ctrl+Z`. Undo por snapshot (`structuredClone`), que o modelo é JSON puro.

Fatias: ~~**(1)** Konva e o palco com grade e zoom~~ · ~~**(2)** modelo, render
e carregamento~~ · ~~**(3)** ferramentas e undo~~ · ~~**(4)** inspetor~~ ·
~~**(5)** salvar~~ · **(6)** publicar.

O carregamento (`GET /mapa`) entrou já na fatia 2, em vez de esperar a 5: a
rota existe, e assim o editor desenha dado real desde o começo, sem fixture de
mentira. A fatia 5 ficou só com a gravação.

## O que a fatia 3 decidiu

As três decisões que ela precisava tomar, e como ficaram:

1. **Arrastar nó divide o botão esquerdo com arrastar o fundo.** O limiar de
   4 px virou `Konva.dragDistance`, então vale para os dois — quem decide se
   aquilo foi clique ou arrasto tem que ser um só. O arrasto pousa na grade de
   1 m, com a conta descendo até os metros: encaixar em pixel de tela faria o
   passo mudar com o zoom.
2. **Criar vaga já grava a rotação.** `rotacaoDaVaga` vira o `rotacao_graus`
   no momento da criação. O efeito colateral é que **o editor nunca produz
   vaga rascunhada** — `candidate` sem linha em `vagas` só vem de pátio
   importado.
3. **Desfazer por instantâneo.** `structuredClone` num stack. De quebra, pilha
   vazia quer dizer exatamente "igual ao que o servidor mandou", e é daí que
   sai o estado sujo — sem comparar estrutura, que é onde o MySQL reordenando
   as chaves daria falso positivo.

A ferramenta de aresta entrou junto, porque sem ela o nó nasce solto e não há
corredor nenhum para desenhar. Ela **encadeia**: o destino vira a origem do
clique seguinte, então clicar `t1`, `t2`, `t3` traça a alameda inteira. O
sentido sai do papel dos nós — entre via e entrada nasce o par da mão dupla,
com vaga numa ponta nasce só o acesso, que entra e não sai. O peso nasce da
distância euclidiana e daí em diante só muda na mão.

**Mão única é desenhada centrada no eixo.** Mão dupla são duas faixas
deslocadas 1,6 m para cada lado; tirar um sentido faz a que sobrou recentrar e
ocupar também o lado onde a outra estava. Quem for mexer no desenho da via
precisa saber disso antes de achar que a faixa "pulou".

## O que a fatia 4 decidiu

- **O `sensor` entra em `DadosDaVaga` sem o inspetor mostrá-lo.** O
  `PUT /vagas` é upsert da linha inteira: vaga que voltasse sem sensor apagaria
  em silêncio o pareamento gravado. O editor carrega e devolve; parear sensor
  continua sendo fora dele.
- **Número repetido morre no cliente.** O 422 do trigger é rede de segurança,
  não fluxo normal. O efeito colateral é que **trocar o número entre duas vagas
  exige passar por um número temporário** — some com a pendência do 409 só em
  parte, porque lá o problema é o adapter colidir no meio da transação.
- **Recalcular peso é botão, não automatismo.** Mover um nó continua sem
  refazer o peso, como a decisão de modelo manda.
- **Rotação aceita grau livre**, com quatro botões para o caso comum. Espinha
  de peixe a 45° precisa disso.
- **Os campos gravam no `change`, não a cada tecla**, para uma edição inteira
  ser um passo do desfazer.

### Duas armadilhas de formulário

- **Enter não grava sozinho.** `change` só sai quando o campo perde o foco, e
  fora de um `<form>` o Enter não faz nada. Sem tratar a tecla, o dono digita,
  aperta Enter e o editor ignora. O editor tira o foco no Enter, o que dispara
  o `change` de sempre e mantém a gravação num caminho só.
- **A utilitária `.disabled` tem que ficar por último no `editor.css`.** Ela
  tem a mesma especificidade de qualquer classe de componente, então só vence
  quem vier depois. Declarada no meio do arquivo, perdia para o `display: flex`
  do inspetor e os dois painéis apareciam juntos.

E o que o inspetor não faz: **não sequestra atalho de dentro de campo de
formulário.** Com o cursor num campo, `Ctrl+Z` é o do navegador, desfazendo a
digitação. É de propósito, mas surpreende quem espera desfazer o editor.

## O que a fatia 5 decidiu

- **O planner é puro e mora em `editor/gravacao.ts`.** Recebe o instantâneo do
  servidor e o local, devolve a lista de requisições na ordem dos triggers. O
  `executar` percorre e **para no primeiro erro**: seguir gravaria metade da
  mudança.
- **O lote de vagas leva só as que mudaram**, não o pátio inteiro.
- **Erro deixa o editor sujo de propósito.** O passo que falhou não subiu, e um
  novo salvar retoma do ponto certo porque o planner recompara contra o
  servidor.
- **Salvar zera a pilha de desfazer.** É o que faz `sujo()` voltar a ser falso,
  dado como o estado foi desenhado — mas não se desfaz para antes do último
  salvamento.

### Não há transação cobrindo os três passos

São três requisições, e não dá para ser diferente. Se o `DELETE` passa e o
`PUT /topologia` falha, o banco fica no meio do caminho: a vaga saiu, o grafo
não. O editor continua sujo e o salvar seguinte conserta, mas **entre os dois
o pátio no banco está inconsistente com o que o dono vê**.

## Por onde continuar

A fatia 6 é publicar. A rota já existe e faz o grosso: a RN-11 confere entrada,
vaga e POI na API, e a alcançabilidade no Merlian. O que falta é o front —
botão, estado de publicado, e o que fazer com a lista de vagas inalcançáveis
que o Merlian devolve.

A **RN-05** ("publicar exige metadados básicos") continua sem definição de
quais metadados contam. Isso é decisão de produto, não de código.

### Duas armadilhas do Konva

Custaram uma tarde na fatia 3 e não se veem lendo o código — quem "limpar" as
duas faz o editor travar 5 s por clique outra vez.

- **Não redesenhe a cena dentro do `dragend`.** O redesenho destrói o grupo que
  o Konva acabou de arrastar e deixa a animação de arrasto girando: o renderer
  para de responder e o CDP passa a levar 5 s por evento de input. O aviso sai
  num `setTimeout`, depois que o Konva encerrou o arrasto.
- **`batchDraw` adia o canvas de acerto.** É ele quem decide qual forma recebe
  o clique, e adiá-lo para o quadro seguinte abre uma janela em que o nó já
  está no modelo mas ainda não recebe ponteiro. Por isso `desenhar` e trocar de
  modo fazem `draw()` síncrono. Custa pouco: a cena só é refeita quando o grafo
  muda, não a cada quadro.

E uma do ambiente de teste: **o viewport do Chromium headless não é o que o
`--window-size` promete** — 1280×760 vira 1280×673. Teste e2e que chute pixel
cai fora da tela e falha com `Input.dispatchMouseEvent: Invalid parameters`,
que é NaN chegando no CDP. O jeito certo é sondar o próprio `#cursorX` para
descobrir a conversão metro↔tela, como faz `ferramentas.e2e.test.ts`.

### Pendências conhecidas

- **Não há trava otimista na topologia.** O `PUT /estacionamentos/:id/topologia`
  não recebe `versao`, e o serviço grava por cima. Duas abas editando o mesmo
  pátio se sobrescrevem em silêncio, e o front não resolve isso sozinho: a rota
  teria que recusar quando a versão enviada não é a corrente.
- **O 422 de "vaga ocupada" no `DELETE` não tem cobertura e2e.** Não existe
  rota que ocupe vaga, então o caminho só foi exercitado por unitário, com
  gravador de mentira. O editor reporta a mensagem na barra do cabeçalho.

- **Trocar o número entre duas vagas dá 409.** O upsert atualiza linha a linha
  dentro da transação e colide no meio do caminho, mesmo com o estado final
  válido. O conserto são duas passadas no adapter, a primeira jogando os
  números num valor temporário.
- **Token de 8 h é remendo.** O certo é refresh token; `AUTH_TOKEN_TTL` só
  adiou o problema.
- **Não existe `DELETE /estacionamentos/:id`** — apagar pátio de teste é no
  banco, na mão.
- **RN-05** ("publicar exige metadados básicos") não está implementada: falta
  definir quais metadados contam.
