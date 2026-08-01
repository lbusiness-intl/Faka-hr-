/*
# Revoke anon role access — enforce authenticated-only access

## Why
This app requires authentication (sign-in screen). All RLS policies are scoped
to `TO authenticated` with `is_tenant_member()` checks. However, the `anon`
role still has full CRUD column grants on every table. While RLS policies
block anon users (they aren't tenant members), these grants are unnecessary
and violate least-privilege. We revoke all anon privileges and restrict
access to `authenticated` only.

## Changes
- Revoke ALL privileges from `anon` on every table in the public schema.
- Grant full CRUD to `authenticated` on all tables (RLS policies still enforce tenant isolation).
- No data changes, no schema changes, no policy changes.
*/

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', tbl);
  END LOOP;
END $$;