// ai-assistant
//
// A real AI assistant for Faka, grounded in the caller's OWN tenant data.
//
// Two design rules this function enforces, which matter more than the
// model call itself:
//
// 1. PERMISSION SCOPING. The context handed to the model is built
//    server-side from the caller's actual role. A plain employee's context
//    contains only their own records (their leave, their payslips, their
//    attendance) — never colleagues' salaries or company-wide payroll. An
//    admin-like role gets tenant-wide aggregates. The model can only talk
//    about what it was given, so a user cannot prompt their way into data
//    their role can't see.
//
// 2. NO INVENTED FACTS. The system prompt instructs the model to answer
//    only from the supplied context and to say plainly when it doesn't
//    know, rather than guessing a number. An HR assistant that invents a
//    leave balance or a payroll figure is worse than no assistant.
//
// Required Supabase Edge Function secret:
//   GEMINI_API_KEY   from aistudio.google.com/apikey
// Without it, this returns AI_NOT_CONFIGURED and the UI hides the
// assistant entirely rather than showing a broken feature.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ADMIN_LIKE = ["admin", "hr_manager", "hr_assistant", "payroll_officer", "finance", "manager", "team_lead"];

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
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ ok: false, error: "AI_NOT_CONFIGURED" }, 503);
    }

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
    const { tenantId, messages } = body ?? {};
    if (!tenantId || !Array.isArray(messages) || messages.length === 0) {
      return json({ ok: false, error: "MISSING_PARAMS" }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Establish the caller's real role in THIS tenant. Never trust a role
    // sent from the client.
    const { data: membership } = await adminClient
      .from("tenant_memberships")
      .select("role, status")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const isSuperAdmin = user.app_metadata?.role === "super_admin";
    if (!membership && !isSuperAdmin) return json({ ok: false, error: "FORBIDDEN" }, 403);

    const role = membership?.role ?? "employee";
    const isAdminLike = isSuperAdmin || ADMIN_LIKE.includes(role);

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("name, currency, plan, status")
      .eq("id", tenantId)
      .maybeSingle();

    // Build a role-scoped snapshot of real data.
    const context: Record<string, unknown> = {
      company: tenant?.name,
      currency: tenant?.currency,
      today: new Date().toISOString().slice(0, 10),
      your_role: role,
    };

    const { data: me } = await adminClient
      .from("employees")
      .select("id, first_name, last_name, position, department")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (me) {
      context.you = { name: `${me.first_name} ${me.last_name}`.trim(), position: me.position, department: me.department };

      const [leaves, balance, att] = await Promise.all([
        adminClient.from("leave_requests")
          .select("type, start_date, end_date, status, days")
          .eq("tenant_id", tenantId).eq("employee_id", me.id)
          .order("created_at", { ascending: false }).limit(10),
        adminClient.from("leave_balances")
          .select("leave_type, entitled_days, used_days")
          .eq("tenant_id", tenantId).eq("employee_id", me.id),
        adminClient.from("attendance")
          .select("check_in, check_out, created_at")
          .eq("tenant_id", tenantId).eq("employee_id", me.id)
          .order("created_at", { ascending: false }).limit(5),
      ]);
      context.your_leave_requests = leaves.data ?? [];
      context.your_leave_balances = balance.data ?? [];
      context.your_recent_attendance = att.data ?? [];
    }

    if (isAdminLike) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [empCount, pendingLeaves, pendingAdvances, pendingClaims, onLeave, openRoles] = await Promise.all([
        adminClient.from("employees").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "active"),
        adminClient.from("leave_requests").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "pending"),
        adminClient.from("advances").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "pending"),
        adminClient.from("claims").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "pending"),
        adminClient.from("leave_requests")
          .select("employee_id, end_date, employees(first_name, last_name)")
          .eq("tenant_id", tenantId).eq("status", "approved")
          .lte("start_date", todayStr).gte("end_date", todayStr),
        adminClient.from("recruitment_postings").select("title, status")
          .eq("tenant_id", tenantId).eq("status", "open").limit(10),
      ]);
      context.company_overview = {
        active_employees: empCount.count ?? 0,
        pending_leave_requests: pendingLeaves.count ?? 0,
        pending_advances: pendingAdvances.count ?? 0,
        pending_expense_claims: pendingClaims.count ?? 0,
        on_leave_today: (onLeave.data ?? []).length,
        open_job_postings: openRoles.data ?? [],
      };
      context.note_on_scope = "You are an admin-like role, so company-wide aggregates are included. Individual salary figures are deliberately NOT included in this context.";
    } else {
      context.note_on_scope = "You are a regular employee, so only your own records are included. You cannot see colleagues' data.";
    }

    const systemPrompt = `You are the assistant built into Faka, an HR platform.

Answer using ONLY the CONTEXT below, which contains this user's real, permission-scoped data. Rules:
- Never invent a number, date, balance, or name. If the answer isn't in the context, say plainly that you don't have that information and point them to the relevant section of the app.
- If the user asks about data their role cannot see (e.g. an employee asking about a colleague's salary), explain that their role doesn't grant access, without apologising excessively.
- Be concise and practical. Amounts are in ${tenant?.currency ?? "the company currency"}.
- Reply in the language the user writes in (usually French or English).
- You can explain how to do things in Faka (request leave, run payroll, invite an employee) — those instructions are general product knowledge, not data claims.

CONTEXT:
${JSON.stringify(context, null, 2)}`;

    // Gemini: the system prompt goes in systemInstruction, and the roles
    // are "user"/"model" (not "assistant"), so the conversation is mapped
    // accordingly before sending.
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: messages.slice(-12).map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: String(m.content ?? "").slice(0, 4000) }],
          })),
          generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
        }),
      },
    );

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return json({ ok: false, error: "AI_REQUEST_FAILED", detail: detail.slice(0, 300) }, 502);
    }

    const aiJson = await aiRes.json();
    const reply = (aiJson.candidates?.[0]?.content?.parts ?? [])
      .map((pt: { text?: string }) => pt.text ?? "")
      .join("")
      .trim();

    return json({ ok: true, reply: reply || "Je n'ai pas pu générer de réponse." });
  } catch (err) {
    return json({ ok: false, error: "INTERNAL_ERROR", detail: err instanceof Error ? err.message : String(err) }, 500);
  }
});
