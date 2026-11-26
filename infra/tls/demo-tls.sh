#!/usr/bin/env bash
#
# AMPS — demonstração/evidência do TLS (Bloco 1 do Projeto Final de Segurança).
# Mostra, de ponta a ponta, a confidencialidade em trânsito (RA2):
#   1) a cadeia de certificados (CA própria X.509 -> cert do servidor);
#   2) HTTPS na borda da API (Caddy) com verificação de cadeia;
#   3) MySQL exigindo TLS (conexão sem TLS é recusada);
#   4) API -> Merlian por HTTPS confiando na nossa CA.
#
# Pré-requisitos: `docker compose up -d` (mysql + caddy) e a API rodando (`npm run dev`).
# Uso:  bash infra/tls/demo-tls.sh
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # raiz do repo
CA=infra/tls/out/ca.crt
API=https://localhost:8443
MERLIAN=https://localhost:8444
PASS="$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2)"

linha() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

linha "1) Cadeia de certificados (CA própria -> servidor)"
openssl x509 -in infra/tls/out/server.crt -noout -subject -issuer -ext subjectAltName
echo "verificação:"; openssl verify -CAfile "$CA" infra/tls/out/server.crt

linha "2) HTTPS na borda da API (cadeia verificada pelo cliente)"
echo | openssl s_client -connect localhost:8443 -CAfile "$CA" -servername localhost 2>/dev/null \
  | grep -E "subject=|issuer=|Verify return code"
echo "login via HTTPS:"
curl -s --cacert "$CA" -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"teste@demo.local","senha":"SenhaForte#2026"}' -o /dev/null -w "  HTTP %{http_code} · TLS %{ssl_verify_result} (0=ok)\n"

linha "3) MySQL exige TLS"
echo -n "  sem TLS  -> "
if mysql --ssl-mode=DISABLED -u root -p"$PASS" -h 127.0.0.1 -P 3307 -e "select 1" >/dev/null 2>/tmp/mysql_notls.err; then
  echo "ACEITOU (inesperado!)"
else
  echo "RECUSADA ($(grep -oiE 'ERROR [0-9]+.*|secure connection' /tmp/mysql_notls.err | head -1))"
fi
echo -n "  com TLS  -> cipher: "
mysql --ssl-mode=REQUIRED -u root -p"$PASS" -h 127.0.0.1 -P 3307 -e "SHOW STATUS LIKE 'Ssl_cipher'" 2>/dev/null | awk 'NR==2{print $2}'

linha "4) API -> Merlian por HTTPS (Node confia na CA própria)"
NODE_EXTRA_CA_CERTS="$CA" node -e "fetch('$MERLIAN/').then(r=>console.log('  HTTPS status',r.status,'(CA propria aceita)')).catch(e=>console.log('  ERRO',e.message))"

echo
echo "[OK] TLS demonstrado nos três canais: cliente↔API, API↔MySQL, API↔Merlian."
