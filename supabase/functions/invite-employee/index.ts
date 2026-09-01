import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Invitation = {
  id: string; tenant_id: string; email: string; role: string; token: string;
  status: string; expires_at: string; sales_code?: string | null;
  custom_role?: { employee_id?: string; branch_id?: string; department_id?: string } | null;
};
type AuthUser = { id: string; email?: string };

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

    // Verifies the caller's JWT (via the anon-key client, so it is bound to
    // their real session) and confirms app_metadata.role === 'super_admin'.
    // Used to gate every platform-staff-management action below — nobody
    // can list or revoke staff, or read anything here, without already
    // being a verified super admin.
    async function requireSuperAdmin(): Promise<{ id: string; email?: string } | null> {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user || user.app_metadata?.role !== "super_admin") return null;
      return { id: user.id, email: user.email };
    }

    // ── list_staff (platform staff with the super_admin role) ────────────────
    if (action === "list_staff") {
      const caller = await requireSuperAdmin();
      if (!caller) return json({ ok: false, error: "FORBIDDEN" }, 403);

      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) return json({ ok: false, error: "LIST_FAILED", detail: error.message }, 500);
      const staff = data.users
        .filter((u) => u.app_metadata?.role === "super_admin")
        .map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        }));
      return json({ ok: true, staff });
    }

    // ── revoke_staff (remove the super_admin role from a platform user) ──────
    if (action === "revoke_staff") {
      const caller = await requireSuperAdmin();
      if (!caller) return json({ ok: false, error: "FORBIDDEN" }, 403);
      const { userId } = body ?? {};
      if (!userId) return json({ ok: false, error: "MISSING_FIELDS" }, 400);
      if (userId === caller.id) return json({ ok: false, error: "CANNOT_REVOKE_SELF" }, 400);

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: { role: null },
      });
      if (error) return json({ ok: false, error: "REVOKE_FAILED", detail: error.message }, 500);
      await adminClient.from("audit_logs").insert({
        actor: caller.id,
        action: "staff.super_admin_revoked",
        details: { target_user_id: userId },
      });
      return json({ ok: true });
    }

    // ── invite_staff (invite a new platform staff member as super_admin) ─────
    if (action === "invite_staff") {
      const caller = await requireSuperAdmin();
      if (!caller) return json({ ok: false, error: "FORBIDDEN" }, 403);
      const { email } = body ?? {};
      if (!email || typeof email !== "string") return json({ ok: false, error: "MISSING_FIELDS" }, 400);

      const invToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      const { error: invErr } = await adminClient.from("invitations").insert({
        tenant_id: null,
        email: email.toLowerCase(),
        role: "super_admin",
        token: invToken,
        expires_at: expiresAt.toISOString(),
        created_by: caller.id,
        status: "pending",
      });
      if (invErr) return json({ ok: false, error: "INVITATION_FAILED", detail: invErr.message }, 500);

      await adminClient.from("audit_logs").insert({
        actor: caller.id,
        action: "staff.super_admin_invited",
        details: { email },
      });

      const inviteUrl = `${Deno.env.get("SITE_URL") ?? "https://faka.app"}/#/accept-invite?token=${invToken}`;
      return json({ ok: true, token: invToken, invite_url: inviteUrl });
    }

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
      const isSuperAdmin = user.app_metadata?.role === "super_admin";
      const { data: membership } = await adminClient
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      const isTenantAdmin = membership && ["admin","hr_manager","hr_assistant"].includes(membership.role);
      if (!isSuperAdmin && !isTenantAdmin) {
        return json({ ok: false, error: "FORBIDDEN" }, 403);
      }

      // SECURITY: the invitation `role` field ends up written straight into
      // tenant_memberships when the invite is accepted (see the "accept" /
      // "activate" actions below), via the service-role client which bypasses
      // RLS entirely. Never let a tenant-level caller (even an admin) issue
      // an invite carrying the platform-wide "super_admin" role — only a
      // caller who is ALREADY a verified super admin (JWT app_metadata,
      // which a client cannot forge) may grant it, and only to onboard
      // platform staff, never through self-service tenant invites.
      const requestedRole = typeof role === "string" ? role : "employee";
      const safeRole = requestedRole === "super_admin" && !isSuperAdmin ? "employee" : requestedRole;
      if (requestedRole === "super_admin" && !isSuperAdmin) {
        await adminClient.from("audit_logs").insert({
          tenant_id: tenantId,
          actor: user.id,
          action: "invitation.blocked_privilege_escalation",
          details: { email, attempted_role: requestedRole },
        });
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
        const { error: empUpdErr } = await adminClient.from("employees").update({
          first_name: first_name || existing.first_name,
          last_name: last_name || existing.last_name,
          position: position || null,
          branch_id: branch_id || null,
          department_id: department_id || null,
          status: "pending_invite",
        }).eq("id", employeeId);
        if (empUpdErr) {
          const tenantInactive = empUpdErr.message?.includes("TENANT_INACTIVE");
          return json({
            ok: false,
            error: tenantInactive ? "TENANT_INACTIVE" : "EMPLOYEE_UPDATE_FAILED",
            detail: empUpdErr.message,
          }, tenantInactive ? 402 : 500);
        }
      } else {
        const { data: emp, error: empInsErr } = await adminClient.from("employees").insert({
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
        if (empInsErr) {
          const limitReached = empInsErr.message?.includes("EMPLOYEE_LIMIT_REACHED");
          const tenantInactive = empInsErr.message?.includes("TENANT_INACTIVE");
          return json({
            ok: false,
            error: limitReached ? "EMPLOYEE_LIMIT_REACHED" : tenantInactive ? "TENANT_INACTIVE" : "EMPLOYEE_CREATE_FAILED",
            detail: empInsErr.message,
          }, limitReached || tenantInactive ? 402 : 500);
        }
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
        role: safeRole,
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
      const existingUser = existingUsers.find((u: AuthUser) => u.email === inv.email);

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

      // Platform-wide roles (super_admin, commercial) have no tenant to
      // attach — tenant_memberships.tenant_id is NOT NULL, so there is no
      // membership row to create for them, only for a real tenant invite.
      if (inv.tenant_id) {
        const { error: memErr } = await adminClient.from("tenant_memberships").upsert({
          tenant_id: inv.tenant_id,
          user_id: authUserId,
          role: inv.role ?? "employee",
          status: "active",
        }, { onConflict: "tenant_id,user_id" });

        if (memErr) return json({ ok: false, error: "MEMBERSHIP_FAILED", detail: memErr.message }, 500);

        // Link employee record
        const meta = inv.custom_role ?? {};
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
      }

      // SECURITY: the platform-wide super_admin flag lives ONLY in the
      // auth user's app_metadata (that is what every RLS policy's
      // is_super_admin() and the client's isSuperAdmin check both read —
      // see migration 0011). It is never derived from tenant_memberships.
      // This code path is only reachable for an invitation row that
      // already carries role = 'super_admin', and RLS on `invitations`
      // (migration 0011) only allows THAT row to be created by a caller
      // who was already a verified super admin — so granting it here,
      // for the invited user, does not create a new escalation path.
      // Defense in depth: a legitimate platform-staff invitation is
      // never tied to a tenant. Requiring tenant_id === null here is a
      // second, independent guard on top of the RLS policies on
      // `invitations` (migrations 0011 and 0023) that already restrict
      // who can write role = 'super_admin' in the first place.
      if (inv.role === "super_admin" && !inv.tenant_id) {
        await adminClient.auth.admin.updateUserById(authUserId, {
          app_metadata: { role: "super_admin" },
        });
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
      let inv: Invitation | null = null;
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
      const existingUser = existingUsers.find((u: AuthUser) => u.email === inv.email);

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

      // Same rule as the accept action above: only create a membership /
      // link an employee record when this invitation is actually tied to
      // a tenant. A tenant-less (platform staff / super_admin) invitation
      // has neither.
      if (inv.tenant_id) {
        const { error: memErr } = await adminClient.from("tenant_memberships").upsert({
          tenant_id: inv.tenant_id,
          user_id: authUserId,
          role: inv.role ?? "employee",
          status: "active",
        }, { onConflict: "tenant_id,user_id" });

        if (memErr) return json({ ok: false, error: "MEMBERSHIP_FAILED", detail: memErr.message }, 500);

        const meta = inv.custom_role ?? {};
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
      }

      // Defense in depth: a legitimate platform-staff invitation is
      // never tied to a tenant. Requiring tenant_id === null here is a
      // second, independent guard on top of the RLS policies on
      // `invitations` (migrations 0011 and 0023) that already restrict
      // who can write role = 'super_admin' in the first place.
      if (inv.role === "super_admin" && !inv.tenant_id) {
        await adminClient.auth.admin.updateUserById(authUserId, {
          app_metadata: { role: "super_admin" },
        });
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
  } catch (err) {
    return json({ ok: false, error: "INTERNAL_ERROR", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
