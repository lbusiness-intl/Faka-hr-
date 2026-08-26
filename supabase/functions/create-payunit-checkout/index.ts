// create-payunit-checkout
//
// Creates a REAL PayUnit checkout session (Mobile Money / Orange Money / cards
// via PayUnit's payment aggregator, popular across Central/West Africa) and
// returns the hosted payment link for the browser to redirect to.
//
// Required Supabase Edge Function secrets (set these before PayUnit checkout
// works — until then this function fails closed with PAYUNIT_NOT_CONFIGURED
// instead of pretending to work):
//   PAYUNIT_API_USER       from the merchant dashboard, API CREDENTIALS tab
//   PAYUNIT_API_PASSWORD   from the merchant dashboard, API CREDENTIALS tab
//   PAYUNIT_APP_TOKEN      your application's live or sandbox key
//                          (APPLICATION DETAIL tab)
//   PAYUNIT_MODE           "live" or "test"
//   APP_URL                e.g. https://app.faka-hr.com (for redirect URLs)
//
// See https://developer.payunit.net/checkout/initialize-payment
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    const billingInterval = interval === "yearly" ? "yearly" : "monthly";

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Only an admin-like member of THIS tenant (or a real super admin) may
    // start a checkout for it — never trust the tenantId alone.
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

    const apiUser = Deno.env.get("PAYUNIT_API_USER");
    const apiPassword = Deno.env.get("PAYUNIT_API_PASSWORD");
    const appToken = Deno.env.get("PAYUNIT_APP_TOKEN");
    const mode = Deno.env.get("PAYUNIT_MODE") ?? "test";
    const appUrl = Deno.env.get("APP_URL") ?? "https://faka-hr.com";

    if (!apiUser || !apiPassword || !appToken) {
      return json({
        ok: false,
        error: "PAYUNIT_NOT_CONFIGURED",
        detail: "PayUnit is not configured yet. Set PAYUNIT_API_USER, PAYUNIT_API_PASSWORD and PAYUNIT_APP_TOKEN as secrets on this project before PayUnit checkout can be used.",
      }, 503);
    }

    const { data: tenant } = await adminClient.from("tenants").select("id, name, currency").eq("id", tenantId).maybeSingle();
    if (!tenant) return json({ ok: false, error: "TENANT_NOT_FOUND" }, 404);

    const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
      starter: { monthly: 19, yearly: 190 },
      pro: { monthly: 39, yearly: 390 },
      premium: { monthly: 69, yearly: 690 },
      enterprise: { monthly: 299, yearly: 2990 },
    };
    if (!PLAN_PRICES[plan]) return json({ ok: false, error: "INVALID_PLAN" }, 400);
    const amount = PLAN_PRICES[plan][billingInterval as "monthly" | "yearly"];

    // Our own reference for this transaction — used later to look the
    // transaction back up server-to-server when confirming payment,
    // rather than trusting whatever the notify_url callback claims.
    const transactionId = `FAKA-${tenantId.slice(0, 8)}-${Date.now()}`;

    const initRes = await fetch(`${PAYUNIT_BASE_URL}/api/gateway/checkout/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${apiUser}:${apiPassword}`)}`,
        "x-api-key": appToken,
        "mode": mode,
      },
      body: JSON.stringify({
        total_amount: amount,
        transaction_id: transactionId,
        mode: "payment",
        currency: tenant.currency || "XAF",
        success_url: `${appUrl}/dashboard/subscription?checkout=success`,
        cancel_url: `${appUrl}/dashboard/subscription?checkout=cancelled`,
        notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payunit-webhook`,
        items: [{
          price_description: { unit_amount: amount },
          product_description: { name: `Faka HR — Plan ${plan} (${billingInterval})`, about_product: `Abonnement Faka HR ${tenant.name}` },
          quantity: 1,
        }],
        meta: { phone_number_collection: true, address_collection: false },
      }),
    });

    const initJson = await initRes.json();
    if (!initRes.ok || initJson.status !== "SUCCESS") {
      return json({ ok: false, error: "PAYUNIT_INIT_FAILED", detail: initJson.message ?? `HTTP ${initRes.status}` }, 502);
    }

    // Record the pending transaction ourselves BEFORE redirecting, so the
    // webhook (which cannot be trusted on its own, see payunit-webhook)
    // has a known-good record to confirm against server-to-server.
    await adminClient.from("payunit_transactions").insert({
      tenant_id: tenantId,
      transaction_id: transactionId,
      plan,
      interval: billingInterval,
      amount,
      currency: tenant.currency || "XAF",
      status: "pending",
      created_by: user.id,
    });

    return json({ ok: true, url: initJson.data.redirect, transactionId });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
