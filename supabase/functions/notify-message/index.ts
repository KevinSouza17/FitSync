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
    const senderId = payload?.sub as string | undefined;
    if (!senderId) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({}));
    const conversationId: string | undefined = body?.conversationId;
    const content: string | undefined = body?.content;
    if (!conversationId || !content) {
      return json({ error: "conversationId e content são obrigatórios." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Configuração ausente." }, 500);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Resolve the conversation + the recipient.
    const { data: conv } = await serviceClient
      .from("conversations")
      .select("user_a_id, user_b_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return json({ error: "Conversa não encontrada." }, 404);

    const recipientId = conv.user_a_id === senderId ? conv.user_b_id : conv.user_a_id;
    if (recipientId === senderId) return json({ ok: true }); // shouldn't happen

    return json({ ok: true });
  } catch (err) {
    return json({ error: "Erro interno." }, 500);
  }
});
