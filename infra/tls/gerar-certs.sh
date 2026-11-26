#!/usr/bin/env bash
#
# AMPS — geração da CA própria (X.509) e dos certificados de servidor para TLS.
# Projeto Final de Segurança da Informação (PSE102A).
#
# Cria uma Autoridade Certificadora local e assina um certificado de servidor com
# SAN para localhost/127.0.0.1/amps.local, usado pelo Caddy (borda TLS da API e do
# Merlian) e pelo MySQL. As chaves ficam em ./out (ignorado pelo git) — nunca versione
# chaves privadas; versione apenas este script.
#
# Uso:  bash infra/tls/gerar-certs.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/out"
DAYS_CA=3650
DAYS_SRV=825
mkdir -p "$OUT"

echo "[*] Gerando a CA própria (AMPS Root CA)..."
if [[ ! -f "$OUT/ca.key" ]]; then
  openssl genrsa -out "$OUT/ca.key" 4096
  openssl req -x509 -new -nodes -key "$OUT/ca.key" -sha256 -days "$DAYS_CA" \
    -subj "/C=BR/ST=PR/L=Curitiba/O=AMPS Lab/OU=Seguranca/CN=AMPS Root CA" \
    -out "$OUT/ca.crt"
  echo "    CA criada: out/ca.crt"
else
  echo "    CA já existe (out/ca.crt) — reutilizando."
fi

echo "[*] Gerando o certificado do servidor (SAN: localhost, 127.0.0.1, amps.local)..."
cat > "$OUT/server.cnf" <<'CNF'
[req]
distinguished_name = dn
req_extensions = v3_req
prompt = no
[dn]
C  = BR
ST = PR
L  = Curitiba
O  = AMPS Lab
OU = Seguranca
CN = amps.local
[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt
[alt]
DNS.1 = amps.local
DNS.2 = localhost
DNS.3 = api.amps.local
DNS.4 = merlian.amps.local
IP.1  = 127.0.0.1
IP.2  = ::1
CNF

openssl genrsa -out "$OUT/server.key" 2048
openssl req -new -key "$OUT/server.key" -out "$OUT/server.csr" -config "$OUT/server.cnf"
openssl x509 -req -in "$OUT/server.csr" -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" \
  -CAcreateserial -days "$DAYS_SRV" -sha256 \
  -extfile "$OUT/server.cnf" -extensions v3_req \
  -out "$OUT/server.crt"

# Cadeia completa (servidor + CA) para quem precisar do bundle.
cat "$OUT/server.crt" "$OUT/ca.crt" > "$OUT/server-fullchain.crt"

echo "[*] Pronto. Arquivos em infra/tls/out/:"
ls -1 "$OUT" | sed 's/^/    /'
echo
echo "[*] Verificação da cadeia:"
openssl verify -CAfile "$OUT/ca.crt" "$OUT/server.crt"
echo
echo "[i] Para o Node confiar na CA ao chamar o Merlian via HTTPS, exporte:"
echo "    export NODE_EXTRA_CA_CERTS=$OUT/ca.crt"
