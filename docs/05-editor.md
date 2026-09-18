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
| `POST`/`DELETE /estacionamentos/:id/publicacao` | publica validando a RN-11 no Merlian |

No front existe só `owner/estacionamentos.html` (lista e cadastro). As pastas
do editor estão criadas e vazias desde o PR #8: `src/editor/`,
`src/editor/tools/`, `src/graph/`, `src/graph/render/`, `src/client-map/`.

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

Fatias: **(1)** Konva e o palco com grade e zoom · **(2)** modelo e render ·
**(3)** ferramentas e undo · **(4)** inspetor · **(5)** carregar e salvar ·
**(6)** publicar.
