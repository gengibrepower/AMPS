# Hardening de containers e host (Projeto Final — RA3)

Terceira camada de segurança do AMPS: reduzir a superfície de ataque dos
containers e do host, e **auditar** com ferramentas de scan.

## 1. Hardening dos containers (`docker-compose.yml`)

| Medida | MySQL | Caddy | Por quê |
|---|---|---|---|
| `security_opt: no-new-privileges` | ✅ | ✅ | impede escalonamento via binários setuid |
| `cap_drop: [ALL]` | — (quebra o entrypoint) | ✅ (+`NET_BIND_SERVICE`) | remove capabilities desnecessárias |
| `read_only: true` + `tmpfs` | — (DB escreve muito) | ✅ | FS raiz imutável; dados em volumes |
| Porta só no loopback | ✅ `127.0.0.1:3307` | n/a (host) | banco inacessível pela rede |
| `pids_limit` / `mem_limit` | ✅ | ✅ | limita impacto de DoS/fork-bomb |
| `healthcheck` | ✅ | ✅ | detecção de falha e reinício |

Comprovação (containers em execução): `evidencias/bloco3_hardening.txt`
(`docker inspect` mostrando `ReadonlyRootfs=true`, `CapDrop=[ALL]`,
`no-new-privileges`, binding em `127.0.0.1`, `healthy`).

> O MySQL oficial roda como root e faz `gosu mysql`; `cap_drop ALL`/`read_only`
> quebram seu entrypoint. Por isso o hardening dele é conservador (sem perder o
> essencial: sem novos privilégios, só no loopback, limites, healthcheck).

## 2. Imagem própria da API endurecida

`packages/api/Dockerfile`: base mínima (`node:22-bookworm-slim`), **multi-stage**
(deps de build fora do runtime), **usuário não-root** (`USER node`), remoção de
`npm`/`npx` do runtime, `HEALTHCHECK`.

```bash
# build a partir da raiz do monorepo
docker build -f packages/api/Dockerfile -t amps-api:hardened .
```

## 3. Scan de segurança (Trivy)

Sem instalar nada no host — Trivy roda em container:

```bash
# Misconfiguration (IaC): Dockerfile/compose
docker run --rm -v "$PWD":/scan:ro aquasec/trivy:latest config /scan --severity HIGH,CRITICAL

# CVEs de uma imagem
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --severity HIGH,CRITICAL caddy:2.8
```

Resultados em `evidencias/bloco3_scan.txt`:
- `packages/api/Dockerfile`: **0 misconfigurations** HIGH/CRITICAL.
- `caddy:2.8`: 28 (alpine) + 70 (binário Go) → **imagem base desatualizada**;
  ação: atualizar a tag (ex.: `caddy:2.10`).
- `mysql:8.0`: 113 HIGH no SO base → motiva isolamento no loopback + limites.

> **Leitura de segurança:** o scan não "zera" CVEs das imagens oficiais, mas
> orienta: (a) atualizar tags base, (b) reduzir a superfície (nossa imagem da API
> nasce limpa) e (c) compensar o que não dá para corrigir com hardening de runtime
> e isolamento de rede.

## 4. Firewall de host (Fedora/firewalld)

Expor só a borda TLS (8443/8444); portas internas ficam no loopback.

```bash
sudo bash infra/hardening/firewall.sh           # prévia (não altera nada)
sudo bash infra/hardening/firewall.sh --apply    # aplica
```

## 5. Auditoria do host com Lynis (passo com sudo, na gravação)

```bash
sudo dnf install -y lynis
sudo lynis audit system --quick | tee evidencias/bloco3_lynis.txt
# anotar o "Hardening index" e as sugestões priorizadas
```

Lynis audita o **host** (serviços, SSH, kernel, permissões) — complementa o Trivy,
que audita **imagens**. Deixado para a gravação por exigir root no host real.
