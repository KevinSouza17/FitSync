# Testes das APIs do FitSync

Os testes ficam nesta pasta e cobrem tanto a **lógica pura** das Edge
Functions quanto as **rotas ao vivo**.

## Arquivos

- `helpers.unit.test.ts` — testes unitários das funções puras (CORS,
  resposta JSON, decodificador de JWT, gerador de código de convite).
- `route.test.ts` — testes de rota (HTTP) que exercitam os endpoints
  ao vivo na Supabase.

## Como rodar

### Testes unitários (sem credenciais)

```bash
npx vitest run tests/helpers.unit.test.ts
```

### Testes de rota (requerem credenciais)

Os testes de rota exigem a URL base das funções e um JWT de sessão
válido. Sem essas variáveis eles são **pulados** (não falham).

```bash
API_BASE_URL=https://ryqzwvmzysohgqxbwtoj.supabase.co/functions/v1 \
AUTH_TOKEN=<seu_jwt_de_sessao> \
npx vitest run tests/route.test.ts
```

Para obter o `AUTH_TOKEN`: faça login no app, abra o console do
navegador e rode:

```js
const { data } = await window.supabase.auth.getSession();
console.log(data.session.access_token);
```

## Sobre o webhook do Stripe

A rota `stripe-webhook` valida a assinatura do evento enviada pelo
Stripe, por isso não pode ser testada com um JWT. Para testá-la
localmente, use a CLI do Stripe:

```bash
stripe listen --forward-to https://ryqzwvmzysohgqxbwtoj.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```
