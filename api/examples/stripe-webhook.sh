# Exemplo: stripe-webhook
# Esta rota NÃO usa JWT. Ela é chamada pelo Stripe, que envia a
# assinatura no header "stripe-signature".
# Para testar localmente, use a CLI do Stripe (stripe listen) e não curl direto.

# Exemplo conceitual (não funciona sem uma assinatura válida):
curl -X POST "<base_url>/stripe-webhook" \
  -H "stripe-signature: t=...,v1=..." \
  -H "Content-Type: application/json" \
  -d '{ "id": "evt_test_123", "type": "checkout.session.completed", "data": { "object": {} } }'

# Resposta esperada (200) quando a assinatura é válida:
# { "received": true }
# Resposta (400) quando a assinatura está ausente/inválida:
# Missing signature  /  Webhook signature verification failed: ...
