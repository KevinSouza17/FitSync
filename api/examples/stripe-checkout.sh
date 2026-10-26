# Exemplo: stripe-checkout
# Substitua <base_url> e <TOKEN> pelos seus valores.
# O header Origin é usado para montar as URLs de sucesso/cancelamento.

curl -X POST "<base_url>/stripe-checkout" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -H "Origin: https://meu-app.com" \
  -d '{}'

# Resposta esperada (200):
# { "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
