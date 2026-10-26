# Exemplo: notify-message
# Substitua <base_url> e <TOKEN> pelos seus valores.

curl -X POST "<base_url>/notify-message" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "11111111-1111-1111-1111-111111111111",
    "content": "Olá, tudo bem?"
  }'

# Resposta esperada (200):
# { "ok": true }
