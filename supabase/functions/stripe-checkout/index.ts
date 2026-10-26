// =============================================================================
// Edge Function: stripe-checkout
// -----------------------------------------------------------------------------
// Objetivo: criar uma sessão de checkout do Stripe para a assinatura PRO
// mensal (R$ 25/mês, 7 dias de teste grátis) e retornar a URL de checkout.
//
// Rota:  POST {base_url}/stripe-checkout
// Auth:  Header "Authorization: Bearer <JWT>"
//
// Body: vazio (o usuário é identificado pelo JWT).
//
// Respostas:
//   200 { url: "https://checkout.stripe.com/..." }  -> URL para redirecionar
//   401 { error: "Unauthorized" }                  -> sem token / inválido
//   500 { error: "<mensagem>" }                    -> erro interno
// =============================================================================

import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Headers CORS obrigatórios.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Cliente Stripe configurado com a chave secreta (env) e fetch HTTP do Deno.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Cliente Supabase com service role (contorna RLS para gravar assinaturas).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Produto pré-cadastrado no Stripe e parâmetros de preço/período de teste.
const PRODUCT_ID = Deno.env.get("STRIPE_PRODUCT_ID") ?? "prod_VBdzApsh34hvDI";
const TRIAL_DAYS = 7;
const MONTHLY_AMOUNT_BRL = 2500; // R$ 25,00 em centavos

Deno.serve(async (req) => {
  // Pré-voo CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // --- 1. Autenticação: valida o JWT via Supabase Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 2. Verifica se já existe assinatura (para reutilizar o cliente) ---
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;

    // --- 3. Cria (ou reutiliza) o cliente no Stripe ---
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_uid: user.id },
      });
      customerId = customer.id;
    }

    // --- 4. Cria a sessão de checkout (assinatura mensal com teste) ---
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: "brl",
          product: PRODUCT_ID,
          unit_amount: MONTHLY_AMOUNT_BRL,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { supabase_uid: user.id },
      },
      success_url: `${req.headers.get("origin")}/settings?checkout=success`,
      cancel_url: `${req.headers.get("origin")}/settings?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    // --- 5. Registra/atualiza a assinatura no banco ---
    await supabase.from("subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      status: session.status ?? "incomplete",
      stripe_price_id: null,
    }, { onConflict: "user_id" });

    // --- 6. Retorna a URL de checkout para o app redirecionar ---
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
