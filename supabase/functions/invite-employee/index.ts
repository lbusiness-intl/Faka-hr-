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

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    const { action, token, tenantId } = body ?? {};

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── verify ──────────────────────────────────────────────────────────────
    if (action === "verify") {
      if (!token) return json({ ok: false, error: "MISSING_TOKEN" }, 400);
      const { data: inv, error } = await adminClient
        .from("invitations")
        .select("email, role, tenant_id, status, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !inv) return json({ ok: false, error: "INVALID_TOKEN" }, 404);
      if (inv.status === "used") return json({ ok: false, error: "ALREADY_USED" }, 410);
      if (new Date(inv.expires_at) < new Date()) return json({ ok: false, error: "EXPIRED" }, 410);
      return json({ ok: true, email: inv.email, role: inv.role, tenant_id: inv.tenant_id });
    }

    // ── create ───────────────────────────────────────────────────────────────
    if (action === "create") {
      // Auth the caller
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

      const {
        email, first_name, last_name, position, role,
        branch_id, department_id,
      } = body ?? {};

      if (!email || !tenantId) return json({ ok: false, error: "MISSING_FIELDS" }, 400);

      // Check caller is admin of this tenant, OR a platform super admin
      // (LIYAH GROUP team) who can act on any tenant.
      const SUPER_ADMIN_EMAILS = [
        "vincentnogue2@gmail.com",
        "vincentnogue@yahoo.com",
        "webdxb1@gmail.com",
        "liyahjoha@gmail.com"
      ];
      const isSuperAdmin = (user.app_metadata?.role === "super_admin") || (user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()));
      const { data: membership } = await adminClient
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      const isTenantAdmin = membership && ["super_admin","admin","hr_manager","hr_assistant"].includes(membership.role);
      if (!isSuperAdmin && !isTenantAdmin) {
        return json({ ok: false, error: "FORBIDDEN" }, 403);
      }

      // Create or update employee record (pending)
      let employeeId: string | null = null;
      const { data: existing } = await adminClient
        .from("employees")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (existing) {
        employeeId = existing.id;
        await adminClient.from("employees").update({
          first_name: first_name || existing.first_name,
          last_name: last_name || existing.last_name,
          position: position || null,
          branch_id: branch_id || null,
          department_id: department_id || null,
          status: "pending_invite",
        }).eq("id", employeeId);
      } else {
        const { data: emp } = await adminClient.from("employees").insert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          first_name: first_name || "",
          last_name: last_name || "",
          position: position || null,
          branch_id: branch_id || null,
          department_id: department_id || null,
          salary: 0,
          currency: "XAF",
          contract_type: "cdi",
          status: "pending_invite",
        }).select("id").single();
        employeeId = emp?.id ?? null;
      }

      // Generate invitation token
      const invToken =
        crypto.randomUUID().replace(/-/g, "") +
        crypto.randomUUID().replace(/-/g, "");

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      const { error: invErr } = await adminClient.from("invitations").insert({
        tenant_id: tenantId,
        email: email.toLowerCase(),
        role: role ?? "employee",
        token: invToken,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        status: "pending",
        custom_role: employeeId ? { employee_id: employeeId, branch_id, department_id } : null,
      });

      if (invErr) {
        return json({ ok: false, error: "INVITATION_FAILED", detail: invErr.message }, 500);
      }

      const inviteUrl = `${Deno.env.get("SITE_URL") ?? "https://faka.app"}/#/accept-invite?token=${invToken}`;

      await adminClient.from("audit_logs").insert({
        tenant_id: tenantId,
        actor: user.id,
        action: "invitation.created",
        details: { email, role, branch_id, department_id },
      });

      return json({ ok: true, token: invToken, invite_url: inviteUrl });
    }

    // ── accept ───────────────────────────────────────────────────────────────
    if (action === "accept") {
      const { password, full_name } = body ?? {};
      if (!token || !password) return json({ ok: false, error: "MISSING_FIELDS" }, 400);

      const { data: inv, error: invErr } = await adminClient
        .from("invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (invErr || !inv) return json({ ok: false, error: "INVALID_TOKEN" }, 404);
      if (inv.status === "used") return json({ ok: false, error: "ALREADY_USED" }, 410);
      if (new Date(inv.expires_at) < new Date()) return json({ ok: false, error: "EXPIRED" }, 410);

      const nameParts = (full_name ?? "").trim().split(" ");
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Create or update auth user
      let authUserId: string;
      const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers.find((u: any) => u.email === inv.email);

      if (existingUser) {
        authUserId = existingUser.id;
        await adminClient.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
      } else {
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: inv.email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });
        if (createErr || !newUser.user) {
          return json({ ok: false, error: "USER_CREATE_FAILED", detail: createErr?.message }, 500);
        }
        authUserId = newUser.user.id;
      }

      // Create membership
      const { error: memErr } = await adminClient.from("tenant_memberships").upsert({
        tenant_id: inv.tenant_id,
        user_id: authUserId,
        role: inv.role ?? "employee",
        status: "active",
      }, { onConflict: "tenant_id,user_id" });

      if (memErr) return json({ ok: false, error: "MEMBERSHIP_FAILED", detail: memErr.message }, 500);

      // Link employee record
      const meta = (inv.custom_role ?? {}) as any;
      if (meta?.employee_id) {
        await adminClient.from("employees").update({
          user_id: authUserId,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          status: "active",
        }).eq("id", meta.employee_id);
      } else {
        // Find by email
        await adminClient.from("employees").update({
          user_id: authUserId,
          status: "active",
        }).eq("tenant_id", inv.tenant_id).eq("email", inv.email);
      }

      // Mark invitation used
      await adminClient.from("invitations").update({
        status: "used",
        used_at: new Date().toISOString(),
        used_by: authUserId,
      }).eq("id", inv.id);

      await adminClient.from("audit_logs").insert({
        tenant_id: inv.tenant_id,
        actor: authUserId,
        action: "invitation.accepted",
        details: { email: inv.email, role: inv.role },
      });

      return json({ ok: true, user_id: authUserId });
    }

    // ── activate (employee activation by email + code) ─────────────────────────
    if (action === "activate") {
      const { email, code, password } = body ?? {};
      if (!email || !password) return json({ ok: false, error: "MISSING_FIELDS" }, 400);

      // Find invitation by token OR by email + code
      let inv: any = null;
      if (token) {
        const { data } = await adminClient
          .from("invitations")
          .select("*")
          .eq("token", token)
          .maybeSingle();
        inv = data;
      } else if (email) {
        // Look up by email — find the most recent pending/sent invitation
        const { data, error } = await adminClient
          .from("invitations")
          .select("*")
          .eq("email", email.toLowerCase())
          .in("status", ["pending", "sent"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data) return json({ ok: false, error: "NOT_FOUND" }, 404);
        // If a code was provided, validate it (code = first 8 chars of token)
        if (code && data.token && !data.token.startsWith(code)) {
          return json({ ok: false, error: "CODE_INVALID" }, 400);
        }
        inv = data;
      }

      if (!inv) return json({ ok: false, error: "NOT_FOUND" }, 404);
      if (inv.status === "used") return json({ ok: false, error: "ALREADY_USED" }, 410);
      if (new Date(inv.expires_at) < new Date()) return json({ ok: false, error: "EXPIRED" }, 410);

      // Create or update auth user
      let authUserId: string;
      const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers.find((u: any) => u.email === inv.email);

      if (existingUser) {
        authUserId = existingUser.id;
        await adminClient.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
        });
      } else {
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: inv.email,
          password,
          email_confirm: true,
        });
        if (createErr || !newUser.user) {
          return json({ ok: false, error: "USER_CREATE_FAILED", detail: createErr?.message }, 500);
        }
        authUserId = newUser.user.id;
      }

      // Create membership
      const { error: memErr } = await adminClient.from("tenant_memberships").upsert({
        tenant_id: inv.tenant_id,
        user_id: authUserId,
        role: inv.role ?? "employee",
        status: "active",
      }, { onConflict: "tenant_id,user_id" });

      if (memErr) return json({ ok: false, error: "MEMBERSHIP_FAILED", detail: memErr.message }, 500);

      // Link employee record
      const meta = (inv.custom_role ?? {}) as any;
      if (meta?.employee_id) {
        await adminClient.from("employees").update({
          user_id: authUserId,
          status: "active",
        }).eq("id", meta.employee_id);
      } else {
        await adminClient.from("employees").update({
          user_id: authUserId,
          status: "active",
        }).eq("tenant_id", inv.tenant_id).eq("email", inv.email);
      }

      // Get company name for the response
      const { data: tenant } = await adminClient
        .from("tenants")
        .select("name")
        .eq("id", inv.tenant_id)
        .maybeSingle();

      // Mark invitation used
      await adminClient.from("invitations").update({
        status: "used",
        used_at: new Date().toISOString(),
        used_by: authUserId,
      }).eq("id", inv.id);

      await adminClient.from("audit_logs").insert({
        tenant_id: inv.tenant_id,
        actor: authUserId,
        action: "invitation.accepted",
        details: { email: inv.email, role: inv.role },
      });

      // Queue welcome / account activated email
      await adminClient.from("email_queue").insert({
        tenant_id: inv.tenant_id,
        to_email: inv.email,
        template_key: "account_activated",
        subject: `Votre compte est activé — ${tenant?.name ?? "Faka HRMS"}`,
        status: "pending",
      });

      return json({ ok: true, user_id: authUserId, company_name: tenant?.name ?? "" });
    }

    return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (err: any) {
    return json({ ok: false, error: "INTERNAL_ERROR", detail: err?.message }, 500);
  }
});
