# stripe-webhook

Recebe eventos do Stripe e atualiza o estado das assinaturas no banco.
Esta rota **não** usa JWT — ela é chamada pelo Stripe, que valida a
origem via assinatura (`stripe-signature`).

## Rota

```
POST {base_url}/stripe-webhook
```

## Autenticação

Header obrigatório enviado pelo Stripe:

```
stripe-signature: <assinatura do evento>
```

O corpo da requisição é o JSON bruto do evento (não interpretado pelo app).

## Eventos tratados

| Evento Stripe | Ação realizada |
|---------------|----------------|
| `checkout.session.completed` | Marca assinatura como ativa e o usuário como profissional |
| `customer.subscription.updated` | Atualiza status, preço e período; notifica se ficou em atraso |
| `customer.subscription.deleted` | Marca assinatura como cancelada; notifica o usuário |
| `invoice.payment_failed` | Marca assinatura como em atraso; notifica o usuário |
| `invoice.payment_succeeded` | Atualiza status e período; remove bloqueios |

## Respostas

### 200 — Evento recebido e processado

```json
{ "received": true }
```

### 400 — Assinatura inválida / ausente

```
Missing signature
```
ou
```
Webhook signature verification failed: <detalhe>
```

### 500 — Erro interno

```json
{ "error": "<mensagem do erro>" }
```

## Observações

- Após processar cada evento, a função também chama `lock_expired_subscriptions`
  para bloquear assinaturas que passaram do período de carência.
- Notificações por e-mail são registradas em `notification_emails` (com
  desduplicação de 24h) para evitar envios repetidos.
