// flutterwave-webhook
//
// Handles Flutterwave's payment notification callback.
//
// SECURITY: Flutterwave webhooks include a "verif-hash" header that should
// match a secret hash configured in the Flutterwave dashboard
// (FLUTTERWAVE_SECRET_HASH). That check is done first as a quick filter,
// but — following this codebase's established pattern (see payunit-webhook)
// — the inbound body's status is NEVER trusted on its own even when the
// hash matches: this handler always re-confirms the real status directly
// from Flutterwave via their verify-by-reference endpoint, server-to-server,
// authenticated with our own secret key. Only that authenticated response
// can activate a subscription.
//
// Required secrets: FLUTTERWAVE_SECRET_KEY (same as create-flutterwave-checkout),
// FLUTTERWAVE_SECRET_HASH (optional but recommended — set in the Flutterwave
// dashboard's webhook configuration).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { CORS_HEADERS } from "../_shared/currency.ts";

const corsHeaders = CORS_HEADERS;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const secretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
  if (!secretKey) return json({ ok: false, error: "FLUTTERWAVE_NOT_CONFIGURED" }, 503);

  const configuredHash = Deno.env.get("FLUTTERWAVE_SECRET_HASH");
  if (configuredHash) {
    const receivedHash = req.headers.get("verif-hash");
    if (receivedHash !== configuredHash) {
      return json({ ok: false, error: "INVALID_SIGNATURE" }, 400);
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const txRef: string | undefined = body?.data?.tx_ref ?? body?.txRef;
    if (!txRef) return json({ ok: false, error: "MISSING_TX_REF" }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: txn } = await adminClient
      .from("flutterwave_transactions")
      .select("*")
      .eq("tx_ref", txRef)
      .maybeSingle();
    if (!txn) return json({ ok: false, error: "UNKNOWN_TRANSACTION" }, 404);
    if (txn.status === "confirmed") return json({ ok: true, already_processed: true });

    // Authoritative check: verify BY REFERENCE directly with Flutterwave,
    // server-to-server — never trust the webhook body's own status field.
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      { headers: { "Authorization": `Bearer ${secretKey}` } },
    );
    const verifyJson = await verifyRes.json();
    const realStatus: string | undefined = verifyJson?.data?.status;

    if (!verifyRes.ok || !realStatus) {
      return json({ ok: false, error: "STATUS_CHECK_FAILED", detail: verifyJson?.message }, 502);
    }

    if (realStatus !== "successful") {
      // Map defensively to the column's CHECK constraint (pending/confirmed/
      // failed/cancelled) — never pass Flutterwave's raw string straight
      // through, in case it ever returns a value outside what we expect.
      const mapped = realStatus === "cancelled" ? "cancelled" : realStatus === "pending" ? "pending" : "failed";
      await adminClient.from("flutterwave_transactions").update({ status: mapped }).eq("tx_ref", txRef);
      return json({ ok: true, status: realStatus });
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (txn.interval === "yearly" ? 12 : 1));

    await adminClient.from("tenants").update({
      status: "active",
      plan: txn.plan,
      current_period_end: periodEnd.toISOString(),
    }).eq("id", txn.tenant_id);

    await adminClient.from("invoices").insert({
      tenant_id: txn.tenant_id,
      amount: txn.amount,
      amount_usd: txn.amount_usd,
      currency: txn.currency,
      plan: txn.plan,
      status: "paid",
      flutterwave_tx_ref: txRef,
      paid_at: new Date().toISOString(),
    });

    await adminClient.from("flutterwave_transactions").update({ status: "confirmed" }).eq("tx_ref", txRef);

    await adminClient.from("audit_logs").insert({
      tenant_id: txn.tenant_id,
      action: "flutterwave.checkout.completed",
      details: { plan: txn.plan, amount: txn.amount, currency: txn.currency, tx_ref: txRef },
    });

    return json({ ok: true, status: "successful" });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
