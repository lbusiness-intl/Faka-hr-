import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { type, tenant_id, plan, amount, currency, stripe_session_id } = body || {};

    // Simulated Stripe webhook: accepts a checkout.session.completed-like event
    // and flips the tenant from "trial" to "active", records an invoice, and
    // extends current_period_end by 1 month.
    if (type !== "checkout.session.completed") {
      return new Response(
        JSON.stringify({ ok: true, ignored: true, reason: `event ${type} not handled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tenant_id || !plan) {
      return new Response(
        JSON.stringify({ ok: false, error: "tenant_id and plan are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      action: "stripe.checkout.completed",
      details: { plan, amount, currency, stripe_session_id },
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
