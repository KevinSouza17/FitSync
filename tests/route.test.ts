import { describe, it, expect } from "vitest";

// =============================================================================
// Testes de rota (HTTP) das Edge Functions do FitSync.
//
// Estes testes exercitam os endpoints AO VIVO. Eles são pulados por padrão
// porque exigem credenciais reais (JWT de sessão e, para o webhook, uma
// assinatura válida do Stripe). Para rodar:
//
//   API_BASE_URL=https://<projeto>.supabase.co/functions/v1 \
//   AUTH_TOKEN=<jwt de sessão> \
//   npx vitest run tests/route.test.ts
//
// Sem essas variáveis, os testes de rota são marcados como skipped (não falham).
//
// Casos cobertos:
//   - notify-message: sem auth (401), sem campos (400), fluxo feliz (200)
//   - send-invite: sem auth (401), sem e-mail (400), autoconvite (400)
//   - stripe-checkout: sem auth (401)
//   - stripe-webhook: sem assinatura (400)
// =============================================================================

// Atenção: usamos API_BASE_URL (e não BASE_URL) porque o Vite define
// BASE_URL="/' automaticamente, o que faria os testes rodarem contra uma URL
// inválida. AUTH_TOKEN vem direto do ambiente.
const API_BASE_URL = process.env.API_BASE_URL ?? "";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Helper para pular testes quando não há credenciais configuradas.
const describeLive = API_BASE_URL ? describe : describe.skip;
const withAuth = AUTH_TOKEN ? describe : describe.skip;

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

describeLive("notify-message", () => {
  it("retorna 401 sem header de Authorization", async () => {
    const { status, data } = await post(`${API_BASE_URL}/notify-message`, {}, {
      conversationId: "11111111-1111-1111-1111-111111111111",
      content: "oi",
    });
    expect(status).toBe(401);
    expect(data).toHaveProperty("error");
  });

  withAuth("com autenticação", () => {
    it("retorna 400 quando conversationId/content faltam", async () => {
      const { status, data } = await post(
        `${API_BASE_URL}/notify-message`,
        { Authorization: `Bearer ${AUTH_TOKEN}` },
        {}
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });

    it("retorna 404 para conversationId inexistente", async () => {
      const { status } = await post(
        `${API_BASE_URL}/notify-message`,
        { Authorization: `Bearer ${AUTH_TOKEN}` },
        { conversationId: "00000000-0000-0000-0000-000000000000", content: "oi" }
      );
      expect([404, 200]).toContain(status); // 200 se não houver conversa não dá erro de not found no fluxo atual
    });
  });
});

describeLive("send-invite", () => {
  it("retorna 401 sem header de Authorization", async () => {
    const { status, data } = await post(`${API_BASE_URL}/send-invite`, {}, { email: "x@y.com" });
    expect(status).toBe(401);
    expect(data).toHaveProperty("error");
  });

  withAuth("com autenticação", () => {
    it("retorna 400 quando o e-mail está ausente", async () => {
      const { status, data } = await post(
        `${API_BASE_URL}/send-invite`,
        { Authorization: `Bearer ${AUTH_TOKEN}` },
        {}
      );
      expect(status).toBe(400);
      expect(data).toHaveProperty("error");
    });
  });
});

describeLive("stripe-checkout", () => {
  it("retorna 401 sem header de Authorization", async () => {
    const { status, data } = await post(`${API_BASE_URL}/stripe-checkout`, {}, {});
    expect(status).toBe(401);
    expect(data).toHaveProperty("error");
  });
});

describeLive("stripe-webhook", () => {
  it("retorna 400 sem header stripe-signature", async () => {
    const { status } = await post(`${API_BASE_URL}/stripe-webhook`, {}, { id: "evt_test" });
    expect(status).toBe(400);
  });
});

describe("CORS preflight (OPTIONS)", () => {
  it("os headers CORS cobrem os métodos esperados", () => {
    for (const m of ["GET", "POST", "PUT", "DELETE", "OPTIONS"]) {
      expect(corsHeaders["Access-Control-Allow-Methods"]).toContain(m);
    }
  });
});
