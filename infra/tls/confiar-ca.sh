#!/usr/bin/env bash
# Confia na CA própria do AMPS para o navegador não alertar no HTTPS local.
# Sistema (Fedora) exige sudo; Firefox usa o profile do usuário.
set -euo pipefail
CA="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/out/ca.crt"
echo "[*] Sistema (requer sudo):"
echo "    sudo cp '$CA' /etc/pki/ca-trust/source/anchors/amps-ca.crt && sudo update-ca-trust"
echo "[*] Firefox/Chrome: Configurações > Certificados > Importar '$CA' e marcar 'confiar para sites'."
echo "[*] Ou use curl/openssl com --cacert '$CA' (já funciona nas evidências)."
