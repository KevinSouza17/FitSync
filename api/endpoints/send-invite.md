# send-invite

Envia um convite para conversar para outro usuário, usando o e-mail dele.
Um código de 6 dígitos é gerado e enviado como notificação no app.

## Rota

```
POST {base_url}/send-invite
```

## Autenticação

Header obrigatório:

```
Authorization: Bearer <JWT>
```

## Requisição (body JSON)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `email` | string | Sim | E-mail do usuário convidado |
| `expectedUserId` | string (UUID) | Não | ID esperado do convidado (validação extra) |

### Exemplo de requisição

```json
{
  "email": "amigo@exemplo.com"
}
```

## Respostas

### 200 — Sucesso

```json
{ "ok": true }
```

### 400 — E-mail faltando / autoconvite / e-mail não corresponde ao usuário

```json
{ "error": "E-mail é obrigatório." }
```

### 401 — Não autenticado

```json
{ "error": "Não autenticado." }
```

### 404 — E-mail não tem conta no FitSync

```json
{ "error": "Este e-mail ainda não tem conta no FitSync. Peça para a pessoa se cadastrar primeiro." }
```

### 500 — Erro interno

```json
{ "error": "Erro interno. Tente novamente." }
```

## Fluxo resumido

1. Valida o JWT do convidante.
2. Procura o usuário pelo e-mail (função `find_user_id_by_email`).
3. Impede autoconvite e valida `expectedUserId` se informado.
4. Gera um código de 6 dígitos.
5. Cria uma notificação no banco para o convidado com o código.
