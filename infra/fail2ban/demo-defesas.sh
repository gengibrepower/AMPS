#!/usr/bin/env bash
#
# AMPS — demonstração/evidência das defesas de login (Bloco 2 do Projeto Final, RA3):
#   1) cabeçalhos de segurança (helmet);
#   2) rate limiting no /auth/login (429);
#   3) brute-force gerando o log de segurança;
#   4) o filtro do Fail2ban casando as linhas (IP que seria banido).
#
# Pré-requisitos: docker compose up -d (mysql+caddy), API rodando, venv com requests.
# Uso:  bash infra/fail2ban/demo-defesas.sh
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # raiz do repo
CA=infra/tls/out/ca.crt
API=https://localhost:8443
PY="${PY:-/home/felipegegembauer/dev/seguranca/lab-venv/bin/python}"
LOG=logs/seguranca.log

linha() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }

linha "1) Cabeçalhos de segurança (helmet)"
curl -s -I --cacert "$CA" "$API/modelos" \
  | grep -iE "strict-transport|content-security|x-frame|x-content-type|referrer-policy|cross-origin" | sed 's/^/  /'

linha "2) Rate limiting no login (10/min -> 429)"
for n in $(seq 1 12); do
  c=$(curl -s -o /dev/null -w "%{http_code}" --cacert "$CA" -X POST "$API/auth/login" \
      -H 'Content-Type: application/json' -d '{"email":"teste@demo.local","senha":"errada"}')
  printf "  %s:%s" "$n" "$c"
done; echo

linha "3) Brute-force (Atividade 05 adaptada) -> alimenta o log"
rm -f "$LOG"
"$PY" infra/fail2ban/demo-brute.py --cacert "$CA" -n 30 2>/dev/null | tail -2 | sed 's/^/  /'

linha "4) Filtro do Fail2ban casando o log"
echo "  linhas no log: $(wc -l < "$LOG")  (AUTH_FAIL=$(grep -c AUTH_FAIL "$LOG"), RATE_LIMIT=$(grep -c RATE_LIMIT "$LOG"))"
"$PY" - "$LOG" <<'PY' | sed 's/^/  /'
import re, sys
host = r'(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F:]+)'
rx = re.compile(rf'^\S+ (?:AUTH_FAIL|RATE_LIMIT) ip=({host})')
ips, n = set(), 0
for ln in open(sys.argv[1]):
    m = rx.match(ln)
    if m: n += 1; ips.add(m.group(1))
print(f"filtro amps-auth casou {n} linhas; Fail2ban banaria: {sorted(ips)}")
PY
echo
echo "[i] Ban real (requer root): sudo dnf install fail2ban && instalar infra/fail2ban/* "
echo "    -> sudo fail2ban-client status amps-auth"
