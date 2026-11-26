# Fail2ban — detecção e bloqueio de brute-force (RA3)

Detecta tentativas repetidas de login/rate-limit no AMPS lendo o log de segurança da
API (`logs/seguranca.log`) e **bane o IP** no firewall.

## Instalar (Fedora, requer sudo)

```bash
sudo dnf install -y fail2ban
# copia filtro e jail deste repositório:
sudo cp infra/fail2ban/filter.d/amps-auth.conf /etc/fail2ban/filter.d/
sudo cp infra/fail2ban/jail.d/amps-auth.conf   /etc/fail2ban/jail.d/
# ajuste o logpath no jail para o caminho real do repo, se necessário.
sudo systemctl enable --now fail2ban
```

## Testar o filtro (sem banir)

```bash
fail2ban-regex logs/seguranca.log infra/fail2ban/filter.d/amps-auth.conf
```

## Ver o status / IPs banidos

```bash
sudo fail2ban-client status amps-auth
```

## Demonstração (ataque → bloqueio)

Com a API no ar, rode o brute-forcer da Atividade 05 contra o login:

```bash
python3 ../seguranca/atividades/05-ethical-hacking-devsecops/python/http_brute.py \
    https://localhost:8443/auth/login -u teste@demo.local -w senhas.txt
```

Após `maxretry` falhas em `findtime`, o Fail2ban bane o IP por `bantime`
(`sudo fail2ban-client status amps-auth` mostra o IP banido).

## Desbanir (ao final da demo)

```bash
sudo fail2ban-client set amps-auth unbanip <IP>
```

> Parâmetros atuais: 5 falhas em 60 s → ban de 600 s. Ajuste em `jail.d/amps-auth.conf`.
