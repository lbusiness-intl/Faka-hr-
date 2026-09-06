// paystack-webhook
//
// Handles Paystack's payment event webhook.
//
// SECURITY: unlike PayUnit, Paystack DOES support a proper signed webhook —
// every request includes an "x-paystack-signature" header, which is an
// HMAC-SHA512 of the raw request body using your secret key. This handler
// verifies that signature FIRST and rejects the request outright if it
// doesn't match (same fail-closed standard as stripe-webhook and
// paddle-webhook). On top of that, following this codebase's defense-in-
// depth convention, it still re-confirms the real transaction status
// directly from Paystack's verify endpoint server-to-server before
// activating anything — never trusting the webhook body's status field
// alone, signed or not.
//
// Required secret: PAYSTACK_SECRET_KEY (same key used for signing on
// Paystack's side and for the Authorization header here).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { CORS_HEADERS } from "../_shared/currency.ts";

const corsHeaders = CORS_HEADERS;

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secretKey) return json({ ok: false, error: "PAYSTACK_NOT_CONFIGURED" }, 503);

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  const expectedSignature = await hmacSha512Hex(secretKey, rawBody);
  if (!signature || signature !== expectedSignature) {
    return json({ ok: false, error: "INVALID_SIGNATURE" }, 400);
  }

  try {
    const body = JSON.parse(rawBody);
    const reference: string | undefined = body?.data?.reference;
    if (!reference) return json({ ok: false, error: "MISSING_REFERENCE" }, 400);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: txn } = await adminClient
      .from("paystack_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();
    if (!txn) return json({ ok: false, error: "UNKNOWN_TRANSACTION" }, 404);
    if (txn.status === "confirmed") return json({ ok: true, already_processed: true });

    // Authoritative check: verify directly with Paystack, server-to-server.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { "Authorization": `Bearer ${secretKey}` },
    });
    const verifyJson = await verifyRes.json();
    const realStatus: string | undefined = verifyJson?.data?.status;

    if (!verifyRes.ok || !realStatus) {
      return json({ ok: false, error: "STATUS_CHECK_FAILED", detail: verifyJson?.message }, 502);
    }

    if (realStatus !== "success") {
      const mapped = realStatus === "abandoned" ? "pending" : realStatus === "reversed" ? "cancelled" : "failed";
      await adminClient.from("paystack_transactions").update({ status: mapped }).eq("reference", reference);
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
      paystack_reference: reference,
      paid_at: new Date().toISOString(),
    });

    await adminClient.from("paystack_transactions").update({ status: "confirmed" }).eq("reference", reference);

    await adminClient.from("audit_logs").insert({
      tenant_id: txn.tenant_id,
      action: "paystack.checkout.completed",
      details: { plan: txn.plan, amount: txn.amount, currency: txn.currency, reference },
    });

    return json({ ok: true, status: "success" });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
