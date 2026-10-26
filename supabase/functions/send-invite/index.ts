// =============================================================================
// Edge Function: send-invite
// -----------------------------------------------------------------------------
// Objetivo: enviar um convite para conversar para outro usuário, usando o
// e-mail dele. Gera um código de 6 dígitos e cria uma notificação no app.
//
// Rota:  POST {base_url}/send-invite
// Auth:  Header "Authorization: Bearer <JWT>" (token de sessão do Supabase)
//
// Body esperado (JSON):
//   - email          (string)       -> e-mail do usuário convidado
//   - expectedUserId (UUID, opç.)   -> validação extra do ID esperado
//
// Respostas:
//   200 { ok: true }                                  -> sucesso
//   400 { error: "E-mail é obrigatório." }            -> e-mail faltando
//   400 { error: "Você não pode convidar a si mesmo." }
//   401 { error: "Não autenticado." }                 -> sem token
//   404 { error: "...ainda não tem conta..." }        -> e-mail sem conta
//   500 { error: "Erro interno. Tente novamente." }   -> exceção
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// Headers CORS obrigatórios (ver notify-message para detalhes).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Helper de resposta JSON com CORS.
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decodifica o payload do JWT apenas para ler o `sub` (ID do usuário).
// A validação da assinatura é feita pelo Supabase (verify_jwt = true).
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(b64);
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

// Gera um código de convite de 6 dígitos (0-9).
function genCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10).toString();
  return c;
}

Deno.serve(async (req: Request) => {
  // Pré-voo CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // --- 1. Autenticação: extrai o JWT e o ID do convidante ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado." }, 401);
    }
    const jwt = authHeader.slice("Bearer ".length).trim();
    const payload = decodeJwtPayload(jwt);
    const inviterId = payload?.sub as string | undefined;
    if (!inviterId) return json({ error: "Sessão inválida." }, 401);

    // --- 2. Lê e valida o corpo da requisição ---
    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body?.email;
    const expectedUserId: string | undefined = body?.expectedUserId;
    if (!email) return json({ error: "E-mail é obrigatório." }, 400);

    // --- 3. Cria cliente Supabase com service role (contorna RLS) ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração ausente." }, 500);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // --- 4. Procura o usuário convidado pelo e-mail ---
    const { data: inviteeIdRaw } = await serviceClient.rpc("find_user_id_by_email", {
      p_email: email.trim(),
    });
    const inviteeId: string | null = inviteeIdRaw ?? null;
    if (!inviteeId) {
      return json({ error: "Este e-mail ainda não tem conta no FitSync. Peça para a pessoa se cadastrar primeiro." }, 404);
    }
    // Impede autoconvite.
    if (inviteeId === inviterId) {
      return json({ error: "Você não pode convidar a si mesmo." }, 400);
    }
    // Validação extra: o e-mail deve pertencer ao usuário esperado.
    if (expectedUserId && expectedUserId !== inviteeId) {
      return json({ error: "Este e-mail não pertence à pessoa selecionada." }, 400);
    }

    // --- 5. Busca o nome do convidante para exibir na notificação ---
    const { data: inviterProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", inviterId)
      .maybeSingle();
    const inviterName = inviterProfile?.full_name || "Alguém";

    // Código do convite e e-mail normalizado.
    const code = genCode();
    const cleanEmail = email.trim().toLowerCase();

    // --- 6. Cria a notificação no banco para o convidado ---
    const { error: notifErr } = await serviceClient.from("notifications").insert({
      user_id: inviteeId,
      type: "invite",
      title: `${inviterName} te convidou para conversar`,
      body: `Use o código ${code} para confirmar e iniciar a conversa.`,
      code,
      invite_email: cleanEmail,
      inviter_id: inviterId,
      inviter_name: inviterName,
      read: false,
    });
    if (notifErr) {
      return json({ error: "Não foi possível enviar o convite." }, 500);
    }

    // --- 7. Sucesso ---
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
