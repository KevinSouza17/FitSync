// =============================================================================
// Edge Function: notify-message
// -----------------------------------------------------------------------------
// Objetivo: notificar o destinatário de uma conversa sobre uma nova mensagem.
//
// Rota:  POST {base_url}/notify-message
// Auth:  Header "Authorization: Bearer <JWT>" (token de sessão do Supabase)
//
// Body esperado (JSON):
//   - conversationId (string, UUID)  -> ID da conversa
//   - content        (string)        -> texto da mensagem
//
// Respostas:
//   200 { ok: true }                          -> sucesso
//   400 { error: "...obrigatórios." }         -> campos faltando
//   401 { error: "Não autenticado." }         -> sem token / token inválido
//   404 { error: "Conversa não encontrada." } -> conversationId inexistente
//   500 { error: "Erro interno." }            -> exceção não tratada
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// Headers CORS obrigatórios para toda Edge Function do Supabase.
// Sem eles, o navegador do cliente rejeita a resposta.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Helper para montar uma resposta JSON padronizada (com CORS).
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decodifica o payload de um JWT sem validar a assinatura.
// Usado apenas para extrair o `sub` (ID do usuário) do token de sessão.
// A validação real do JWT é feita pelo Supabase (verify_jwt = true no config.toml).
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Converte base64url -> base64 e decodifica.
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(b64);
    // Trata caracteres UTF-8 (acentos, etc.).
    const text = decodeURIComponent(
      decoded
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(text);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  // Pré-voo CORS: o navegador envia OPTIONS antes de POST em cross-origin.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // --- 1. Autenticação: extrai o JWT do header Authorization ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado." }, 401);
    }
    const jwt = authHeader.slice("Bearer ".length).trim();
    const payload = decodeJwtPayload(jwt);
    const senderId = payload?.sub as string | undefined;
    if (!senderId) return json({ error: "Sessão inválida." }, 401);

    // --- 2. Lê e valida o corpo da requisição ---
    const body = await req.json().catch(() => ({}));
    const conversationId: string | undefined = body?.conversationId;
    const content: string | undefined = body?.content;
    if (!conversationId || !content) {
      return json({ error: "conversationId e content são obrigatórios." }, 400);
    }

    // --- 3. Cria cliente Supabase com a service role key (contorna RLS) ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração ausente." }, 500);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // --- 4. Busca a conversa para descobrir o destinatário ---
    const { data: conv } = await serviceClient
      .from("conversations")
      .select("user_a_id, user_b_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return json({ error: "Conversa não encontrada." }, 404);

    // O destinatário é "o outro usuário" da conversa.
    const recipientId = conv.user_a_id === senderId ? conv.user_b_id : conv.user_a_id;
    if (recipientId === senderId) return json({ ok: true }); // não deveria acontecer

    // --- 5. Responde sucesso (a notificação em si é gerenciada no banco) ---
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Erro interno." }, 500);
  }
});
