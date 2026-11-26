#!/usr/bin/env bash
#
# AMPS — firewall de host (Fedora/firewalld) para o Projeto Final (RA3).
# Expõe para a rede APENAS a borda TLS (8443/8444); banco e serviços internos
# ficam só no loopback. Requer root. NÃO roda nada destrutivo sem --apply.
#
# Ver regras que SERIAM aplicadas:   sudo bash infra/hardening/firewall.sh
# Aplicar de fato:                   sudo bash infra/hardening/firewall.sh --apply
set -euo pipefail

APPLY="${1:-}"
PORTAS_PUBLICAS=(8443 8444)   # borda TLS (Caddy) -> API e Merlian

run() {
  echo "  + $*"
  [[ "$APPLY" == "--apply" ]] && "$@"
}

echo "[*] Política: negar por padrão, liberar só a borda TLS. (zona: public)"
echo "[*] Portas internas (3001 API, 3000 Merlian, 3307 MySQL) NÃO são expostas:"
echo "    - MySQL já está preso a 127.0.0.1 no compose (127.0.0.1:3307)."
echo "    - API/Merlian ouvem em loopback; só o Caddy (8443/8444) é público."
echo

if ! command -v firewall-cmd >/dev/null; then
  echo "!! firewalld ausente. Instale: sudo dnf install -y firewalld && sudo systemctl enable --now firewalld"
  exit 1
fi

echo "[*] Liberando a borda TLS:"
for p in "${PORTAS_PUBLICAS[@]}"; do
  run firewall-cmd --permanent --add-port="${p}/tcp"
done

echo "[*] Garantindo que portas internas não fiquem abertas:"
for p in 3000 3001 3307; do
  run firewall-cmd --permanent --remove-port="${p}/tcp" 2>/dev/null || true
done

run firewall-cmd --reload

echo
if [[ "$APPLY" == "--apply" ]]; then
  echo "[*] Estado atual:"; firewall-cmd --list-ports
else
  echo "[i] Prévia apenas. Para aplicar: sudo bash $0 --apply"
fi
