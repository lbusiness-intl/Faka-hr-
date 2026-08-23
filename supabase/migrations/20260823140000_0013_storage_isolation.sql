/*
# Storage isolation: split avatars from official documents

Problem found during audit: profile-picture avatars and official employee
documents (signed contracts, ID scans, payslip attachments) shared a
single Storage bucket ("documents") with no RLS policies defined anywhere
in the migrations — meaning bucket access was whatever was clicked
together by hand in the Supabase dashboard at some point, entirely
outside version control and outside this app's tenant-isolation model.
If that bucket was ever set to "public" (a common default when a project
is prototyped quickly), every uploaded ID card and signed contract for
every tenant would be readable by anyone on the internet who obtained a
storage path — regardless of how strict the `documents` TABLE's RLS is,
since Storage access is governed independently of table RLS.

Fix:
  - "avatars": public bucket, low-sensitivity profile pictures only.
  - "documents": private bucket. Objects are stored at
    `{tenant_id}/{employee_id}/...`, and RLS on storage.objects enforces
    the same tenant isolation as the `documents` table: a super admin, an
    admin-like member of that tenant, or the employee who owns that
    sub-folder may read/write; nobody else, ever — not even another
    employee of the same tenant.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ---------------------------------------------------------
-- avatars: public read (profile pictures), write restricted
-- to the owning tenant member (path: {tenant_id}/{employee_id}-...)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_write_own_tenant" ON storage.objects;
CREATE POLICY "avatars_write_own_tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (public.is_super_admin() OR public.is_tenant_member(((string_to_array(name, '/'))[1])::uuid))
);

DROP POLICY IF EXISTS "avatars_update_own_tenant" ON storage.objects;
CREATE POLICY "avatars_update_own_tenant"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (public.is_super_admin() OR public.is_tenant_member(((string_to_array(name, '/'))[1])::uuid)))
WITH CHECK (bucket_id = 'avatars' AND (public.is_super_admin() OR public.is_tenant_member(((string_to_array(name, '/'))[1])::uuid)));

-- ---------------------------------------------------------
-- documents: private, strict tenant isolation, path is
-- {tenant_id}/{employee_id}/{filename}
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "documents_select_own_tenant" ON storage.objects;
CREATE POLICY "documents_select_own_tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    public.is_super_admin()
    OR public.is_admin_like_member(((string_to_array(name, '/'))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = ((string_to_array(name, '/'))[2])::uuid
        AND e.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "documents_insert_own_tenant" ON storage.objects;
CREATE POLICY "documents_insert_own_tenant"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    public.is_super_admin()
    OR public.is_admin_like_member(((string_to_array(name, '/'))[1])::uuid)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = ((string_to_array(name, '/'))[2])::uuid
        AND e.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "documents_delete_admin_only" ON storage.objects;
CREATE POLICY "documents_delete_admin_only"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (public.is_super_admin() OR public.is_admin_like_member(((string_to_array(name, '/'))[1])::uuid))
);

-- =========================================================
-- documents table: tighten to match — an employee may only
-- see/upload their own file, official records are otherwise
-- admin-like only (mirrors the storage policies above).
-- =========================================================
DROP POLICY IF EXISTS "documents_select_member_or_super" ON public.documents;
CREATE POLICY "documents_select_member_or_super"
ON public.documents FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_admin_like_member(tenant_id)
  OR public.owns_employee_row(employee_id)
);

DROP POLICY IF EXISTS "documents_insert_member_or_super" ON public.documents;
CREATE POLICY "documents_insert_member_or_super"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_admin_like_member(tenant_id)
  OR public.owns_employee_row(employee_id)
);

DROP POLICY IF EXISTS "documents_update_member_or_super" ON public.documents;
CREATE POLICY "documents_update_member_or_super"
ON public.documents FOR UPDATE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id))
WITH CHECK (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

DROP POLICY IF EXISTS "documents_delete_member_or_super" ON public.documents;
CREATE POLICY "documents_delete_member_or_super"
ON public.documents FOR DELETE
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));
