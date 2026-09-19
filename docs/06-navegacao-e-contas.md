# AMPS — Navegação por tipo de conta

O que a interface passou a fazer com o `tipo_conta` que a sessão sempre trouxe,
e onde ficou a decisão de "o que esta conta pode ver". Quem vai implementar o
cadastro de carro quer o `docs/07-cadastro-de-carro.md`, não este.

## O problema

`POST /auth/login` devolve `{ token, usuario }` e `usuario.tipo_conta` é o ENUM
de três valores do `01_schema.sql` (`common_user`, `dono`, `p_admin`). O editor
já se defendia com ele (`usuarioAtual()?.tipo_conta !== 'dono'`). Mas a
navegação ignorava: os links da sidebar eram todos `href=""` e não havia
caminho clicável nenhum até `owner/estacionamentos.html`. A página do dono se
defendia e não se anunciava.

## A decisão num lugar só

`src/sessao.ts`:

```ts
export function areasDe(tipo: string | null): readonly Area[]
export function destinosDe(tipo: string | null): readonly Destino[]
```

| conta | áreas |
| --- | --- |
| deslogado | `buscar` |
| `common_user` | `buscar`, `meusCarros` |
| `dono` | `buscar`, `meusPatios` |
| `p_admin` | igual a `common_user` (ver Pendências) |
| tipo desconhecido | `buscar` |

É função pura de propósito. O repositório não tem jsdom, então lógica que
precise de teste unitário no front tem que viver fora do DOM — `sessao.test.ts`
cobre a tabela inteira sem abrir navegador.

`script.ts` monta a sidebar e o botão do meio da barra de baixo a partir dessa
lista, em `renderNavegacao()`, chamada por `renderAccountPanel()`. Ou seja: a
navegação se refaz a cada login e logout, sem recarregar a página. Os itens
fixos ("Configurações", "Sobre", "Contato") continuam no HTML, abaixo dos
dinâmicos.

**Esconder item de menu não é segurança.** Quem protege é o `#bloqueio` da
página e o 403 da API. O menu é conveniência — e há um teste em
`sessao.test.ts` que garante que `meusPatios` nunca aparece para quem não é
dono, que é a versão testável dessa promessa.

Os `href` de `DESTINOS` são relativos à raiz do site. Só `index.html` e
`search.html` montam este menu, e ambas estão na raiz. Uma página em
subdiretório que queira o mesmo menu vai precisar de um prefixo.

## O cadastro de dono

`POST /donos` existia desde o começo e ninguém chamava. O painel de conta ganhou
uma quinta vista — `registerOwner`, em `#accountRegisterOwner` — com os dois
campos a mais, razão social e CNPJ, alcançada pelo link "Sou um estacionamento".
`src/cadastro_dono.ts` espelha o `cadastro_cliente.ts`: mesmo `mostrarMensagem`,
mesmo `limparFormularioDepois`, mesmo tratamento de 409.

Depois do cadastro e do login o dono **fica no `index.html`** e chega ao hub
pelo menu. Nada em `login.ts` conhece `tipo_conta`.

## O painel que não cabia na tela

Seis campos empilhados davam 861px de caixa num viewport de 673px, cortada 94px
em cima e 94px embaixo, **sem rolagem possível**. Duas causas somadas:

- `.login` centrava com `align-items: center` e não tinha `overflow`. O que
  transborda para cima de um flex centralizado é inalcançável: não existe
  rolagem negativa.
- `.login-box` usava `width: min(512px, 60vw)` com `padding: 3rem 4rem` fixo.
  Num celular de 390px isso deixava 106px de campo.

O conserto tem três partes, e a do meio é a que não é óbvia: a caixa centra por
**`margin: auto`**, não por `align-items`. Quando falta espaço o `auto` resolve
para zero e a caixa encosta no topo, em vez de subir para fora do viewport. Com
isso o `overflow-y: auto` do pai passa a alcançar o conteúdo inteiro. A largura
virou `min(512px, 100%)` com padding em `clamp()`, e o formulário de dono pareia
em duas colunas acima de 420px — 543px de caixa nos mesmos 673px, sem rolar.

## O que está provado

`src/e2e/navegacao.e2e.test.ts` dirige o Chromium de verdade: menu de
deslogado, cadastro de dono digitado no formulário, login de dono revelando
"Meus pátios" e o clique levando ao hub sem cair no `#bloqueio`, e cliente
vendo "Meus carros". Precisa do `npm run dev` de pé; não precisa do Merlian.

Duas armadilhas que esse teste encontrou, e que quem for mexer aqui reencontra:

- **O item do menu não é `textContent`.** Cada um é um `<a>` com um `<span>` de
  ícone antes do texto, então `a.textContent` devolve
  `searchBuscar estacionamento`. O teste lê `a.lastChild.textContent`.
- **A sidebar fecha ao abrir o painel de conta**, porque `sidebarAccountBtn`
  chama `toggleSidebar()` junto com `toggleAccountContent()`. Em teste, reabra
  o menu antes de cada leitura.

E uma que não é de teste: **ícone novo não aparece sozinho.** O Material
Symbols é carregado pela lista `icon_names=` na URL da fonte, uma por página.
`directions_car` teve que ser acrescentado à do `index.html`.

## Pendências conhecidas

- **`carro.html` ainda não existe.** "Meus carros" aponta para ela e o link
  quebra até alguém criá-la — é o primeiro passo de
  `docs/07-cadastro-de-carro.md`, escrito de propósito assim para que o menu já
  esteja esperando a página.
- **`p_admin` não tem área própria.** Ele vê o mesmo que `common_user` porque a
  API não lhe concede nada: `AcessoDono.dono()` só procura linha em `donos`, e
  um `p_admin` leva o mesmo 403 que um cliente. Dar-lhe "Meus pátios" no menu
  seria prometer o que o 403 nega. Quando o perfil ganhar sentido, o lugar de
  decidir é `POR_TIPO` em `sessao.ts` — e junto com ele, `acessoDono.ts`.
- **"Configurações", "Sobre" e "Contato" continuam `href=""`.**
- **A busca não busca.** `index.html` e `search.html` mostram cartões
  inventados em HTML. A área `buscar` aponta para uma página que ainda não fala
  com a API.
