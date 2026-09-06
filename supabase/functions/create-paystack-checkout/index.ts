// create-paystack-checkout
//
// Creates a REAL Paystack transaction and returns the hosted checkout
// (authorization) URL. Paystack is a payment aggregator widely used across
// Nigeria, Ghana, and other African markets (cards, bank transfer, USSD).
//
// Built against Paystack's official REST API:
//   https://paystack.com/docs/payments/accept-payments/
//
// Required Supabase Edge Function secrets (fails closed with
// PAYSTACK_NOT_CONFIGURED instead of pretending to work until set):
//   PAYSTACK_SECRET_KEY   from the Paystack Dashboard > Settings > API Keys & Webhooks
//   APP_URL                e.g. https://app.faka-hr.com (for the callback URL)
//
// Same currency-conversion rule as every other PSP integration in this
// codebase: plans are priced in USD (src/lib/plans.ts); converted to the
// tenant's currency using a live exchange rate. Paystack amounts are in
// the currency's SMALLEST unit (e.g. kobo for NGN, cents for GHS/USD) —
// this multiplies by 100 accordingly, a real and easy mistake to get wrong.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { convertFromUsd, CORS_HEADERS, PLAN_PRICES_USD } from "../_shared/currency.ts";

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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return json({ ok: false, error: "UNAUTHENTICATED" }, 401);

    const body = await req.json().catch(() => ({}));
    const { tenantId, plan, interval } = body ?? {};
    if (!tenantId || !plan) return json({ ok: false, error: "MISSING_PARAMS" }, 400);
    if (!PLAN_PRICES_USD[plan]) return json({ ok: false, error: "INVALID_PLAN" }, 400);
    const billingInterval = interval === "yearly" ? "yearly" : "monthly";
    const usdAmount = PLAN_PRICES_USD[plan][billingInterval as "monthly" | "yearly"];

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const isSuperAdmin = user.app_metadata?.role === "super_admin";
    if (!isSuperAdmin) {
      const { data: membership } = await adminClient
        .from("tenant_memberships")
        .select("role, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      const allowed = membership && ["admin", "finance"].includes(membership.role);
      if (!allowed) return json({ ok: false, error: "FORBIDDEN" }, 403);
    }

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const appUrl = Deno.env.get("APP_URL") ?? "https://faka-hr.com";
    if (!secretKey) {
      return json({
        ok: false,
        error: "PAYSTACK_NOT_CONFIGURED",
        detail: "Paystack is not configured yet. Set PAYSTACK_SECRET_KEY as a secret on this project before Paystack checkout can be used.",
      }, 503);
    }

    const { data: tenant } = await adminClient.from("tenants").select("id, name, currency").eq("id", tenantId).maybeSingle();
    if (!tenant) return json({ ok: false, error: "TENANT_NOT_FOUND" }, 404);

    const targetCurrency = tenant.currency || "NGN";
    let localAmount: number;
    try {
      localAmount = await convertFromUsd(usdAmount, targetCurrency);
    } catch (err) {
      return json({ ok: false, error: "CURRENCY_CONVERSION_FAILED", detail: err instanceof Error ? err.message : String(err) }, 502);
    }

    const reference = `FAKA-PSK-${tenantId.replace(/-/g, "").slice(0, 12)}-${Date.now()}`;

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        email: user.email,
        // Paystack expects the smallest currency unit (kobo/cents), never
        // the major unit — multiplying by anything else here would charge
        // 100x too little or too much.
        amount: Math.round(localAmount * 100),
        currency: targetCurrency,
        reference,
        callback_url: `${appUrl}/dashboard/subscription?checkout=return`,
      }),
    });
    const initJson = await initRes.json();
    if (!initRes.ok || !initJson.status) {
      return json({ ok: false, error: "PAYSTACK_INIT_FAILED", detail: initJson.message ?? `HTTP ${initRes.status}` }, 502);
    }
    const redirectUrl: string | undefined = initJson.data?.authorization_url;
    if (!redirectUrl) return json({ ok: false, error: "PAYSTACK_INIT_FAILED", detail: "No authorization_url returned by Paystack." }, 502);

    await adminClient.from("paystack_transactions").insert({
      tenant_id: tenantId,
      reference,
      plan,
      interval: billingInterval,
      amount: localAmount,
      amount_usd: usdAmount,
      currency: targetCurrency,
      status: "pending",
      created_by: user.id,
    });

    return json({ ok: true, url: redirectUrl, reference });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
