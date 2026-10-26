# Exemplo: send-invite
# Substitua <base_url> e <TOKEN> pelos seus valores.

curl -X POST "<base_url>/send-invite" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "amigo@exemplo.com"
  }'

# Resposta esperada (200):
# { "ok": true }
