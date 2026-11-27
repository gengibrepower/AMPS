# Evidências — Projeto Final de Segurança da Informação (PSE102A)

Saídas brutas dos testes T01–T17 do documento-resumo, geradas em 26/11/2026 no ambiente
local da equipe (containers Docker, rede isolada, apenas dados fictícios).
Os scripts que as reproduzem estão em `infra/tls/` e `infra/fail2ban/`.

| Arquivo | Testes | O que mostra |
|---|---|---|
| `ra1_acesso_e_robustez.txt` | T01–T04, T17 | login com JWT, 401 sem token, token adulterado, RBAC (403), entradas inválidas → 400 |
| `t02_captura.txt` | T07 | tcpdump do mesmo login: senha em claro no HTTP (:3001), 0 ocorrências no TLS (:8443) |
| `t02_http_claro.pcap` | T07 | captura do login em HTTP (abre no Wireshark) |
| `t02_https_tls.pcap` | T07 | captura do mesmo login pela borda TLS |
| `bloco1_tls.txt` | T05, T06, T08 | cadeia da CA própria, handshake TLS 1.3, cliente sem a CA recusado, MySQL exigindo TLS |
| `bloco2_defesas.txt` | T11 | cabeçalhos do helmet (CSP, HSTS, X-Frame-Options) |
| `bloco2_ataque.txt` | T09 | força bruta: 401 até o limite, depois 429 (rate limiting) |
| `bloco2_fail2ban_regex.txt` | T10 | `fail2ban-regex` oficial casando as linhas do log de segurança |
| `bloco3_hardening.txt` | T12 | `no-new-privileges`, `cap_drop: ALL`, raiz somente leitura |
| `bloco3_api_loopback.txt` | T12 | API presa ao `127.0.0.1` (antes exposta em `*:3001`) |
| `bloco3_zumbis_init.txt` | T12 | zumbis esgotando o `pids_limit` sem init, e a correção com `init: true` |
| `bloco3_scan.txt` | T13 | Trivy: configuração da API e imagens |
| `bloco4_cripto.txt` | T14–T16 | CPF cifrado no banco (AES-256-GCM), decifrado pela aplicação, adulteração detectada |
