# syntax=docker/dockerfile:1
#
# Imagem endurecida da API do AMPS (Projeto Final de Segurança — RA3).
# Princípios: base mínima, multi-stage (deps de build fora da imagem final),
# usuário não-root, sem shell/compiladores no runtime.
#
# Build (a partir da RAIZ do monorepo):
#   docker build -f packages/api/Dockerfile -t amps-api:hardened .

# ---- Stage 1: dependências (inclui as de dev p/ rodar via tsx) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Só os manifestos primeiro: cacheia o npm ci enquanto o código muda.
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
RUN npm ci --ignore-scripts

# ---- Stage 2: runtime mínimo e não-root ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Copia só o necessário: node_modules e o código da API.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/api ./packages/api
# Remove gerenciadores de pacote do runtime (reduz superfície de ataque).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
# node:* já traz o usuário não-root "node" (uid 1000).
USER node
EXPOSE 3001
# Healthcheck simples no endpoint público da API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/modelos').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# tsx roda o entrypoint TypeScript sem passo de build.
CMD ["node", "--import", "tsx", "packages/api/src/main.ts"]
