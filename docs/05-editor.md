# AMPS — Editor de pátio

O que a API já oferece ao editor, as armadilhas que não são visíveis pelo
código daqui, e o plano do front. Complementa o `04-plano.md`, que explica por
que a topologia é JSON e como o Merlian entra.

## Estado atual

A API do editor está completa. Falta o desenho.

| rota | o que faz |
| --- | --- |
| `POST /estacionamentos` · `GET /estacionamentos` | cria e lista os do dono do token |
| `PUT /estacionamentos/:id/topologia` | o corpo **é** o grafo; devolve `{ estacionamento_id, versao }` |
| `PUT /estacionamentos/:id/vagas` | upsert em lote pelo `no_id`; nunca apaga |
| `DELETE /estacionamentos/:id/vagas/:noId` | 422 se a vaga não estiver livre |
| `GET /estacionamentos/:id/mapa` | `{ versao, grafo, vagas }` |
| `POST`/`DELETE /estacionamentos/:id/publicacao` | RN-11: entrada, vaga e POI conferidos aqui; alcançabilidade no Merlian |

No front, `owner/estacionamentos.html` lista e cria pátios, e
`owner/editor.html` já abre o pátio: carrega o mapa, desenha o grafo em metros
sobre uma grade, enquadra o desenho e deixa selecionar nó e aresta. Falta
**editar** — criar, mover, apagar e salvar. `src/editor/tools/` e
`src/client-map/` continuam vazias.

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
src/editor/tools/              selecionar · no · aresta · apagar
```

Interação: barra de ferramentas à esquerda, canvas no meio, inspetor à direita,
barra de status com cursor em metros, zoom, `versao` e estado sujo. Atalhos
`V` · `1` vaga · `2` entrada · `3` via · `4` POI · `A` aresta · `Del` · `Esc` ·
`Ctrl+Z`. Undo por snapshot (`structuredClone`), que o modelo é JSON puro.

Fatias: ~~**(1)** Konva e o palco com grade e zoom~~ · ~~**(2)** modelo, render
e carregamento~~ · **(3)** ferramentas e undo · **(4)** inspetor · **(5)**
salvar · **(6)** publicar.

O carregamento (`GET /mapa`) entrou já na fatia 2, em vez de esperar a 5: a
rota existe, e assim o editor desenha dado real desde o começo, sem fixture de
mentira. A fatia 5 ficou só com a gravação.
