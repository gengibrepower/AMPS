# AMPS — Guia do cadastro de carro, do zero

Este documento é para quem vai implementar o cadastro de carro e ainda não tem
o projeto rodando na máquina. Ele vai do Windows recém-ligado até a página de
carro funcionando integrada com a API.

Leia na ordem. A **Parte 1** é o ambiente e você faz uma vez só. A **Parte 2**
explica o que já existe. A **Parte 3** é o trabalho em si, em passos que você
consegue testar um a um.

Se algum comando falhar, o primeiro reflexo é `pwd` e `ls`: a maioria dos
"No such file or directory" é caminho relativo errado, não comando errado.

---

# Parte 1 — O ambiente, do zero

Você vai rodar tudo dentro do **WSL2**, que é um Linux de verdade dentro do
Windows. O projeto é feito para Linux: os scripts, os caminhos e o Docker
assumem isso. Rodar direto no Windows dá muito mais trabalho do que instalar o
WSL.

Três princípios que valem para tudo abaixo — eles explicam o *porquê* de cada
escolha:

1. **O código mora do lado Linux** (`~/dev/...`), nunca em `/mnt/c/...`. Todo
   acesso a arquivo do Windows pelo WSL atravessa uma ponte lenta; `npm
   install` e o Vite ficam arrastados. Clone uma cópia nova dentro do Linux.
2. **Senha vai em `.env`, nunca no código.** O `.env` está no `.gitignore` de
   propósito.
3. **Não rode `sudo` sem saber o que o comando faz.** Abaixo cada um está
   explicado.

## 1.1 Instalar o WSL2 e o Ubuntu

Abra o **PowerShell como administrador** (botão direito no menu Iniciar →
"Terminal (Admin)") e rode:

```powershell
wsl --install
```

**Reinicie o computador.** Isso é obrigatório, não é excesso de zelo.

Depois de reiniciar o Ubuntu abre sozinho e pede um usuário e uma senha do
Linux. Dois avisos:

- **Ao digitar a senha nada aparece na tela** — nem asterisco. É assim mesmo,
  pode digitar.
- Use uma senha só com letras e números na primeira vez. Teclado ABNT2 e
  layout US discordam sobre `/ ? ç` e acentos, e você não vê o que digitou.

Confira, de volta no PowerShell:

```powershell
wsl -l -v
```

Tem que aparecer `Ubuntu` com `VERSION 2`. Se não listar nada:
`wsl --install -d Ubuntu`.

Daqui para frente, **todo comando é dentro do Ubuntu**, não no PowerShell —
exceto onde eu disser o contrário.

## 1.2 Atualizar o sistema e instalar o compilador

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git
```

O `build-essential` traz o compilador C/C++. Ele parece não ter nada a ver com
JavaScript, mas é a causa número um de `npm install` falhando com erro
incompreensível: alguns pacotes compilam código nativo na instalação.

## 1.3 Node pelo nvm (não pelo apt)

O Node do `apt` é velho. O **nvm** deixa você trocar de versão por projeto.

Pegue a URL atual do instalador em <https://github.com/nvm-sh/nvm> (a versão no
comando muda com o tempo) e rode o que a página mandar, algo como:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

**Feche e reabra o terminal do Ubuntu.** O nvm só entra no PATH na sessão
seguinte — se você rodar `nvm` agora vai dar `command not found`, e é normal.

Depois:

```bash
nvm install --lts
node -v && npm -v
```

Se aparecer algum aviso sobre pacotes em `C:\Users\...\AppData\Roaming\npm`, é
o Node do **Windows** vazando pelo PATH. Ignore: dentro do WSL usamos o Node do
nvm. Não misture os dois no mesmo projeto.

## 1.4 Docker dentro do WSL

O banco (MySQL) roda em container. Instale o **Docker Engine dentro do Ubuntu**
seguindo a documentação oficial para Ubuntu:
<https://docs.docker.com/engine/install/ubuntu/>

Siga a seção "Install using the apt repository". Ela manda adicionar o
repositório da Docker e uma chave GPG. Isso é legítimo e vem da própria Docker:
a chave GPG é o que garante que os pacotes são mesmo deles e não de um
impostor.

Terminada a instalação, duas coisas específicas do WSL:

```bash
sudo service docker start
sudo docker run hello-world
```

Se o `hello-world` imprimir a mensagem de boas-vindas, o Docker está de pé.
Agora, para não precisar de `sudo` toda vez:

```bash
sudo usermod -aG docker $USER
```

Isso só vale numa **sessão nova**. No PowerShell:

```powershell
wsl --shutdown
```

Reabra o Ubuntu e teste `docker run hello-world`, agora **sem sudo**.

> Honestidade: estar no grupo `docker` é quase o mesmo que ser root na máquina.
> Numa máquina pessoal de desenvolvimento tudo bem; num servidor compartilhado
> seria uma decisão a pensar.

**Pegadinha que volta todo dia:** o WSL não inicia serviços sozinho. **Toda vez
que abrir o Ubuntu** você precisa de `sudo service docker start` antes de
mexer em container. Se um comando `docker` responder "Cannot connect to the
Docker daemon", é isso.

## 1.5 Clonar o projeto

```bash
mkdir -p ~/dev && cd ~/dev
git clone https://github.com/gengibrepower/AMPS.git
cd AMPS
```

Veja em que branch você está e quais existem:

```bash
git branch -a
```

Combine com o dono do repositório qual branch usar **antes** de instalar as
dependências — branches diferentes podem ter `package.json` diferentes.

## 1.6 O arquivo `.env`

O projeto precisa de um `.env` na raiz. Existe um modelo versionado:

```bash
cp .env.example .env
nano .env
```

Troque os três `PUT_YOUR_..._HERE` por valores seus. Escolha uma senha
qualquer para o MySQL local (ela não protege nada de verdade, é banco na sua
máquina) e um texto qualquer e comprido para o `AUTH_JWT_SECRET`. No `nano`,
salvar é `Ctrl+O`, `Enter`, e sair é `Ctrl+X`.

O resto deixe como está. Em especial:

| variável | por que é assim |
| --- | --- |
| `MYSQL_PORT=3307` | a 3306 estava ocupada na máquina de quem montou o projeto. O container mapeia 3307 do seu Linux para a 3306 de dentro dele |
| `CORS_ORIGIN=http://localhost:5173` | a API **só** aceita requisições dessa origem. Leia a Parte 4 antes de mudar |
| `MERLIAN_URL` | é outro repositório, e **você não precisa dele** para o cadastro de carro |

**Anote a senha que você escolheu.** Vários comandos do `CLAUDE.md` têm
`-pamps123` escrito literalmente; onde aparecer, troque pela sua.

## 1.7 Subir o banco e instalar as dependências

```bash
sudo service docker start
docker compose up -d
docker ps
```

O `docker ps` tem que mostrar `amps-mysql` com status `Up`.

Na primeira subida, o container executa sozinho os arquivos de
`infra/mysql/init/`: cria as tabelas e **semeia os 7 modelos de carro** que
você vai listar no `<select>`. Isso só acontece com o volume vazio — guarde
isso, é a pegadinha da Parte 4.

Agora as dependências. Este projeto é um **monorepo npm workspaces**: um único
`npm install` na raiz instala os dois pacotes. Não entre em `packages/api` para
instalar de novo.

```bash
npm install
```

## 1.8 Rodar

```bash
npm run dev
```

Isso sobe a API na 3001 e o front na 5173 ao mesmo tempo; `Ctrl+C` derruba os
dois. Abra no navegador do **Windows** mesmo:

<http://localhost:5173>

O WSL encaminha `localhost` para o Windows sozinho, não precisa configurar
nada.

Teste que está tudo ligado: clique em Conta → "Criar conta", cadastre um
cliente e faça login. Se o cadastro funcionar, front, API e banco estão
conversando — é tudo que você precisa antes de programar.

## 1.9 Editor

Instale o **VS Code no Windows** (não dentro do WSL) e a extensão **WSL**, da
Microsoft. Depois, no Ubuntu, dentro da pasta do projeto:

```bash
code .
```

A janela abre com "WSL: Ubuntu" no canto inferior esquerdo: você edita com a
interface do Windows mas os arquivos são os do Linux, rápidos. O terminal
integrado já abre no Ubuntu.

Extensões: ESLint e Prettier bastam. Resista à vontade de instalar quarenta.

## 1.10 Rotina de todo dia

```bash
sudo service docker start          # o WSL não guarda isso entre sessões
cd ~/dev/AMPS
docker compose up -d               # se o container não estiver de pé
npm run dev                        # api 3001 + web 5173
```

---

# Parte 2 — O que já existe

Antes de escrever qualquer coisa, entenda o terreno.

## 2.1 A API que você vai consumir

| rota | situação | o que faz |
| --- | --- | --- |
| `GET /modelos` | **pronta**, pública | devolve `[{ id, marca, nome }]` — os 7 modelos semeados |
| `POST /carros` | **pronta**, autenticada | recebe `{ placa, modelo_id }`, devolve `{ id, placa, modelo_id, proprietario }` |
| `GET /carros` | **não existe** | você vai criar, no Passo 5 |

Duas coisas importantes sobre o `POST /carros`:

- **Autenticada** quer dizer que precisa do cabeçalho
  `Authorization: Bearer <token>`. Você não vai montar isso na mão: o
  `src/api.ts` já tem uma função que faz isso sozinha (Passo 3).
- **`proprietario` não vai no corpo.** A API pega o nome do dono do token. Veja
  `packages/api/src/services/carroService.ts` — são 15 linhas, vale ler.

## 2.2 O menu já te espera

O front já sabe adaptar a navegação ao tipo de conta (veja
`docs/06-navegacao-e-contas.md`). Uma conta `common_user` já vê **"Meus
carros"** no menu, apontando para `carro.html`.

Esse arquivo ainda não existe. Criá-lo é o seu Passo 1, e o link passa a
funcionar sozinho.

## 2.3 A página que você pode copiar

`owner/estacionamentos.html` + `src/pages/estacionamentos.ts` fazem exatamente
o que a sua página precisa fazer: bloqueiam quem não tem sessão, abrem um
formulário, criam pela API e listam o resultado.

**Leia esses dois arquivos inteiros antes de começar.** Eles são o seu molde. O
seu trabalho é o mesmo desenho com outro assunto.

## 2.4 As regras da casa

Do `CLAUDE.md`, o que te afeta:

- `packages/web` usa **4 espaços** de indentação e imports **sem** extensão.
  `packages/api` usa **tab** e imports **com `.js`**. Não é escolha: é o que os
  dois `tsconfig` exigem.
- TypeScript strict nos dois. `noUncheckedIndexedAccess` está ligado, então
  `lista[0]` tem tipo `T | undefined` e o compilador vai te cobrar isso.
- **Sem comentário no código**, exceto para explicar comportamento não-óbvio.
- Nomes de domínio em português. Os tipos que espelham o JSON da API ficam em
  `snake_case`, porque é assim que o JSON chega.

---

# Parte 3 — O trabalho, passo a passo

Cada passo termina em algo que você consegue ver funcionando. Não pule para o
seguinte sem conferir o anterior.

## Passo 1 — A página HTML

Crie `packages/web/carro.html`, **na raiz de `packages/web`** (mesmo nível do
`index.html`, não dentro de `src/`).

Copie a estrutura de `owner/estacionamentos.html` e adapte. Ela tem duas seções
irmãs que você precisa manter:

- `#bloqueio` — a mensagem para quem não está logado
- `#area` — a página de verdade

Os campos do formulário são só dois: a placa (`<input>`) e o modelo
(`<select>`, que você vai preencher pela API — deixe vazio no HTML).

Atenção aos caminhos: `estacionamentos.html` está em `owner/`, então referencia
`../css/...`. A sua página está na raiz, então é `css/...`, sem o `../`.

**Confira:** abra <http://localhost:5173/carro.html>. Tem que aparecer alguma
coisa, ainda sem comportamento nenhum.

## Passo 2 — Registrar a página no Vite

Abra `packages/web/vite.config.ts` e acrescente a sua página em
`rollupOptions.input`, ao lado das outras.

**Isto é fácil de esquecer e o sintoma engana:** sem essa linha a página
funciona normalmente no `npm run dev` e simplesmente **some** quando alguém
roda `npm run build`.

**Confira:** `npm run build -w @amps/web` e veja `carro.html` aparecer na
listagem do final.

## Passo 3 — As funções da API no front

Abra `packages/web/src/api.ts`. Você vai acrescentar três coisas, seguindo o
padrão que já está lá:

1. Um tipo `ModeloWire` com `id`, `marca` e `nome`.
2. Uma função `listarModelos()` que chama `GET /modelos`. Use `pedir` — a rota
   é pública.
3. Um tipo `CarroWire` e uma função `cadastrarCarro()` para `POST /carros`. Use
   **`pedirAutenticado`** — é ela que põe o `Authorization` sozinha.

Repare em `cadastrarCliente` e `criarEstacionamento` logo acima: são o mesmo
formato. Os campos do tipo vão em `snake_case` (`modelo_id`), porque refletem o
JSON.

## Passo 4 — A lógica da página

Crie `packages/web/src/pages/carro.ts` e ligue o `<script type="module">` no
final do `carro.html`.

Faça nesta ordem, testando entre uma coisa e outra:

**4a. O bloqueio.** No final do arquivo, decida se mostra `#area` ou
`#bloqueio`. O molde está no final de `src/pages/estacionamentos.ts`. Uma
diferença importante: aquela página exige `tipo_conta === 'dono'`; a sua **não
deve exigir tipo nenhum**. Qualquer conta autenticada pode ter carro — a API
não olha o tipo. Basta ter sessão.

**4b. O select de modelos.** Chame `listarModelos()` e crie um `<option>` para
cada, com `value` = id e o texto `marca nome`.

*Confira:* recarregue e veja os 7 modelos na lista. Se vier vazia, abra o
console do navegador (F12) — a mensagem de erro está lá.

**4c. O cadastro.** No `submit` do formulário, leia a placa e o modelo
escolhido e chame `cadastrarCarro()`. Use `mostrarMensagem` de `src/ui.ts` para
o retorno, como as outras páginas fazem.

Cuidado: `select.value` é **string**. A API quer `modelo_id` número. Converta
com `Number(...)` e confira com `Number.isInteger(...)`.

*Confira:* cadastre um carro. A mensagem de sucesso tem que aparecer. Confirme
no banco que gravou mesmo:

```bash
docker exec -it amps-mysql mysql -uroot -p<SUA_SENHA> \
  --default-character-set=utf8mb4 \
  -e "SELECT * FROM parking_system.carros;"
```

**4d. A listagem.** Ainda não dá: não existe rota para ler carros. É o próximo
passo. Deixe a função pronta recebendo uma lista e desenhando os `<li>`, e
chame com uma lista vazia por enquanto.

## Passo 5 — `GET /carros` na API

Aqui você sai do front. É a única parte do trabalho em `packages/api`, e ela
tem uma ordem obrigatória, do fundo para a superfície. **Um arquivo por vez,
compilando entre um e outro** com `npm run typecheck`.

O caminho que o `CLAUDE.md` define é: as rotas chamam serviços, os serviços
chamam repositórios, e o SQL fica numa constante no topo do adapter.

**5a. A porta.** Em `packages/api/src/ports.ts`, ache
`export interface CarroRepository`. Hoje ela só tem `create`. Acrescente um
método de listagem.

O que ele recebe é a decisão de verdade deste passo, e vale conversar antes de
decidir: a tabela `carros` **não tem `usuario_id`**. Só tem `proprietario`, que
é o *nome* do usuário, copiado na hora do cadastro (`01_schema.sql`). Então
listar "os carros do usuário X" só dá para fazer pelo nome — e dois usuários
homônimos veriam os carros um do outro. Duas saídas:

- **Listar por `proprietario`**, aceitando a limitação e registrando ela.
- **Acrescentar `usuario_id` à tabela**, que é o certo, mas mexe em
  `01_schema.sql` e exige recriar o banco (veja a Parte 4).

Escolha com o dono do repositório. A segunda é mais trabalho e é a resposta
correta.

**5b. O adapter.** Em `packages/api/src/adapters/mysql/mysqlCarroRepository.ts`,
acrescente o `SELECT` numa constante no topo, ao lado do `INSERT` que já está
lá, e implemente o método.

O molde exato está em `mysqlEstacionamentoRepository.ts`: veja como ele declara
`interface EstacionamentoRow extends RowDataPacket`, como `SELECT_BY_DONO` fica
numa constante, e como uma função `toEstacionamento(row)` traduz a linha do
banco (em `snake_case`) para o tipo do domínio (em `camelCase`). Faça igual.

**5c. O serviço.** Em `packages/api/src/services/carroService.ts`, acrescente o
método que chama o repositório.

**5d. A rota.** Em `packages/api/src/http/app.ts`, ao lado do
`app.post('/carros', ...)` que já existe, crie o `app.get`. Copie a forma do
`app.get('/estacionamentos', ...)`:

- `autenticar(deps.tokenService)` como segundo argumento
- `const auth = autenticado(req, res); if (auth === null) return;`
- devolva a lista já em `snake_case`, como o `POST /carros` faz com um carro só

**Você não precisa mexer em `composition.ts`.** O `CarroService` e o
`MysqlCarroRepository` já estão ligados lá; você só acrescentou métodos.

**Confira** com a API de pé. Primeiro pegue um token:

```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"SEU_EMAIL","senha":"SUA_SENHA"}'
```

Copie o `token` da resposta e use:

```bash
curl -s http://localhost:3001/carros -H "Authorization: Bearer <TOKEN>"
```

**Pegadinha:** `npm run dev` da API **não tem watch**. Mexeu em
`packages/api`? Derrube com `Ctrl+C` e suba de novo, senão o servidor continua
com o código velho — e o sintoma é a sua rota nova dando 404.

## Passo 6 — Ligar a listagem

Volte ao front. Acrescente `listarCarros()` em `src/api.ts` (com
`pedirAutenticado`) e chame-a de `src/pages/carro.ts`, no carregamento da
página e depois de cada cadastro.

Aproveite para resolver um detalhe: o carro vem com `modelo_id`, não com o nome
do modelo. Você já buscou a lista de modelos no passo 4b — guarde num
`Map<number, ModeloWire>` e cruze, para mostrar "Fiat Argo" em vez de
"modelo 3".

## Passo 7 — Testes

Rode o que já existe antes de mais nada, para ter certeza de que você não
quebrou nada:

```bash
npm test                  # unitários, não precisam de banco
npm run test:integration  # precisam do banco de pé
```

Leia o aviso sobre o `test:integration` na Parte 4 **antes** de rodá-lo.

Para o que você escreveu:

- **Se houver função pura** — cruzar carro com modelo, formatar placa —, ela
  merece um `.test.ts` ao lado, sem DOM. O repositório não tem jsdom, então
  teste de unidade no front só serve para lógica pura. `src/sessao.test.ts` é
  um exemplo curto.
- **O adapter novo** tem um `.integration.test.ts` ao lado dos outros em
  `adapters/mysql/`. Veja `mysqlCarroRepository.integration.test.ts`.
- **A página inteira** seria um `.e2e.test.ts` em `src/e2e/`. O
  `navegacao.e2e.test.ts` é o exemplo mais próximo: ele já cria conta, loga e
  navega. Dirige um Chromium de verdade e precisa do `npm run dev` de pé.

---

# Parte 4 — As armadilhas

Estas custam uma tarde se você descobrir na marra.

### "Não foi possível falar com o servidor" quase nunca é o servidor

É **CORS**. A API só aceita requisições vindas de `http://localhost:5173`. Se a
5173 já estiver ocupada — outro `npm run dev` esquecido rodando —, o Vite sobe
na **5174 sem avisar**, o navegador bloqueia tudo, e o front mostra essa
mensagem. Que é a mesma de API fora do ar. Por isso:

**Olhe a porta na barra de endereço antes de procurar bug no seu código.**

Pelo mesmo motivo `http://127.0.0.1:5173` não funciona, mesmo parecendo igual:
para o navegador é outra origem.

### `test:integration` apaga as 7 tabelas

Inclusive os dados que você cadastrou à mão para testar. Não é bug, é o
teste limpando o terreno. Para repovoar:

```bash
docker exec -i amps-mysql mysql -uroot -p<SUA_SENHA> \
  < infra/mysql/init/02_seed_modelos.sql
npm run seed:patios
```

Se o primeiro reclamar de duplicata, apague antes a linha de `modelos` que o
teste deixou.

### Mexeu em `01_schema.sql`? Precisa recriar o banco

Os arquivos de `infra/mysql/init/` **só rodam com o volume vazio**. Editar o
schema e reiniciar o container não faz nada. O comando que realmente recria:

```bash
docker compose down -v && docker compose up -d
```

O `-v` apaga o volume, e com ele **todos os dados**. É por isso que mudar o
schema é uma decisão, não um detalhe.

### Não existe cliente MySQL na máquina

Você fala com o banco por dentro do container:

```bash
docker exec -it amps-mysql mysql -uroot -p<SUA_SENHA> --default-character-set=utf8mb4
```

O `--default-character-set=utf8mb4` não é firula: sem ele um
`WHERE nome = 'Pátio'` não encontra nada, por causa do acento.

### A API não recarrega sozinha

Já dito no Passo 5, e repetido porque pega todo mundo: mexeu em
`packages/api`, derrube e suba o `npm run dev`.

### O Docker não sobe sozinho no WSL

`sudo service docker start` a cada sessão nova do Ubuntu.

---

# Parte 5 — Antes de pedir revisão

- [ ] `npm test` passa
- [ ] `npm run typecheck` passa nos dois pacotes
- [ ] `npm run build -w @amps/web` passa e lista `carro.html`
- [ ] A página funciona logado e mostra `#bloqueio` deslogado
- [ ] Indentação certa: 4 espaços no web, tab na api
- [ ] Imports: sem extensão no web, com `.js` na api
- [ ] Sem comentário explicando o óbvio
- [ ] Commits atômicos, mensagens no padrão `feat(web):` / `feat(api):` /
      `test(api):`
- [ ] **Sem trailer de co-autoria** nas mensagens de commit

O `CLAUDE.md` na raiz tem a lista completa das convenções. Vale reler antes de
abrir o PR.
