import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET not set — webhook signature verification will fail");
}

async function sendNotificationEmail(userId: string, emailType: string, userEmail: string, subject: string, htmlBody: string) {
  // Check if we already sent this type recently (dedup within 24h)
  const { data: existing } = await supabase
    .from("notification_emails")
    .select("id")
    .eq("user_id", userId)
    .eq("email_type", emailType)
    .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();

  if (existing) return;

  // Log the email
  await supabase.from("notification_emails").insert({
    user_id: userId,
    email_type: emailType,
  });

  // Send via Supabase auth admin invite/recovery or use a simple log
  // Since we don't have a dedicated email service, we use Supabase's built-in email
  // For now, we log it — the app can display in-app notifications too
  console.log(`[EMAIL] To: ${userEmail} | Subject: ${subject} | Type: ${emailType}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400, headers: corsHeaders });
  }

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
    switch (event.type) {
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

          // Update profile to professional
          await supabase.from("profiles").update({
            is_professional: true,
            updated_at: new Date().toISOString(),
          }).eq("id", userId);
        }
        break;
      }

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

          // If payment failed, send email notification
          if (wasPastDue) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", userId)
              .maybeSingle();

            // Get email from auth
            const { data: authUser } = await supabase.auth.admin.getUserById(userId);

            const email = authUser?.user?.email ?? "";
            if (email) {
              await sendNotificationEmail(
                userId,
                "payment_overdue",
                email,
                "Pagamento da assinatura FitSync PRO em atraso",
                `<p>Olá,</p><p>Detectamos um problema com o pagamento da sua assinatura FitSync PRO. Você tem <strong>5 dias</strong> para regularizar o pagamento antes que as funcionalidades profissionais sejam desativadas.</p><p>Acesse as configurações do app para atualizar seu método de pagamento.</p><p>Equipe FitSync</p>`
              );
            }
          }

          // If subscription is active again, clear lock
          if (subscription.status === "active" || subscription.status === "trialing") {
            await supabase.from("subscriptions").update({
              past_due_since: null,
              locked_at: null,
            }).eq("user_id", userId);
          }
        }
        break;
      }

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

          // Send cancellation email
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

    // Lock any expired subscriptions past grace period
    await supabase.rpc("lock_expired_subscriptions");

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
