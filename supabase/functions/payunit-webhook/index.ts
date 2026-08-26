// payunit-webhook (notify_url)
//
// Handles PayUnit's payment notification callback.
//
// IMPORTANT SECURITY NOTE: unlike Stripe, PayUnit's documented API does not
// provide a signed-webhook mechanism (no equivalent of Stripe-Signature /
// a webhook signing secret) — see https://developer.payunit.net. That means
// we can never fully trust the body of an inbound POST to this URL on its
// own: anyone who learns this endpoint's URL could POST a fake "SUCCESS"
// payload claiming to be PayUnit, which is exactly the class of exploit
// already fixed once this session for the old fake Stripe flow.
//
// To stay safe without a signature scheme, this handler treats the inbound
// notification ONLY as a hint to re-check a transaction — it never trusts
// the notification body's status field directly. Instead, it:
//   1. Extracts the transaction_id from the payload.
//   2. Looks up that transaction_id in OUR OWN `payunit_transactions` table
//      (created by create-payunit-checkout when the checkout began — an
//      unrecognized transaction_id is rejected outright).
//   3. Calls PayUnit's GET status endpoint SERVER-TO-SERVER, authenticated
//      with our own API credentials, to get the real, current status
//      directly from PayUnit — the only source of truth trusted here.
//   4. Only activates the tenant's subscription based on that authenticated
//      response, never based on the original POST body.
//
// Required secrets: PAYUNIT_API_USER, PAYUNIT_API_PASSWORD, PAYUNIT_APP_TOKEN,
// PAYUNIT_MODE (same as create-payunit-checkout).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PAYUNIT_BASE_URL = "https://gateway.payunit.net";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const apiUser = Deno.env.get("PAYUNIT_API_USER");
  const apiPassword = Deno.env.get("PAYUNIT_API_PASSWORD");
  const appToken = Deno.env.get("PAYUNIT_APP_TOKEN");
  const mode = Deno.env.get("PAYUNIT_MODE") ?? "test";
  if (!apiUser || !apiPassword || !appToken) {
    return json({ ok: false, error: "PAYUNIT_NOT_CONFIGURED" }, 503);
  }

  try {
    const body = await req.json().catch(() => ({}));
    // PayUnit's notify payload shape isn't guaranteed here — pull the
    // transaction_id defensively from a couple of plausible locations,
    // but nothing else from this body is trusted.
    const transactionId: string | undefined =
      body?.transaction_id ?? body?.data?.transaction_id ?? body?.transaction?.transaction_id;
    const checkoutId: string | undefined = body?.checkout_id ?? body?.data?.checkout_id;

    if (!transactionId) {
      return json({ ok: false, error: "MISSING_TRANSACTION_ID" }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Reject anything that doesn't correspond to a transaction WE created.
    const { data: txn } = await adminClient
      .from("payunit_transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (!txn) {
      return json({ ok: false, error: "UNKNOWN_TRANSACTION" }, 404);
    }
    if (txn.status === "confirmed") {
      return json({ ok: true, already_processed: true }); // idempotent
    }

    // Confirm the REAL status directly from PayUnit — server-to-server,
    // authenticated with our own credentials. This is the only status
    // value this function ever acts on.
    const lookupId = checkoutId ?? transactionId;
    const statusRes = await fetch(`${PAYUNIT_BASE_URL}/api/gateway/checkout/status/${lookupId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${apiUser}:${apiPassword}`)}`,
        "x-api-key": appToken,
        "mode": mode,
      },
    });
    const statusJson = await statusRes.json();
    const realStatus: string | undefined = statusJson?.data?.status ?? statusJson?.data?.transaction?.status;

    if (!statusRes.ok || !realStatus) {
      return json({ ok: false, error: "STATUS_CHECK_FAILED", detail: statusJson?.message }, 502);
    }

    if (realStatus !== "SUCCESS") {
      // Not actually paid yet (still PENDING) or failed/cancelled — record
      // the real status but do not activate anything.
      await adminClient.from("payunit_transactions").update({ status: realStatus.toLowerCase() }).eq("transaction_id", transactionId);
      return json({ ok: true, status: realStatus });
    }

    // Genuinely confirmed by PayUnit itself — now, and only now, activate.
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
      currency: txn.currency,
      plan: txn.plan,
      status: "paid",
      payunit_transaction_id: transactionId,
      paid_at: new Date().toISOString(),
    });

    await adminClient.from("payunit_transactions").update({ status: "confirmed" }).eq("transaction_id", transactionId);

    await adminClient.from("audit_logs").insert({
      tenant_id: txn.tenant_id,
      action: "payunit.checkout.completed",
      details: { plan: txn.plan, amount: txn.amount, currency: txn.currency, transaction_id: transactionId },
    });

    return json({ ok: true, status: "SUCCESS" });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
