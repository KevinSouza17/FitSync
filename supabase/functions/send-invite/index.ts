import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function genCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10).toString();
  return c;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado." }, 401);
    }
    const jwt = authHeader.slice("Bearer ".length).trim();
    const payload = decodeJwtPayload(jwt);
    const inviterId = payload?.sub as string | undefined;
    if (!inviterId) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({}));
    const email: string | undefined = body?.email;
    const expectedUserId: string | undefined = body?.expectedUserId;
    if (!email) return json({ error: "E-mail é obrigatório." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração ausente." }, 500);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Resolve invitee by email.
    const { data: inviteeIdRaw } = await serviceClient.rpc("find_user_id_by_email", {
      p_email: email.trim(),
    });
    const inviteeId: string | null = inviteeIdRaw ?? null;
    if (!inviteeId) {
      return json({ error: "Este e-mail ainda não tem conta no FitSync. Peça para a pessoa se cadastrar primeiro." }, 404);
    }
    if (inviteeId === inviterId) {
      return json({ error: "Você não pode convidar a si mesmo." }, 400);
    }
    if (expectedUserId && expectedUserId !== inviteeId) {
      return json({ error: "Este e-mail não pertence à pessoa selecionada." }, 400);
    }

    // Inviter display name.
    const { data: inviterProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", inviterId)
      .maybeSingle();
    const inviterName = inviterProfile?.full_name || "Alguém";

    const code = genCode();
    const cleanEmail = email.trim().toLowerCase();

    // Primary channel: in-app notification carrying the code.
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

    return json({ ok: true });
  } catch (err) {
    return json({ error: "Erro interno. Tente novamente." }, 500);
  }
});
