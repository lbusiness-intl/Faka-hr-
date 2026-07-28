import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// -----------------------------------------------------------------
// IMPORTANT: this endpoint is currently a *simulated* Stripe webhook
// used to demo the upgrade flow — it does NOT process a real payment.
// Before accepting real paying customers, replace this with a genuine
// Stripe Checkout session + signature-verified webhook
// (see https://docs.stripe.com/webhooks for signature verification).
//
// Until then, this guard at least ensures only an authenticated
// admin/super_admin of the tenant being upgraded can call it — it was
// previously callable anonymously by anyone with the tenant_id,
// letting anyone grant any company a free paid plan.
// -----------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const callerId = userData.user.id;

    const body = await req.json();
    const { type, tenant_id, plan, amount, currency, stripe_session_id } = body || {};

    if (!tenant_id || !plan) {
      return new Response(
        JSON.stringify({ ok: false, error: "tenant_id and plan are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Confirm the caller is a super admin OR an admin/owner member of
    // *this* tenant — never let a user upgrade a company they don't run.
    let authorized = userData.user.app_metadata?.role === "super_admin";
    if (!authorized) {
      const { data: membership } = await supabase
        .from("tenant_memberships")
        .select("role, status")
        .eq("tenant_id", tenant_id)
        .eq("user_id", callerId)
        .eq("status", "active")
        .maybeSingle();
      authorized = Boolean(membership && (membership.role === "admin" || membership.role === "super_admin"));
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ ok: false, error: "You are not authorized to change billing for this company." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Simulated Stripe webhook: accepts a checkout.session.completed-like event
    // and flips the tenant from "trial" to "active", records an invoice, and
    // extends current_period_end by 1 month.
    if (type !== "checkout.session.completed") {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: `event ${type} not handled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: tErr } = await supabase
      .from("tenants")
      .update({ status: "active", current_period_end: periodEnd.toISOString() })
      .eq("id", tenant_id);

    if (tErr) throw new Error(tErr.message);

    const { error: iErr } = await supabase.from("invoices").insert({
      tenant_id,
      amount: amount ?? 0,
      currency: currency ?? "USD",
      plan,
      status: "paid",
      stripe_session_id: stripe_session_id ?? null,
      paid_at: new Date().toISOString(),
    });

    if (iErr) throw new Error(iErr.message);

    await supabase.from("audit_logs").insert({
      tenant_id,
      actor: callerId,
      action: "stripe.checkout.completed",
      details: { plan, amount, currency, stripe_session_id, simulated: true },
    });

    return new Response(
      JSON.stringify({ ok: true, tenant_id, plan, status: "active", period_end: periodEnd.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
