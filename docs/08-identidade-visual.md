# AMPS — Identidade visual: garagem de 1930

O guia da cara nova do front. Ele vale para quem for mexer em qualquer tela,
CSS ou na pintura da planta. A referência visual é a linha **6A** do estudo de
estilos (https://claude.ai/artifact/XKWugeHwpXaNfaB7qHMYYr): home e mapa no
celular. Onde o mockup e este guia discordarem, **vale o guia**. O mockup foi
feito para escolher a direção e tem dois deslizes de contraste, corrigidos
aqui (seção 2).

## 1. A ideia

**Art Deco em base clara, com o Nouveau entrando uma vez só.** É a garagem dos
anos 30: fachada simétrica, preto e dourado, números de mostrador de carro,
coroa escalonada. O único momento orgânico é o **portal** que anuncia "sua
vaga".

Por que assim:

- **Base creme, não escura.** A planta precisa ser clara para ler no celular
  sob o sol, e o site escuro com mapa claro parecia dois produtos. Agora os dois
  são papel creme com tinta preta.
- **Geometria combina com o produto.** Planta é grade, retângulo e simetria. O
  Deco nasceu disso.
- **O ornamento tem orçamento.** Quanto mais a tela é de trabalho (editor,
  métricas), menos ornamento ela leva (seção 5).

## 2. Cores

Todo token novo entra em `css/vars.css`. Os contrastes foram calculados contra
o fundo onde a cor aparece.

| Token | Valor | Papel | Contraste |
| --- | --- | --- | --- |
| `--cor-creme` | `#F4EEDF` | fundo da página | — |
| `--cor-papel` | `#FBF8EF` | cards, campos, painéis | — |
| `--cor-tinta` | `#1A1A17` | texto, bordas, a marca | 15:1 no creme |
| `--cor-tinta-apagada` | `#5E5A50` | texto secundário | 5,9:1 no creme |
| `--cor-ouro` | `#B08A3E` | linhas, ornamento, aros | **2,8:1 no creme: nunca texto sobre o claro** |
| `--cor-ouro-texto` | `#7A5C1E` | rótulos dourados sobre o claro | 5,4:1 no creme |
| `--cor-ouro-claro` | `#E7C977` | texto e números sobre o preto | 10,8:1 no preto |
| `--cor-ambar` | `#E3A23B` | "quase cheio", lâmpadas do portal | 7,9:1 no preto; só preenchimento no claro, sempre com traço tinta |
| `--cor-ferro` | `#2F4F3A` | entrada da planta, informação | 7,9:1 no creme |
| `--cor-lotado` | `#8C2F2B` | lotado, erro | 7,1:1 com texto creme |
| `--cor-areia` | `#E9DEC4` | raios de sol, trilho do mostrador | — |

**Correções em relação ao mockup:** os rótulos dourados pequenos (`#8A6A24`)
davam 4,4:1 e não passam de 4,5. Use `--cor-ouro-texto`. O `--cor-ouro` puro
só aparece como linha, aro ou ornamento, ou como texto sobre o preto.

**A marca é o preto.** O botão principal é preto com texto ouro-claro. O ouro
nunca é fundo de botão com texto escuro pequeno.

### De-para do `vars.css`

As variáveis atuais têm nomes semânticos, então a troca é de valor, não de
nome. Páginas que já usam `var(--cor-...)` mudam sozinhas.

| Variável atual | Novo valor |
| --- | --- |
| `--cor-fundo` | `#F4EEDF` |
| `--cor-fundo-sutil` | `#EFE7D4` |
| `--cor-superficie` | `#FBF8EF` |
| `--cor-superficie-hover` | `#F6F0E2` |
| `--cor-superficie-ativa` | `#EDE4CF` |
| `--cor-borda-sutil` | `#D9CDB0` |
| `--cor-borda` | `#B08A3E` |
| `--cor-borda-campo` | `#1A1A17` |
| `--cor-texto-apagado` | `#5E5A50` |
| `--cor-texto` | `#1A1A17` |
| `--cor-marca` | `#1A1A17` |
| `--cor-marca-hover` | `#2E2D28` |
| `--cor-marca-fundo` | `#EFE7D4` |
| `--cor-marca-borda` | `#B08A3E` |
| `--cor-sobre-marca` | `#E7C977` |
| `--cor-perigo` / `--cor-perigo-solido` | `#8C2F2B` |
| `--cor-perigo-fundo` | `#F2DEDA` |
| `--cor-aviso` | `#8A5A00` (texto; o âmbar puro não passa no claro) |
| `--cor-info` | `#2F4F3A` |
| `--cor-veu` | `rgba(26, 26, 23, 0.55)` |

Depois da troca, procure cor fixa fora do `vars.css`. Qualquer `#09C382` ou
escuro do tema antigo que sobrar vai destoar:
`grep -rn "#[0-9a-fA-F]\{6\}" packages/web/css packages/web/src`.

## 3. Tipografia

| Papel | Fonte | Uso |
| --- | --- | --- |
| Display | **Limelight** | títulos de página e a marca. Sempre **caixa alta**, com `letter-spacing` de .03 a .2em. No máximo um ou dois por tela, nunca abaixo de 24px. |
| Texto | **Josefin Sans** | todo o resto. Corpo com 400 a partir de 16px. O 300 só a partir de 20px: fino e pequeno some. |
| Rótulo | Josefin Sans 600 | 11 a 13px, caixa alta, `letter-spacing: .3em`. É o "sotaque" Deco: substitui o uppercase pequeno sem critério de hoje. |
| Números grandes | **Poiret One** | vagas livres, mostrador. Só a partir de 48px, porque é fina. Número pequeno é Josefin 600 com `tabular-nums`. |

`--fonte-texto` vira `"Josefin Sans"`, `--fonte-marca` vira `"Limelight"` e
entra `--fonte-numero: "Poiret One"`. O link do Google Fonts, igual em todos os
HTML (hoje cada página carrega a Montserrat):

```html
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600;700&family=Limelight&family=Poiret+One&display=swap" rel="stylesheet">
```

A Baunk sai.

## 4. Forma

- **Raio zero.** Todos os `--raio-*` vão a `0`, inclusive o `--raio-pilula`.
  Deco não tem pílula; onde havia uma, entra o entalhe.
- **Três recortes**, todos em `clip-path`:
  - **degrau**: o topo escalonado em três níveis, para cards de pátio e o
    painel da vaga;
  - **entalhe**: os quatro cantos com um quadrado comido de 12px, para botões e
    campos;
  - **losango**: um quadrado a 45°, para marcadores, avatar e o botão de
    voltar.
- **Bordas** de 1,5px em tinta para controles e de 1,5px em ouro para
  ornamento.
- **Sem sombra, sem blur, sem gradiente suave.** Profundidade vem de moldura
  dupla: borda mais `outline` com `outline-offset` negativo.

O `clip-path` corta a borda. Para moldura com recorte, use dois elementos: o de
fora com o fundo da cor da borda e `padding: 1.5px`, e o de dentro com o mesmo
recorte e o fundo real. É o padrão do mockup (`.sa-notch`, `.sa-step`).

## 5. Ornamento

O vocabulário é fechado. Se não está aqui, não entra.

| Ornamento | Como é | Onde |
| --- | --- | --- |
| Raios de sol | `repeating-conic-gradient` creme e areia, com meio-círculo e aro duplo ouro | atrás do título da home |
| Chevron | faixa preta com triângulos ouro, 12 a 16px de altura | topo da página, rodapé, divisa de faixa preta |
| Linha tripla | três filetes ouro em 9px | abaixo do cabeçalho, ao lado de títulos de seção |
| Losango | quadrado ouro a 45° | marcador de lista, separador, pontos da rota |
| Leque | linhas ouro saindo de um ponto | coroa do portal, topo do painel da vaga |
| Portal | seção 6 | só na home e no resultado da vaga |

**Orçamento por tela:**

| Tela | O que entra |
| --- | --- |
| Home | tudo: raios, chevron, faixa preta com portal e mostradores |
| Busca | linha tripla no título, cards completos |
| Detalhe do pátio | linha tripla, mostrador grande, cards de tipo; sem raios |
| Mapa do cliente | só o painel da vaga (degrau preto, leque); a planta é limpa |
| Meus carros, perfil, login | cabeçalho e linha tripla; formulários sóbrios |
| Área do dono, métricas, editor | cabeçalho e linha tripla, **nada mais**. O editor é ferramenta: mantém a barra própria, só troca as cores. |

## 6. Componentes

**Cabeçalho.** Faixa de chevron por cima. Três colunas: navegação à esquerda,
marca centralizada (um zigurate preto com o leque em ouro claro nascendo da
base, mais "AMPS" com espaçamento largo, entre dois losangos; o emblema não
leva letra, porque um "P" colado ao nome se lia "PAMPS") e conta à
direita, com as iniciais num losango. Embaixo, a linha tripla. No celular: menu
à esquerda, marca no centro e conta à direita, sem a navegação aberta.

**Botão principal.** Fundo tinta, texto ouro-claro, rótulo em caixa alta,
recorte entalhe, 52px no padrão e 64px na busca da home. No hover, o fundo vai
para `--cor-marca-hover`. **Secundário:** borda tinta de 1,5px, fundo papel.
**De texto:** rótulo sublinhado em ouro.

**Campo.** Moldura entalhada (tinta por fora, papel por dentro), Josefin 400 a
19px. O rótulo vai acima, no estilo de rótulo da seção 3.

**Mostrador.** É a peça de assinatura e a forma de mostrar ocupação em todo
lugar onde hoje há barra.

- Semicírculo com trilho `--cor-areia`, arco de preenchimento proporcional à
  **ocupação**, ponteiro e cubo ouro.
- Aro duplo ouro por fora e marcas de escala tracejadas. Os números das pontas
  (0 e o total) aparecem quando o mostrador tem 160px ou mais.
- **A cor do arco é o estado:** tinta até 84% ocupado, âmbar de 85% a 99%, e
  vermelho-lotado com o ponteiro deitado à direita em 100%. A cor nunca anda
  sozinha: o número de livres sempre fica ao lado, e o "quase cheio" e o
  "lotado" aparecem também por escrito.
- Implemente como **uma função que devolve o SVG** a partir de
  `{ livres, total, tamanho }`, testável em unitário como o `resumo.ts`.
  Mockup: `#saGauge` no `SecA-Home`.

**Card de pátio.** Moldura tinta com topo em degrau. Faixa preta com a
miniatura da planta, que continua vindo do `desenharMiniatura`. Nome em
Josefin 700 caixa alta, endereço em 300, e embaixo, separado por filete, o
mostrador com o número em Poiret One. Lotado: a moldura e a faixa vão para
`--cor-lotado`, com a etiqueta "LOTADO" em papel com moldura interna.

**Portal.** Hastes retas em três filetes ouro, coroa em zigurate com um leque,
lâmpadas âmbar em losango e a placa preta "ESTACIONAMENTO". Por dentro, um
painel creme com topo em degrau: "SUA VAGA", o código em Limelight, três
losangos e a distância. Vai num SVG só, em `assets/`, com o código e a distância
como `<text>` trocáveis. **Usos:** a faixa da home e, em versão reduzida, o
resultado da vaga.

**Painel "Sua vaga" (mapa).** Fundo tinta com o topo em zigurate, o leque ouro,
o código em Limelight ouro-claro a 80px, a distância e uma linha de três
colunas (carro, destino, entrada) separadas por filetes ouro. O botão
"Escolher de novo" é ouro com texto tinta. É a exceção à regra do ouro: o texto
é grande, e ouro com tinta dá 5,4:1.

**Placa Mercosul.** Continua no pendente, mas no estilo novo: faixa azul
oficial é conteúdo, não decoração, então fica azul.

## 7. A planta (`src/graph/render/tinta.ts`)

O Konva não lê CSS, então a paleta da planta muda nas constantes do
`tinta.ts`. A miniatura usa as mesmas. Continua valendo a regra do arquivo:
preenchimento opaco e traço acima de 3:1 contra o vizinho.

| Constante | Hoje | Novo |
| --- | --- | --- |
| `PAPEL` | `#FBFDFC` | `#FBF8EF` |
| `GRADE_FINA` / `GRADE_GROSSA` | sage | `rgba(26, 26, 23, 0.06)` / `0.14` |
| `EIXO` | verde | `rgba(176, 138, 62, 0.5)` |
| `ASFALTO` | `#DFE2E0` | `#E9E1CF` |
| `VAGA_TRACO`, `PESO`, `NUMERO_DA_VAGA` | `#1A211E` | `#1A1A17` |
| `VAGA_FUNDO` | `#FFFFFF` | `#FBF8EF` |
| `OCUPADA_FUNDO` | rosa | `#1A1A17`: **ocupada é preta sólida** |
| `RECOMENDADA_FUNDO` / `_TRACO` | verde / escuro | `#B08A3E` / `#1A1A17` |
| `ROTA` / `ROTA_CONTORNO` | verde / branco | `#B08A3E` / `#1A1A17` |
| `ENTRADA` / `ENTRADA_FUNDO` | verde | `#2F4F3A` / `#DCE6DD` |
| `POI` / `POI_FUNDO` | âmbar | `#7A5C1E` / `#F3E2B3` |
| `SELECIONADO`, `MEIO_FIO_SELECIONADO` | azul | `#2F4F3A` |
| `ASFALTO_SELECIONADO` | azul claro | `#DCE6DD` |
| `RECUSADO` / `_FUNDO` | vermelho | `#8C2F2B` / `#F2DEDA` |
| `FUNDO_POR_TIPO` | pastéis Radix | pcd `#CFDCE8`, idoso `#EFDFAE`, moto `#D6DEC8`, elétrico `#CFE3DC` |

Duas coisas novas no código:

- **Número sobre vaga ocupada.** Com o fundo preto, o `NUMERO_DA_VAGA` some.
  Precisa de um `NUMERO_DA_VAGA_OCUPADA = '#F4EEDF'`, escolhido em `nos.ts`
  pelo status.
- **A rota ganha contorno escuro**, não claro: o traço ouro sozinho dá 2,8:1 no
  papel. Desenhe primeiro o contorno tinta, mais largo, e o ouro por cima. Os
  pontos da rota, se entrarem, são losangos papel com traço tinta.

## 8. Ícones

Hoje são **Material Symbols Outlined** a 400. Troque para **Material Symbols
Sharp** (canto vivo, como o raio zero) a **300**, que conversa com a Josefin. É
só a URL do Google Fonts e a classe `material-symbols-sharp`. Os nomes de
ícone são os mesmos.

## 9. Acessibilidade que não se negocia

- **Ouro puro não é texto sobre claro** (seção 2). O teste rápido: se for
  ler, é tinta, ouro-texto ou ouro-claro sobre o preto.
- **Foco:** `outline: 2px solid var(--cor-tinta); outline-offset: 3px`. Sobre o
  preto, use ouro-claro. O `clip-path` corta o `outline`, então em elemento
  recortado o foco vai num pai sem recorte, ou vira uma moldura interna.
- **Alvo de toque com 44px ou mais**, inclusive o losango de voltar: o losango
  desenhado pode ser menor, a área clicável não.
- **Estado nunca só por cor:** mostrador com número ao lado, lotado escrito,
  ocupada preta e com número claro.

## 10. Ordem de aplicação

Cada passo é um commit atômico, verificado com `npm run test:e2e` e uma
captura do Chromium (veja "Ver o front sem extensão" no `CLAUDE.md`). Faça num
branch próprio.

1. `vars.css`: tokens novos e o de-para da seção 2, mais o link de fontes em
   todos os HTML. O site fica claro e feio, mas inteiro.
2. Base (`base.css`): cabeçalho, chevron, linha tripla, botões, campos, foco e
   raio zero.
3. `tinta.ts` e `nos.ts`: paleta da planta, número sobre ocupada e contorno da
   rota. Os testes de `nos.test.ts` e da miniatura dizem se algo quebrou.
4. Mostrador como função, com teste unitário dos limites 84, 85 e 100%.
5. Home e busca: raios, faixa do portal e cards.
6. Detalhe do pátio.
7. Mapa do cliente: painel "Sua vaga".
8. Telas de conta e do dono: só cabeçalho, cores e formulários. O editor por
   último, conferindo que nada da barra de ferramentas perdeu contraste.
