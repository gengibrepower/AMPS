# AMPS

Monorepo npm workspaces: `packages/api` (Express + MySQL) e `packages/web`
(vanilla TS + Vite). O motor de grafo **não** vive aqui — é o
[Merlian](https://github.com/gengibrepower/Merlian), consumido por HTTP.

Antes de mexer no editor de pátio, leia `docs/05-editor.md`: tem as armadilhas
que custam uma tarde se descobertas na marra.

## Como trabalhar neste repo

- **Antes de cada commit, mostre o diff e a mensagem e espere confirmação.**
- **Sem trailer de co-autoria** — nem `Co-Authored-By`, nem `Generated with`,
  em commit ou em corpo de PR.
- Mensagens no padrão `feat(api):` / `feat(web):` / `feat(db):` / `fix(web):` /
  `chore(api):` / `test(api):` / `docs:`.
- Commits atômicos.
- **Sem comentários no código**, exceto comportamento não-óbvio.
- Push e PR: só quando pedido.

## Estilo

TypeScript strict nos dois pacotes (`exactOptionalPropertyTypes` e
`noUncheckedIndexedAccess` ligados na base). O que difere entre eles:

| | `packages/api` | `packages/web` |
| --- | --- | --- |
| indentação | tab | 4 espaços |
| import | com `.js` (NodeNext) | sem extensão (Bundler) |

Nomes de domínio em português; tipos de wire refletem o JSON da API em
`snake_case`.

## Padrões da API

- **Ports em `src/ports.ts`.** Adapters em `src/adapters/<tecnologia>/`, um
  arquivo por repositório, SQL em constante no topo.
- **Rotas chamam serviços, serviços chamam repositórios.**
- **`src/composition.ts` é a única fiação** — `main.ts` e os testes de
  integração usam a mesma função. Não duplique.
- **`exigir(req, res, campos)`** em `http/app.ts` valida corpo e responde 400.
- **Erros**: `ConflictError` (409), `ForbiddenError` (403), `NotFoundError`
  (404), `UnprocessableError` (422) e `UnavailableError` (503) em `errors.ts`,
  mapeados no `errorHandler`. Adapter traduz erro do banco: `asConflict` para
  `errno 1062`, `asRegraDoBanco` para os triggers e CHECKs.
- **`services/acessoDono.ts` resolve a RN-10.** Toda rota com `:id` começa por
  `acesso.estacionamento(usuarioId, id)`.

## Rodar

```bash
docker compose up -d    # mysql na 3307 (a 3306 é de outro projeto da máquina)
npm run dev             # api 3001 + web 5173, Ctrl+C derruba os dois
cd ../Merlian && npm run dev   # 3000
```

```bash
npm test                  # unitários, não precisam de banco
npm run test:integration  # precisam do banco de pé
```

## Tropeços conhecidos

- **`test:integration` apaga as 7 tabelas.** Para usar o app depois:
  `docker exec -i amps-mysql mysql -uroot -pamps123 < infra/mysql/init/02_seed_modelos.sql`
  (se acusar duplicata, apague a linha de `modelos` que o teste deixou).
- **Mexeu em `01_schema.sql` ou `03_integridade.sql`?** O init só roda com o
  volume vazio: `docker compose down -v && docker compose up -d`.
- **Não há cliente mysql na máquina** — use `docker exec -it amps-mysql mysql`,
  com `--default-character-set=utf8mb4`, senão `WHERE nome = 'Pátio'` não casa.
- **Ver o front sem extensão de navegador**: `chromium --headless
  --window-size=1280,900 --virtual-time-budget=8000 --screenshot=/tmp/x.png URL`.
  Página que exige sessão: uma fixture temporária no root do Vite (mesma origem)
  grava o `localStorage` e embute a página num iframe, que dá para dirigir por
  JS. Apague a fixture depois.
- **`packages/web` não declara `vite` nem `typescript`** — funciona por hoist do
  vitest na raiz. Resolver ao instalar a primeira dependência de verdade.
