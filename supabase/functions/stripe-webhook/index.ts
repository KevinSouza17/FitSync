// =============================================================================
// Edge Function: stripe-webhook
// -----------------------------------------------------------------------------
// Objetivo: receber eventos do Stripe e atualizar o estado das assinaturas
// no banco. NÃO usa JWT — a autenticação é feita pelo Stripe via assinatura
// no header "stripe-signature".
//
// Rota:  POST {base_url}/stripe-webhook
// Auth:  Header "stripe-signature: <assinatura>" (validado pelo Stripe SDK)
//
// Eventos tratados:
//   - checkout.session.completed       -> ativa assinatura e marca profissional
//   - customer.subscription.updated    -> atualiza status/preço; notifica atraso
//   - customer.subscription.deleted    -> marca cancelamento; notifica
//   - invoice.payment_failed           -> marca atraso; notifica
//   - invoice.payment_succeeded        -> atualiza status; remove bloqueios
//
// Respostas:
//   200 { received: true }                 -> evento processado
//   400 "Missing signature" / "...failed"  -> assinatura ausente/inválida
//   500 { error: "<mensagem>" }            -> erro interno
// =============================================================================

import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Headers CORS obrigatórios.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Cliente Stripe com a chave secreta.
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Cliente Supabase com service role (contorna RLS).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// Segredo do webhook para validar a assinatura do evento.
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET not set — webhook signature verification will fail");
}

// ---------------------------------------------------------------------------
// Envia (ou registra) uma notificação por e-mail com desduplicação de 24h.
// Evita spammar o usuário com vários e-mails do mesmo tipo no mesmo dia.
// ---------------------------------------------------------------------------
async function sendNotificationEmail(userId: string, emailType: string, userEmail: string, subject: string) {
  // Verifica se já enviamos esse tipo nas últimas 24h.
  const { data: existing } = await supabase
    .from("notification_emails")
    .select("id")
    .eq("user_id", userId)
    .eq("email_type", emailType)
    .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existing) return; // já enviado recentemente, aborta.

  // Registra o envio no banco.
  await supabase.from("notification_emails").insert({
    user_id: userId,
    email_type: emailType,
  });

  // Como não há um serviço de e-mail dedicado, registramos no log.
  // O app também pode exibir notificações in-app complementares.
  console.log(`[EMAIL] To: ${userEmail} | Subject: ${subject} | Type: ${emailType}`);
}

Deno.serve(async (req) => {
  // Pré-voo CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // --- 1. Valida a assinatura do evento (origem = Stripe) ---
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400, headers: corsHeaders });
  }

  // O corpo precisa ser lido como texto bruto para verificação da assinatura.
  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    // --- 2. Trata cada tipo de evento ---
    switch (event.type) {
      // Checkout concluído: ativa a assinatura e marca o usuário como profissional.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const userId = subscription.metadata?.supabase_uid;

        if (userId) {
          await supabase.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            past_due_since: null,
            locked_at: null,
          }, { onConflict: "user_id" });

          // Promove o perfil para profissional.
          await supabase.from("profiles").update({
            is_professional: true,
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
        }
        break;
      }

      // Assinatura atualizada: sincroniza status e notifica se ficou em atraso.
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_uid;

        if (userId) {
          const wasPastDue = subscription.status === "past_due" || subscription.status === "unpaid";

          await supabase.from("subscriptions").update({
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            past_due_since: wasPastDue ? new Date().toISOString() : null,
            locked_at: null,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);

          // Se o pagamento falhou, notifica o usuário por e-mail.
          if (wasPastDue) {
            const { data: authUser } = await supabase.auth.admin.getUserById(userId);

            const email = authUser?.user?.email ?? "";
            if (email) {
              await sendNotificationEmail(
                userId,
                "payment_overdue",
                email,
                "Pagamento da assinatura FitSync PRO em atraso",
              );
            }
          }

          // Se voltou a ficar ativa/trialing, remove bloqueios.
          if (subscription.status === "active" || subscription.status === "trialing") {
            await supabase.from("subscriptions").update({
              past_due_since: null,
              locked_at: null,
            }).eq("user_id", userId);
          }
        }
        break;
      }

      // Assinatura cancelada: marca cancelamento e notifica.
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_uid;

        if (userId) {
          await supabase.from("subscriptions").update({
            status: "canceled",
            cancel_at_period_end: false,
            past_due_since: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);

          const { data: authUser } = await supabase.auth.admin.getUserById(userId);
          const email = authUser?.user?.email ?? "";
          if (email) {
            await sendNotificationEmail(
              userId,
              "subscription_canceled",
              email,
              "Assinatura FitSync PRO cancelada",
              `<p>Olá,</p><p>Sua assinatura FitSync PRO foi cancelada. Você ainda tem acesso às funcionalidades profissionais por <strong>5 dias</strong> a partir de hoje.</p><p>Após esse período, as funcionalidades profissionais serão desativadas. Você pode reativar sua assinatura a qualquer momento nas configurações do app.</p><p>Equipe FitSync</p>`
            );
          }
        }
        break;
      }

      // Falha no pagamento: marca atraso e notifica.
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = subscription.metadata?.supabase_uid;
          if (userId) {
            await supabase.from("subscriptions").update({
              past_due_since: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId);

            const { data: authUser } = await supabase.auth.admin.getUserById(userId);
            const email = authUser?.user?.email ?? "";
            if (email) {
              await sendNotificationEmail(
                userId,
                "payment_failed",
                email,
                "Falha no pagamento da assinatura FitSync PRO",
                `<p>Olá,</p><p>O pagamento da sua assinatura FitSync PRO falhou. Você tem <strong>5 dias</strong> para regularizar o pagamento antes que as funcionalidades profissionais sejam desativadas.</p><p>Acesse as configurações do app para atualizar seu método de pagamento.</p><p>Equipe FitSync</p>`
              );
            }
          }
        }
        break;
      }

      // Pagamento bem-sucedido: atualiza status e remove bloqueios.
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = subscription.metadata?.supabase_uid;
          if (userId) {
            await supabase.from("subscriptions").update({
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              past_due_since: null,
              locked_at: null,
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId);
          }
        }
        break;
      }

      default:
        break;
    }

    // --- 3. Bloqueia assinaturas expiradas após período de carência ---
    await supabase.rpc("lock_expired_subscriptions");

    // --- 4. Confirma recebimento ---
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
