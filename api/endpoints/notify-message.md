# notify-message

Notifica o destinatário de uma conversa sobre uma nova mensagem.

## Rota

```
POST {base_url}/notify-message
```

## Autenticação

Header obrigatório:

```
Authorization: Bearer <JWT>
```

O JWT é o token de sessão do Supabase Auth do usuário que está enviando a mensagem.

## Requisição (body JSON)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `conversationId` | string (UUID) | Sim | ID da conversa |
| `content` | string | Sim | Conteúdo da mensagem |

### Exemplo de requisição

```json
{
  "conversationId": "11111111-1111-1111-1111-111111111111",
  "content": "Olá, tudo bem?"
}
```

## Respostas

### 200 — Sucesso

```json
{ "ok": true }
```

### 400 — Campos obrigatórios faltando

```json
{ "error": "conversationId e content são obrigatórios." }
```

### 401 — Não autenticado

```json
{ "error": "Não autenticado." }
```

### 404 — Conversa não encontrada

```json
{ "error": "Conversa não encontrada." }
```

### 500 — Erro interno

```json
{ "error": "Erro interno." }
```

## Fluxo resumido

1. Valida o JWT do remetente.
2. Busca a conversa pelo `conversationId`.
3. Determina quem é o destinatário (o outro usuário da conversa).
4. (Atualmente retorna `ok: true`; a notificação em si é gerenciada por triggers/realtime no banco.)
