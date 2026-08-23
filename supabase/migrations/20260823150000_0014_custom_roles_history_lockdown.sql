/*
# Lock down custom_roles and role_history writes to tenant admins

Found during the continued audit: `custom_roles` (role definitions that
carry permission grants) and `role_history` (the audit trail of who was
promoted/demoted) both let ANY tenant member — including a plain employee
— insert/update/delete rows, via the same overly broad `is_tenant_member`
check used before the earlier fixes in this series.

Concretely this let a regular employee:
  - tamper with the permission set of an existing custom role (which then
    silently changes what every user holding that role can do),
  - fabricate role-history "audit" entries,
  - browse the entire tenant's role-change history.

Fix: writes on both tables now require an admin-like role (or a real
super admin). `custom_roles` stays readable by any tenant member (needed
to render role names/badges across the UI); `role_history` read access is
now admin-like only too, since a promotion/demotion trail is HR-sensitive
information, not something every employee should be able to browse.
*/

DROP POLICY IF EXISTS "custom_roles_insert" ON public.custom_roles;
CREATE POLICY "custom_roles_insert" ON public.custom_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "custom_roles_update" ON public.custom_roles;
CREATE POLICY "custom_roles_update" ON public.custom_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "custom_roles_delete" ON public.custom_roles;
CREATE POLICY "custom_roles_delete" ON public.custom_roles FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "role_history_select" ON public.role_history;
CREATE POLICY "role_history_select" ON public.role_history FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

-- =========================================================
-- notifications: personal by design (user_id column), but the
-- original policies granted any tenant member read/write access
-- to EVERY notification in the tenant — including payroll, leave
-- and performance content addressed to someone else. Restrict to
-- the owning user, or an admin-like/super-admin sender.
-- =========================================================
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_admin_like_member(tenant_id)
    OR auth.uid() = user_id
    -- Any tenant member may escalate a notification TO an HR/admin
    -- teammate (e.g. "I just submitted a leave request") without
    -- being able to write into an arbitrary coworker's feed.
    OR (
      public.is_tenant_member(tenant_id)
      AND EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = notifications.tenant_id
          AND m.user_id = notifications.user_id
          AND m.status = 'active'
          AND m.role IN ('admin', 'hr_manager', 'hr_assistant')
      )
    )
  );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id OR public.is_admin_like_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id OR public.is_admin_like_member(tenant_id));

-- =========================================================
-- notification_preferences: was already self-scoped for
-- update/delete, but select/insert still had a blanket
-- is_tenant_member fallback that let anyone read or create
-- preference rows for anyone else in the tenant. Self or
-- admin-like only, consistently across all four operations.
-- =========================================================
DROP POLICY IF EXISTS "notif_prefs_select" ON public.notification_preferences;
CREATE POLICY "notif_prefs_select" ON public.notification_preferences FOR SELECT TO authenticated
  USING (public.is_super_admin() OR auth.uid() = user_id OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "notif_prefs_insert" ON public.notification_preferences;
CREATE POLICY "notif_prefs_insert" ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR auth.uid() = user_id);

-- =========================================================
-- trainings: per-employee assigned courses/certificates.
-- Same self-or-admin pattern as goals/reviews — a coworker's
-- training progress and certificates are not public within
-- the tenant.
-- =========================================================
DROP POLICY IF EXISTS "trainings_select_member_or_super" ON public.trainings;
CREATE POLICY "trainings_select_member_or_super" ON public.trainings FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "trainings_insert_member_or_super" ON public.trainings;
CREATE POLICY "trainings_insert_member_or_super" ON public.trainings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "trainings_update_member_or_super" ON public.trainings;
CREATE POLICY "trainings_update_member_or_super" ON public.trainings FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id))
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id) OR public.owns_employee_row(employee_id));

DROP POLICY IF EXISTS "trainings_delete_member_or_super" ON public.trainings;
CREATE POLICY "trainings_delete_member_or_super" ON public.trainings FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

-- =========================================================
-- recruitment_candidates: applicant PII (contact info, resume,
-- salary expectations) — restricted to hiring-capable roles
-- (recruiter/hr_manager/admin are part of "admin-like"), not
-- every employee of the tenant.
-- =========================================================
DROP POLICY IF EXISTS "candidates_select_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_select_member_or_super" ON public.recruitment_candidates FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "candidates_insert_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_insert_member_or_super" ON public.recruitment_candidates FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "candidates_update_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_update_member_or_super" ON public.recruitment_candidates FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "candidates_delete_member_or_super" ON public.recruitment_candidates;
CREATE POLICY "candidates_delete_member_or_super" ON public.recruitment_candidates FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

-- =========================================================
-- recruitment_postings: job posting content has no personal
-- data, so tenant-wide read stays as-is (employees can browse
-- internal openings), but only hiring-capable roles may
-- create/edit/close a posting.
-- =========================================================
DROP POLICY IF EXISTS "postings_insert_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_insert_member_or_super" ON public.recruitment_postings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "postings_update_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_update_member_or_super" ON public.recruitment_postings FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "postings_delete_member_or_super" ON public.recruitment_postings;
CREATE POLICY "postings_delete_member_or_super" ON public.recruitment_postings FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

-- =========================================================
-- assets: company equipment inventory. Read stays tenant-wide
-- (harmless, useful for e.g. "who has what"), but assigning,
-- editing or deleting an asset record is admin-like only — an
-- employee should never be able to reassign a laptop to
-- themselves in the system.
-- =========================================================
DROP POLICY IF EXISTS "assets_insert_member_or_super" ON public.assets;
CREATE POLICY "assets_insert_member_or_super" ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "assets_update_member_or_super" ON public.assets;
CREATE POLICY "assets_update_member_or_super" ON public.assets FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
  WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "assets_delete_member_or_super" ON public.assets;
CREATE POLICY "assets_delete_member_or_super" ON public.assets FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));
