// paddle-webhook
//
// Handles real Paddle Billing webhook events. Mirrors stripe-webhook's
// security model exactly: this REQUIRES a valid Paddle-Signature header,
// verified against PADDLE_WEBHOOK_SECRET using Paddle's own SDK. Only
// Paddle's servers know that signing secret, so a browser (or anyone
// else) can never forge a valid request here. If the secret isn't
// configured, the function fails closed (503) rather than trusting an
// unverifiable event — same rule as every other webhook in this codebase.
//
// Required Supabase Edge Function secrets:
//   PADDLE_API_KEY          (server-side API key, from Paddle Dashboard > Developer Tools > Authentication)
//   PADDLE_WEBHOOK_SECRET   ntfset_...  (from Paddle Dashboard > Developer Tools > Notifications, the specific webhook destination's secret key)
//
// These are NOT the client-side token used in the frontend (VITE_PADDLE_CLIENT_TOKEN)
// — that one is safe to be public; these two must never leave the server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { Paddle, Environment, EventName } from "npm:@paddle/paddle-node-sdk@2.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Paddle-Signature",
};

// Our internal plan ids (starter/pro/premium/enterprise) are looked up by
// the Paddle Price ID that was actually purchased, via these env vars —
// the reverse of paddlePriceIdForPlan() on the client. Keeps the mapping
// in one place per side rather than hardcoding price IDs here.
function planForPaddlePriceId(priceId: string): string | null {
  const map: Record<string, string | undefined> = {
    [Deno.env.get("VITE_PADDLE_PRICE_STARTER") ?? ""]: "starter",
    [Deno.env.get("VITE_PADDLE_PRICE_PRO") ?? ""]: "pro",
    [Deno.env.get("VITE_PADDLE_PRICE_PREMIUM") ?? ""]: "premium",
    [Deno.env.get("VITE_PADDLE_PRICE_ENTERPRISE") ?? ""]: "enterprise",
  };
  return map[priceId] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const apiKey = Deno.env.get("PADDLE_API_KEY");
  const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  if (!apiKey || !webhookSecret) {
    // Fail closed: never accept an unverifiable event.
    return json({ ok: false, error: "WEBHOOK_NOT_CONFIGURED" }, 503);
  }

  const paddle = new Paddle(apiKey, { environment: Environment.production });
  const signature = req.headers.get("Paddle-Signature");
  const rawBody = await req.text();

  let event;
  try {
    if (!signature) throw new Error("Missing Paddle-Signature header");
    event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
  } catch (err) {
    // Signature verification failed — this request did not genuinely
    // come from Paddle. Reject it outright.
    return json({ ok: false, error: "INVALID_SIGNATURE", detail: err instanceof Error ? err.message : String(err) }, 400);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (event.eventType) {
      case EventName.TransactionCompleted: {
        const tx = event.data;
        const tenantId = tx.customData?.tenant_id as string | undefined;
        const priceId = tx.items?.[0]?.price?.id;
        const plan = priceId ? planForPaddlePriceId(priceId) : null;
        if (!tenantId || !plan) break;

        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await supabase.from("tenants").update({
          status: "active",
          plan,
          current_period_end: periodEnd.toISOString(),
          paddle_customer_id: tx.customerId ?? undefined,
          paddle_subscription_id: tx.subscriptionId ?? undefined,
        }).eq("id", tenantId);

        await supabase.from("invoices").insert({
          tenant_id: tenantId,
          amount: Number(tx.details?.totals?.total ?? 0) / 100,
          currency: tx.currencyCode ?? "USD",
          plan,
          status: "paid",
          paddle_transaction_id: tx.id,
          paid_at: new Date().toISOString(),
        });

        await supabase.from("audit_logs").insert({
          tenant_id: tenantId,
          action: "paddle.transaction.completed",
          details: { plan, transaction_id: tx.id },
        });
        break;
      }

      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionPastDue: {
        const sub = event.data;
        const tenantId = sub.customData?.tenant_id as string | undefined;
        if (!tenantId) break;
        await supabase.from("tenants").update({ status: "suspended" }).eq("id", tenantId);
        await supabase.from("audit_logs").insert({
          tenant_id: tenantId,
          action: `paddle.subscription.${event.eventType}`,
          details: { paddle_subscription_id: sub.id },
        });
        break;
      }

      default:
        // Unhandled event types are acknowledged (2xx) so Paddle doesn't
        // keep retrying, but no action is taken.
        break;
    }

    return json({ ok: true, received: true, type: event.eventType });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
