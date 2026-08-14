# Tarefa: migrar AMPS de pacote único para monorepo com workspaces

Você vai reestruturar o repositório `gengibrepower/AMPS` de um pacote único
(`src/domain/**`) para um monorepo npm workspaces com os pacotes `contracts`,
`core`, `api` e `web`. Os três primeiros recebem código de verdade; o `web` entra
como **scaffold inerte** — só a árvore de diretórios do front (conforme o doc de
estrutura), com as pastas vazias marcadas por `.gitkeep`, para o time não ficar em
dúvida de onde cada coisa vai. **Nenhum** código de front é escrito agora, e o
`web` não participa de typecheck nem de testes (ver passo 7 e "Fora de escopo").

O núcleo da tarefa é **mecânico**: mover arquivos e reapontar imports. **Nenhuma**
lógica de domínio muda — os 16 testes existentes devem continuar passando idênticos
ao final. Se algum teste mudar de resultado, você quebrou algo.

Trabalhe numa branch nova a partir de `main` atualizada (ex.: `chore/monorepo-workspaces`),
com working tree limpa, e entregue como **um PR próprio**. Use `git mv` em tudo
que for mover, para preservar histórico.

## Invariantes (não pode quebrar nenhuma)

- ESM: `"type": "module"` em todos os pacotes; imports relativos terminam em `.js`.
- TypeScript strict com as flags atuais: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. `moduleResolution` continua
  `"Bundler"` (é o que resolve `@amps/*` via workspace sem plugin).
- `verbatimModuleSyntax` exige `import type` para tipos — todo o código já usa;
  mantenha ao reescrever.
- Vitest continua o runner; `pretest` continua rodando typecheck antes dos testes.
- Licença `GPL-3.0`. `docs/`, `docker-compose.yml`, `.env.example`, `.gitignore`
  ficam na raiz, intocados.
- `packages/core` e `packages/contracts` **não podem** listar dependência de I/O
  (neo4j-driver, mysql2, express) no `package.json`. Essa é a invariante RNF-03:
  o núcleo puro fica mecanicamente incapaz de importar infraestrutura.

## Estado-alvo

```
AMPS/
├── package.json            # workspace root: private, "workspaces": ["packages/*"]
├── tsconfig.base.json      # compilerOptions compartilhadas (sem include/types)
├── vitest.config.ts        # include: packages/*/src/**/*.test.ts
├── docker-compose.yml      # intocado
├── .env.example  ·  .gitignore
├── .github/workflows/ci.yml
├── docs/                   # intocado
├── LICENSE  ·  README.md
└── packages/
    ├── contracts/          # @amps/contracts — tipos de wire ({ nodes, edges }). Zero deps.
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── model.ts     # tipos do grafo (movido de src/domain/model.ts, menos Vehicle/Occupancy)
    │       └── index.ts     # barrel: export * from './model.js'
    ├── core/               # @amps/core — núcleo puro (RNF-03). Depende só de @amps/contracts.
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── model.ts     # SÓ Vehicle e Occupancy (ver "Divisão de símbolos")
    │       ├── ports.ts     # SlotRepository, PathfindingService, VehicleCatalog, Path
    │       ├── pathfinding/ # dijkstra (+ testes)
    │       ├── recommendation/  # eligibility, neighborhood, poiDistance, sizeBias, recommend (+ testes)
    │       └── index.ts     # barrel da superfície pública
    ├── api/                # @amps/api — placeholder do passo 3 (adaptadores + Express virão depois)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── main.ts      # smoke do wiring: importa de @amps/core e @amps/contracts
    │       ├── adapters/    # (vazias, .gitkeep) implementações das ports — passo 3
    │       │   ├── neo4j/       # SlotRepository (topologia) — fronteira multi-tenant aqui
    │       │   ├── mysql/       # VehicleCatalog + auth/dono/cliente/histórico
    │       │   └── pathfinding/ # PathfindingService concreto (TS hoje; Rust depois)
    │       ├── http/        # controllers Express (traduzem HTTP → domínio) — passo 4
    │       └── config/      # env, conexões
    └── web/                # @amps/web — SCAFFOLD INERTE (só pastas + .gitkeep). Front = passo 5.
        ├── package.json     # mínimo, sem script de typecheck (não entra no pretest)
        ├── owner/          # (.gitkeep) dashboard.html + editor.html nascem no passo 5
        └── src/
            ├── pages/       # 1 entry .ts por página (MPA)
            ├── api/         # casca fina do front, espelha o Express
            ├── auth/        # sessão + guard
            ├── graph/       # núcleo Konva compartilhado (editor + mapa)
            │   └── render/  # funções-fábrica: dado de nó → nó Konva
            ├── editor/      # lógica do editor fora do Konva
            │   └── tools/   # add/move/remove vaga, rua, POI, entrada
            ├── client-map/  # fluxo do cliente fora do Konva
            ├── dom/         # helpers de DOM
            ├── styles/      # CSS global + por página
            └── lib/         # utilidades puras (inclui a primitiva de signal)
```

Todas as pastas de `web/` (e as vazias de `api/src/`) recebem um arquivo `.gitkeep`,
porque o git não versiona diretório vazio — sem isso, as pastas somem no commit.

`contracts` é separado de `core` de propósito: quando o núcleo virar Rust
(roadmap), o front e a API seguem importando o **contrato**, não a implementação.

## Divisão de símbolos: o que vai para `contracts` e o que fica em `core`

O arquivo `src/domain/model.ts` é **partido**. A maioria dos tipos é wire e vai
para `contracts`. Dois tipos — `Vehicle` e `Occupancy` — são entrada de cálculo
e ficam em `core`.

| Símbolo | Onde está hoje | Destino | Import passa a ser |
| --- | --- | --- | --- |
| `NodeId` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `TenantId` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `Vec2` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `Dimensions` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `SlotNode` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `WaypointNode` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `EntranceNode` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `PoiNode` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `GraphNode` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `Edge` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `ParkingGraph` | model.ts | `contracts/src/model.ts` | `@amps/contracts` |
| `Vehicle` | model.ts | **`core/src/model.ts`** | relativo (`../model.js`) |
| `Occupancy` | model.ts | **`core/src/model.ts`** | relativo (`../model.js`) |
| `Path` | ports.ts | fica em `core/src/ports.ts` | relativo |
| `PathfindingService` | ports.ts | fica em `core/src/ports.ts` | relativo |
| `SlotRepository` | ports.ts | fica em `core/src/ports.ts` | relativo |
| `VehicleCatalog` | ports.ts | fica em `core/src/ports.ts` | relativo |

**Suposição (decisão do autor da spec, reversível):** `Vehicle` e `Occupancy`
ficam em `core`, não em `contracts`, porque são entradas do cálculo montadas no
back — `Vehicle` sai do `VehicleCatalog` resolvendo modelo→dimensões; `Occupancy`
sai de check-ins/reservas. O front nunca os envia como wire (manda modelo/placa e
ids; o back constrói). Se o Felipe quiser esses dois tipos compartilhados com o
front, mova-os para `contracts` — só muda o destino desses dois símbolos, o resto
da migração é idêntico.

`Vehicle` usa `Dimensions` e `Occupancy` usa `NodeId`, então `core/src/model.ts`
importa `Dimensions` e `NodeId` de `@amps/contracts`. `core` dependendo de
`contracts` (tipos puros) **não** viola a pureza — não é I/O.

## Passos

1. **Mover com `git mv`:**
   ```
   mkdir -p packages/contracts/src packages/core/src packages/api/src
   git mv src/domain/model.ts        packages/contracts/src/model.ts
   git mv src/domain/ports.ts        packages/core/src/ports.ts
   git mv src/domain/pathfinding     packages/core/src/pathfinding
   git mv src/domain/recommendation  packages/core/src/recommendation
   rmdir src/domain src 2>/dev/null || true
   ```

2. **Partir o model:** em `packages/contracts/src/model.ts`, remova `Vehicle` e
   `Occupancy`. Crie `packages/core/src/model.ts` contendo só esses dois,
   importando `Dimensions` e `NodeId` de `@amps/contracts`:
   ```ts
   import type { Dimensions, NodeId } from '@amps/contracts';

   export interface Vehicle {
     readonly dimensions: Dimensions;
   }

   export type Occupancy = ReadonlySet<NodeId>;
   ```

3. **Criar os barrels:**
   - `packages/contracts/src/index.ts`: `export * from './model.js';`
   - `packages/core/src/index.ts`: reexporte a superfície pública real — as ports
     (`export * from './ports.js';`), os tipos de entrada (`export * from './model.js';`),
     a função `recommend`, e o(s) export(s) de `pathfinding/dijkstra.js`
     (o código exporta `dijkstra` e `dijkstraPathfinding` — confira e reexporte
     ambos se existirem). Não reexporte de `contracts` a partir de `core`.

4. **Reapontar imports** seguindo a regra:
   - Tipos de wire (os que foram para `contracts`) → `from '@amps/contracts'`
     (sem extensão).
   - `Vehicle` / `Occupancy` → `from '../model.js'` (relativo dentro de `core`,
     **com** `.js`).
   - Imports internos de `core` (`./dijkstra.js`, `../ports.js`, `./eligibility.js`,
     etc.) → permanecem relativos com `.js`.
   - Mantenha `import type` onde já era type-only.

   Arquivos com import a ajustar (todos hoje em `src/domain/`, agora em `core`):
   `ports.ts`, `pathfinding/dijkstra.ts`, `pathfinding/dijkstra.test.ts`,
   `recommendation/eligibility.ts`, `recommendation/eligibility.test.ts`,
   `recommendation/neighborhood.ts`, `recommendation/neighborhood.test.ts`,
   `recommendation/poiDistance.ts`, `recommendation/poiDistance.test.ts`,
   `recommendation/recommend.ts`, `recommendation/recommend.test.ts`,
   `recommendation/sizeBias.ts`, `recommendation/sizeBias.test.ts`.

   **Gotchas reais neste código (corrija ao reescrever):**
   - `recommendation/sizeBias.ts` importa `from "../model"` **sem** `.js`. Ao
     reapontar, `Vehicle` vem de `../model.js` (com extensão).
   - Metade dos arquivos usa aspas duplas, metade simples. Padronize para aspas
     simples nas linhas que você tocar. Não há lint configurado; é cosmético.

5. **Escrever os arquivos de configuração** (conteúdo na seção abaixo). Remova o
   `tsconfig.json` da raiz (substituído por `tsconfig.base.json` + um `tsconfig.json`
   por pacote).

6. **`api` placeholder** — `packages/api/src/main.ts` deve provar a resolução
   cross-pacote no typecheck (importa um valor de `@amps/core` e um tipo de
   `@amps/contracts`), sem executar I/O. Ex.:
   ```ts
   import type { ParkingGraph } from '@amps/contracts';
   import { recommend } from '@amps/core';

   export const wiringSmoke = (graph: ParkingGraph): typeof recommend => recommend;
   ```
   Ajuste os nomes aos exports reais de `@amps/core`. Adaptadores (Neo4j, MySQL,
   `VehicleCatalog`), Express e `@types/node` entram no passo 3 — **não** aqui.

   Crie também as subpastas de `api/src/` já previstas, **vazias com `.gitkeep`**
   (não escreva código nelas): `adapters/neo4j/`, `adapters/mysql/`,
   `adapters/pathfinding/`, `http/`, `config/`.

7. **Scaffold do `web` (só diretórios, nenhum código de front):**
   - Crie `packages/web/package.json` mínimo (conteúdo na seção de config). Ele
     **não** tem script `typecheck`, então o `npm run typecheck --workspaces
     --if-present` o pula, e o `vitest` (que só varre `packages/*/src/**/*.test.ts`)
     não acha teste ali. O `web` fica no monorepo mas inerte.
   - **Não** crie `tsconfig.json`, `vite.config.ts`, `.html`, `.ts` de front, nem
     adicione Konva/Vite. Isso é o passo 5.
   - Crie estas pastas, cada uma com um arquivo `.gitkeep` vazio:
     ```
     packages/web/owner
     packages/web/src/pages
     packages/web/src/api
     packages/web/src/auth
     packages/web/src/graph
     packages/web/src/graph/render
     packages/web/src/editor
     packages/web/src/editor/tools
     packages/web/src/client-map
     packages/web/src/dom
     packages/web/src/styles
     packages/web/src/lib
     ```
   - **Suposição materializada:** esta árvore assume o front **MPA** (a recomendação
     ainda pendente de martelo no doc de estrutura). Se depois optar por SPA, o
     ajuste é pequeno — some `src/pages/`, entra `src/app/` (router + shell) e um
     `index.html` único; as demais pastas (`graph/`, `api/`, `auth/`, `editor/`,
     `client-map/`, `dom/`, `styles/`, `lib/`) sobrevivem intactas.

8. **CI:** `.github/workflows/ci.yml` provavelmente não precisa mudar — `npm ci`
   na raiz instala e linka os workspaces, e `npm test` na raiz dispara
   `pretest` (typecheck de todos) + vitest global. Confirme que continua assim.

## Conteúdo dos arquivos de config

**`package.json` (raiz)** — preserve `name`, `description`, `repository`, `bugs`,
`homepage`, `keywords`, `author` e qualquer campo extra existente (ex.: `allowScripts`).
Adicione `private` e `workspaces`; ajuste `scripts`; mantenha `typescript` e
`vitest` como devDeps da raiz (compartilhados via hoisting):
```json
{
  "name": "amps",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "pretest": "npm run typecheck",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "license": "GPL-3.0",
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^2.1.8"
  }
}
```

**`tsconfig.base.json`** (raiz):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

**`packages/contracts/package.json`:**
```json
{
  "name": "@amps/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

**`packages/contracts/tsconfig.json`:**
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

**`packages/core/package.json`** (note: só `@amps/contracts` como dep — nada de I/O):
```json
{
  "name": "@amps/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "types": "./src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@amps/contracts": "*" }
}
```

**`packages/core/tsconfig.json`** (vitest globals só aqui, onde há testes):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vitest/globals"] },
  "include": ["src"]
}
```

**`packages/api/package.json`:**
```json
{
  "name": "@amps/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@amps/core": "*", "@amps/contracts": "*" }
}
```

**`packages/api/tsconfig.json`:**
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

**`packages/web/package.json`** (mínimo e inerte — sem `typecheck`, sem deps de
front ainda; Konva/Vite entram no passo 5):
```json
{
  "name": "@amps/web",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
```

**`vitest.config.ts`** (raiz — substitui o atual):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/*/src/**/*.test.ts'],
  },
});
```

## Definition of Done (verifique tudo)

- `npm install` na raiz cria os symlinks `node_modules/@amps/{contracts,core,api,web}`.
- `npm run typecheck` passa limpo em `contracts`, `core` e `api`; `web` é pulado
  (não tem script `typecheck`), sem erro.
- `npm test` na raiz: **16 testes passando** (os mesmos de antes; nenhum a mais,
  nenhum a menos, nenhum resultado diferente). O `web` não adiciona nem quebra testes.
- As pastas do scaffold existem no git após o commit: `git ls-files packages/web`
  lista os `.gitkeep` (prova de que os diretórios foram versionados, não sumiram).
- `grep -rn "from ['\"]\.\.\?/model" packages` não retorna nada em `contracts`
  (lá o model é local) e, em `core`, só aparece para `Vehicle`/`Occupancy` via
  `../model.js`. Nenhum import residual apontando para o antigo `src/domain`.
- `packages/core/package.json` e `packages/contracts/package.json` não listam
  neo4j-driver, mysql2 nem express (RNF-03).
- `git log --follow packages/core/src/pathfinding/dijkstra.ts` mostra o histórico
  anterior (prova de que foi `git mv`, não recriação).
- `docs/`, `docker-compose.yml`, `.env.example` inalterados.

## Fora de escopo (não faça)

- **Crie** `packages/web` como scaffold de diretórios (passo 7), mas **não** escreva
  nada de front: sem `.html`, sem `.ts`, sem `tsconfig`/`vite.config`, sem Konva/Vite.
  Só as pastas com `.gitkeep` e o `package.json` mínimo. O front é o passo 5.
- **Não** adicione build/bundler da API nem mude `moduleResolution` — isso é
  decisão do passo 3/4 (rodar a API em Node de verdade). Aqui os pacotes são
  consumidos como source via workspace, e é o suficiente para typecheck + Vitest.
- **Não** troque npm por pnpm/yarn.
- **Não** introduza ESLint/Prettier agora.
- **Não** reescreva lógica de domínio nem "melhore" nada além de mover e reapontar
  imports. O comportamento é idêntico; os testes são a prova.
- **Não** atualize os docs de fonte de verdade (`04-plano.md`, instruções do
  projeto) — a sincronização deles é outra tarefa.
