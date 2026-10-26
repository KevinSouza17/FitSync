# stripe-checkout

Cria uma sessão de checkout do Stripe para a assinatura PRO mensal,
com 7 dias de teste grátis, e retorna a URL para redirecionar o usuário.

## Rota

```
POST {base_url}/stripe-checkout
```

## Autenticação

Header obrigatório:

```
Authorization: Bearer <JWT>
```

## Requisição

Body vazio (sem parâmetros). O usuário é identificado pelo JWT.

### Headers relevantes

| Header | Descrição |
|--------|-----------|
| `Authorization` | `Bearer <JWT>` |
| `Origin` | Usado para montar as URLs de sucesso/cancelamento |

## Respostas

### 200 — Sucesso

```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_..." }
```

A aplicação deve redirecionar o navegador para essa `url`.

### 401 — Não autenticado

```json
{ "error": "Unauthorized" }
```

### 500 — Erro interno

```json
{ "error": "<mensagem do erro>" }
```

## Fluxo resumido

1. Valida o JWT e identifica o usuário.
2. Verifica se já existe uma assinatura (para reutilizar o cliente Stripe).
3. Cria (ou reutiliza) um cliente no Stripe.
4. Cria uma sessão de checkout no modo `subscription`, com:
   - Produto pré-definido (`STRIPE_PRODUCT_ID`)
   - R$ 25,00/mês
   - 7 dias de teste grátis
5. Registra/atualiza a assinatura no banco.
6. Retorna a `url` do checkout.
