// create-checkout-session
//
// Creates a REAL Stripe Checkout Session and returns its hosted URL for the
// browser to redirect to. This replaces the previous flow where the client
// called the "stripe-webhook" function directly to flip a tenant to "active"
// with no payment ever collected and no signature verification — anyone
// signed in could grant themselves any paid plan for free.
//
// Required Supabase Edge Function secrets (set these before upgrades work):
//   STRIPE_SECRET_KEY            sk_live_... or sk_test_...
//   STRIPE_PRICE_STARTER_MONTHLY / STRIPE_PRICE_STARTER_YEARLY
//   STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_YEARLY
//   STRIPE_PRICE_PREMIUM_MONTHLY / STRIPE_PRICE_PREMIUM_YEARLY
//   STRIPE_PRICE_ENTERPRISE_MONTHLY / STRIPE_PRICE_ENTERPRISE_YEARLY
//   (each is a Stripe Price ID created in the Stripe Dashboard)
//   APP_URL                      e.g. https://app.faka-hr.com (for redirect URLs)
//
// Until these are configured, this function returns a clear
// CHECKOUT_NOT_CONFIGURED error instead of silently pretending to work.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRICE_ENV_KEYS: Record<string, { monthly: string; yearly: string }> = {
  starter: { monthly: "STRIPE_PRICE_STARTER_MONTHLY", yearly: "STRIPE_PRICE_STARTER_YEARLY" },
  pro: { monthly: "STRIPE_PRICE_PRO_MONTHLY", yearly: "STRIPE_PRICE_PRO_YEARLY" },
  premium: { monthly: "STRIPE_PRICE_PREMIUM_MONTHLY", yearly: "STRIPE_PRICE_PREMIUM_YEARLY" },
  enterprise: { monthly: "STRIPE_PRICE_ENTERPRISE_MONTHLY", yearly: "STRIPE_PRICE_ENTERPRISE_YEARLY" },
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
    if (!PRICE_ENV_KEYS[plan]) return json({ ok: false, error: "INVALID_PLAN" }, 400);
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

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get(PRICE_ENV_KEYS[plan][billingInterval]);
    const appUrl = Deno.env.get("APP_URL") ?? "https://faka-hr.com";

    if (!stripeSecretKey || !priceId) {
      return json({
        ok: false,
        error: "CHECKOUT_NOT_CONFIGURED",
        detail: "Stripe is not configured yet. Set STRIPE_SECRET_KEY and the STRIPE_PRICE_* secrets on this project before subscriptions can be purchased.",
      }, 503);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-11-20.acacia" });

    const { data: tenant } = await adminClient.from("tenants").select("id, name, stripe_customer_id").eq("id", tenantId).maybeSingle();
    if (!tenant) return json({ ok: false, error: "TENANT_NOT_FOUND" }, 404);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: tenant.stripe_customer_id || undefined,
      customer_email: tenant.stripe_customer_id ? undefined : user.email,
      client_reference_id: tenantId,
      // The webhook trusts ONLY this server-set metadata, never anything
      // supplied by the browser, to determine which tenant to activate.
      metadata: { tenant_id: tenantId, plan, interval: billingInterval },
      subscription_data: { metadata: { tenant_id: tenantId, plan, interval: billingInterval } },
      success_url: `${appUrl}/dashboard/subscription?checkout=success`,
      cancel_url: `${appUrl}/dashboard/subscription?checkout=cancelled`,
    });

    return json({ ok: true, url: session.url });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
