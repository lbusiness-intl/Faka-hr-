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
    // Build a user-scoped client from the request's Authorization header so
    // we can identify the caller, and a service-role client for the writes.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const {
      name, subdomain, industry, company_size,
      country, region, city, region_custom, city_custom,
      currency, timezone, phone_code, sales_code, payment_methods, plan,
    } = body ?? {};

    if (!name || !country || !region || !city || !currency) {
      return new Response(
        JSON.stringify({ ok: false, error: "MISSING_FIELDS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);

    // Create the tenant (service_role bypasses RLS).
    const { data: tenant, error: tErr } = await adminClient.from("tenants").insert({
      name,
      subdomain: subdomain || null,
      industry: industry || null,
      company_size: company_size || null,
      country,
      region,
      city,
      region_custom: region_custom || null,
      city_custom: city_custom || null,
      currency,
      timezone: timezone || "Africa/Douala",
      phone_code: phone_code || "+237",
      plan: plan || "starter",
      status: "trial",
      sales_code: sales_code || null,
      default_payment_methods: payment_methods ?? [],
      trial_ends_at: trialEnds.toISOString(),
      created_by: user.id,
    }).select().single();

    if (tErr) {
      const isDuplicate = tErr.code === "23505";
      const code = isDuplicate ? "SUBDOMAIN_TAKEN" : "TENANT_CREATE_FAILED";
      return new Response(
        JSON.stringify({ ok: false, error: code, detail: tErr.message }),
        { status: isDuplicate ? 409 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create the admin membership linking this user to the tenant.
    const { error: mErr } = await adminClient.from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      role: "admin",
      status: "active",
    });

    if (mErr) {
      // Best-effort cleanup of the orphan tenant.
      await adminClient.from("tenants").delete().eq("id", tenant.id);
      return new Response(
        JSON.stringify({ ok: false, error: "MEMBERSHIP_CREATE_FAILED", detail: mErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await adminClient.from("audit_logs").insert({
      tenant_id: tenant.id,
      actor: user.id,
      action: "tenant.created",
      details: { plan, country, currency, sales_code: sales_code || null },
    });

    return new Response(
      JSON.stringify({ ok: true, tenant_id: tenant.id, status: "trial", trial_ends_at: trialEnds.toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "INTERNAL_ERROR", detail: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
