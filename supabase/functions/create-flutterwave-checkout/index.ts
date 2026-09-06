// create-flutterwave-checkout
//
// Creates a REAL Flutterwave Standard checkout session and returns the
// hosted payment link. Flutterwave is a payment aggregator widely used
// across Nigeria and other African markets (cards, bank transfer, USSD,
// mobile money).
//
// Built against Flutterwave's official v3 REST API:
//   https://developer.flutterwave.com/docs/making-payments/standard
//
// Required Supabase Edge Function secrets (fails closed with
// FLUTTERWAVE_NOT_CONFIGURED instead of pretending to work until set):
//   FLUTTERWAVE_SECRET_KEY   from the Flutterwave Dashboard > Settings > API
//   APP_URL                  e.g. https://app.faka-hr.com (for the redirect URL)
//
// Same currency-conversion rule as every other PSP integration in this
// codebase: plans are priced in USD (src/lib/plans.ts); the amount charged
// is converted to the tenant's currency using a live exchange rate, never
// the raw USD number charged as-is in a different currency.
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

    const secretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    const appUrl = Deno.env.get("APP_URL") ?? "https://faka-hr.com";
    if (!secretKey) {
      return json({
        ok: false,
        error: "FLUTTERWAVE_NOT_CONFIGURED",
        detail: "Flutterwave is not configured yet. Set FLUTTERWAVE_SECRET_KEY as a secret on this project before Flutterwave checkout can be used.",
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

    const txRef = `FAKA-FLW-${tenantId.replace(/-/g, "").slice(0, 12)}-${Date.now()}`;

    const initRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: localAmount,
        currency: targetCurrency,
        redirect_url: `${appUrl}/dashboard/subscription?checkout=return`,
        customer: { email: user.email ?? "", name: tenant.name },
        customizations: { title: "Faka", description: `Abonnement ${plan}` },
      }),
    });
    const initJson = await initRes.json();
    if (!initRes.ok || initJson.status !== "success") {
      return json({ ok: false, error: "FLUTTERWAVE_INIT_FAILED", detail: initJson.message ?? `HTTP ${initRes.status}` }, 502);
    }
    const redirectUrl: string | undefined = initJson.data?.link;
    if (!redirectUrl) return json({ ok: false, error: "FLUTTERWAVE_INIT_FAILED", detail: "No payment link returned by Flutterwave." }, 502);

    // Anchor record BEFORE redirecting — same rationale as PayUnit: the
    // webhook body alone is never trusted, this row is what gets confirmed
    // against Flutterwave's own verify endpoint server-to-server.
    await adminClient.from("flutterwave_transactions").insert({
      tenant_id: tenantId,
      tx_ref: txRef,
      plan,
      interval: billingInterval,
      amount: localAmount,
      amount_usd: usdAmount,
      currency: targetCurrency,
      status: "pending",
      created_by: user.id,
    });

    return json({ ok: true, url: redirectUrl, txRef });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
