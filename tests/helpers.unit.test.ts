import { describe, it, expect } from "vitest";

// =============================================================================
// Testes unitários das funções puras reutilizadas pelas Edge Functions.
//
// Estas funções (CORS, resposta JSON, decodificação de JWT, gerador de código)
// são lógica pura que não depende de rede nem de secrets, então podem ser
// testadas diretamente com o vitest.
//
// As Edge Functions em si rodam em Deno na Supabase; os testes de rota que
// exercitam os endpoints ao vivo estão em route.test.ts.
// =============================================================================

// --- Espelha a helper de resposta JSON usada nas Edge Functions ---
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

// --- Espelha o decodificador de payload de JWT ---
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

// --- Espelha o gerador de código de convite (6 dígitos) ---
function genCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10).toString();
  return c;
}

// Cria um JWT fake (não verificado) para testar o decodificador.
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  const sig = "fake-signature";
  return `${header}.${body}.${sig}`;
}

describe("helper json()", () => {
  it("monta uma Response JSON com status 200 por padrão", async () => {
    const res = json({ ok: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("respeita um status customizado (ex.: 400)", async () => {
    const res = json({ error: "faltando" }, 400);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "faltando" });
  });

  it("sempre inclui os headers CORS", () => {
    const res = json({});
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("helper decodeJwtPayload()", () => {
  it("extrai o payload (sub) de um JWT válido em formato", () => {
    const token = makeFakeJwt({ sub: "user-123", role: "authenticated" });
    const payload = decodeJwtPayload(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-123");
    expect(payload?.role).toBe("authenticated");
  });

  it("retorna null para um token mal formado", () => {
    expect(decodeJwtPayload("nao-e-um-jwt")).toBeNull();
    expect(decodeJwtPayload("a.b")).toBeNull();
  });

  it("retorna null para entrada vazia", () => {
    expect(decodeJwtPayload("")).toBeNull();
  });
});

describe("helper genCode()", () => {
  it("gera um código de exatamente 6 dígitos", () => {
    const code = genCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("gera códigos distintos em chamadas sucessivas (probabilidade)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) codes.add(genCode());
    // Extremamente improvável que 50 chamadas sejam todas iguais.
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("CORS headers", () => {
  it("permite todos os métodos usados pela API", () => {
    const methods = corsHeaders["Access-Control-Allow-Methods"];
    for (const m of ["GET", "POST", "PUT", "DELETE", "OPTIONS"]) {
      expect(methods).toContain(m);
    }
  });

  it("permite os headers necessários para o Supabase", () => {
    const headers = corsHeaders["Access-Control-Allow-Headers"];
    for (const h of ["Content-Type", "Authorization", "X-Client-Info", "Apikey"]) {
      expect(headers).toContain(h);
    }
  });
});
