// stripe-webhook
//
// Handles real Stripe webhook events. This function used to accept a raw
// JSON body with a self-declared "checkout.session.completed" type and a
// client-supplied tenant_id — meaning ANY authenticated user could call it
// directly from the browser and activate ANY tenant's subscription for
// free, with zero payment ever collected. That flow is gone.
//
// This version REQUIRES a valid Stripe-Signature header, verified against
// STRIPE_WEBHOOK_SECRET using Stripe's own signature verification. Only
// Stripe's servers know the signing secret, so a browser (or anyone else)
// can never forge a valid request here — the previous "simulate checkout"
// button in the app has been removed accordingly.
//
// Required Supabase Edge Function secret:
//   STRIPE_WEBHOOK_SECRET   whsec_...  (from the Stripe Dashboard webhook config)
//   STRIPE_SECRET_KEY       sk_live_... or sk_test_...
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecretKey || !webhookSecret) {
    // Fail closed: never accept an unverifiable event.
    return json({ ok: false, error: "WEBHOOK_NOT_CONFIGURED" }, 503);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-11-20.acacia" });
  const signature = req.headers.get("Stripe-Signature");
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing Stripe-Signature header");
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    // Signature verification failed — this request did not genuinely come
    // from Stripe. Reject it outright.
    return json({ ok: false, error: "INVALID_SIGNATURE", detail: err instanceof Error ? err.message : String(err) }, 400);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id || session.client_reference_id;
        const plan = session.metadata?.plan;
        if (!tenantId || !plan) break;

        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + (session.metadata?.interval === "yearly" ? 12 : 1));

        await supabase.from("tenants").update({
          status: "active",
          plan,
          current_period_end: periodEnd.toISOString(),
          stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
        }).eq("id", tenantId);

        await supabase.from("invoices").insert({
          tenant_id: tenantId,
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "usd").toUpperCase(),
          plan,
          status: "paid",
          stripe_session_id: session.id,
          paid_at: new Date().toISOString(),
        });

        await supabase.from("audit_logs").insert({
          tenant_id: tenantId,
          action: "stripe.checkout.completed",
          details: { plan, amount_total: session.amount_total, currency: session.currency, session_id: session.id },
        });
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenant_id;
        if (!tenantId) break;
        const newStatus = sub.status === "active" || sub.status === "trialing" ? "active"
          : sub.status === "canceled" || sub.status === "unpaid" ? "suspended"
          : undefined;
        if (newStatus) {
          await supabase.from("tenants").update({ status: newStatus }).eq("id", tenantId);
          await supabase.from("audit_logs").insert({
            tenant_id: tenantId,
            action: `stripe.subscription.${event.type === "customer.subscription.deleted" ? "deleted" : "updated"}`,
            details: { stripe_status: sub.status },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const tenantId = invoice.subscription_details?.metadata?.tenant_id;
        if (tenantId) {
          await supabase.from("audit_logs").insert({
            tenant_id: tenantId,
            action: "stripe.invoice.payment_failed",
            details: { invoice_id: invoice.id },
          });
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged (2xx) so Stripe doesn't
        // keep retrying, but no action is taken.
        break;
    }

    return json({ ok: true, received: true, type: event.type });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
