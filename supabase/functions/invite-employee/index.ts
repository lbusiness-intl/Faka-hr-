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
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Create an invitation (HR invites an employee)
    if (action === "create") {
      const { tenant_id, email, role, employee_id, custom_role } = body;
      if (!tenant_id || !email || !employee_id) {
        return new Response(JSON.stringify({ ok: false, error: "MISSING_FIELDS" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify caller is an admin of this tenant
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );

      const { data: membership } = await adminClient
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenant_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      const isSuper = (user.app_metadata?.role ?? user.user_metadata?.role) === "super_admin";
      if (!isSuper && (!membership || !["admin", "super_admin"].includes(membership.role))) {
        return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a unique token
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

      const { error: invErr } = await adminClient.from("invitations").insert({
        tenant_id,
        email,
        role: role ?? "employee",
        custom_role: custom_role ?? null,
        token,
        created_by: user.id,
        status: "pending",
      });

      if (invErr) {
        return new Response(JSON.stringify({ ok: false, error: "INVITE_CREATE_FAILED", detail: invErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Link the employee record to this email so the employee dashboard can find it
      await adminClient.from("employees").update({ email }).eq("id", employee_id);

      return new Response(JSON.stringify({ ok: true, token, invite_url: `/accept-invite?token=${token}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept an invitation (employee sets password and joins tenant)
    if (action === "accept") {
      const { token, password, full_name } = body;
      if (!token || !password) {
        return new Response(JSON.stringify({ ok: false, error: "MISSING_FIELDS" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );

      const { data: inv, error: invErr } = await adminClient
        .from("invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (invErr || !inv) {
        return new Response(JSON.stringify({ ok: false, error: "INVALID_TOKEN" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (inv.status === "used" || inv.used_at) {
        return new Response(JSON.stringify({ ok: false, error: "ALREADY_USED" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(inv.expires_at) < new Date()) {
        await adminClient.from("invitations").update({ status: "expired" }).eq("id", inv.id);
        return new Response(JSON.stringify({ ok: false, error: "EXPIRED" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the auth user (or update if exists)
      const { data: existingUser } = await adminClient.auth.admin.listUsers();
      const found = (existingUser.users ?? []).find((u: any) => u.email === inv.email);

      let userId: string;
      if (found) {
        userId = found.id;
        await adminClient.auth.admin.updateUserById(found.id, { password });
      } else {
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: inv.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name ?? "" },
        });
        if (createErr || !newUser.user) {
          return new Response(JSON.stringify({ ok: false, error: "USER_CREATE_FAILED", detail: createErr?.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;
      }

      // Create membership
      const { error: mErr } = await adminClient.from("tenant_memberships").upsert({
        tenant_id: inv.tenant_id,
        user_id: userId,
        role: inv.role,
        custom_role: inv.custom_role,
        status: "active",
      }, { onConflict: "tenant_id,user_id" });

      if (mErr) {
        return new Response(JSON.stringify({ ok: false, error: "MEMBERSHIP_FAILED", detail: mErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Link employee record to the auth user
      await adminClient.from("employees")
        .update({ user_id: userId, status: "active" })
        .eq("tenant_id", inv.tenant_id)
        .eq("email", inv.email);

      // Mark invitation used
      await adminClient.from("invitations").update({
        status: "used",
        used_at: new Date().toISOString(),
        used_by: userId,
      }).eq("id", inv.id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify a token (for the accept-invite page)
    if (action === "verify") {
      const { token } = body;
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: inv } = await adminClient.from("invitations").select("*").eq("token", token).maybeSingle();
      if (!inv) return new Response(JSON.stringify({ ok: false, error: "INVALID_TOKEN" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (inv.status === "used" || inv.used_at) return new Response(JSON.stringify({ ok: false, error: "ALREADY_USED" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (new Date(inv.expires_at) < new Date()) return new Response(JSON.stringify({ ok: false, error: "EXPIRED" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, email: inv.email, role: inv.role, tenant_id: inv.tenant_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "UNKNOWN_ACTION" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "INTERNAL_ERROR", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
