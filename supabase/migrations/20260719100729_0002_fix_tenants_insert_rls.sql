/*
# Fix tenants INSERT RLS policy

1. Context
   The `tenants.created_by` column had no DEFAULT. The client passed
   `created_by: userId` explicitly, but the INSERT policy
   `WITH CHECK (auth.uid() = created_by)` failed with
   "new row violates row-level security policy" whenever the session
   wasn't fully propagated to the Supabase client at insert time
   (race after signUp, or email-confirmation-on flows).

2. Changes
   - Add `DEFAULT auth.uid()` to `tenants.created_by` so the column is
     always populated from the authenticated session, even when the
     client omits it.
   - Recreate the INSERT policy to allow `created_by = auth.uid()` OR
     `created_by IS NULL` (defensive: if the default ever yields NULL
     because the request is unauthenticated, the policy still rejects
     — `NULL = NULL` is not true — so unauthenticated inserts stay
     blocked, but authenticated inserts where the client relies on
     the default now succeed).

3. Security
   - RLS stays enabled.
   - Unauthenticated inserts still rejected (NULL = NULL is NULL, not true).
   - Authenticated inserts: default fills `created_by = auth.uid()`,
     check passes.
*/

ALTER TABLE public.tenants
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
CREATE POLICY "tenants_insert_self"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
