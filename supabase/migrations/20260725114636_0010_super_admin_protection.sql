-- Ensure all 4 super admin emails are marked as super_admin in the profiles/memberships
-- and protect webdxb1@gmail.com and liyahjoha@gmail.com from deletion.

-- Update tenant_memberships to super_admin for the 4 protected emails
UPDATE public.tenant_memberships
SET role = 'super_admin', status = 'active'
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'vincentnogue2@gmail.com',
    'vincentnogue@yahoo.com',
    'webdxb1@gmail.com',
    'liyahjoha@gmail.com'
  )
);

-- Create a function to check if a user email is a protected super admin
CREATE OR REPLACE FUNCTION public.is_protected_super_admin(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p_email IN (
    'vincentnogue2@gmail.com',
    'vincentnogue@yahoo.com',
    'webdxb1@gmail.com',
    'liyahjoha@gmail.com'
  );
$$;

-- Create a function to check if a user email is a non-deletable super admin
CREATE OR REPLACE FUNCTION public.is_non_deletable_admin(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p_email IN (
    'webdxb1@gmail.com',
    'liyahjoha@gmail.com'
  );
$$;

-- Add a trigger to prevent deletion of protected admin users from auth.users
-- (This is a safety net — the UI also prevents it)
CREATE OR REPLACE FUNCTION public.prevent_protected_admin_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_non_deletable_admin(OLD.email) THEN
    RAISE EXCEPTION 'Cannot delete protected super admin account: %', OLD.email;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_protected_admin_deletion ON auth.users;
CREATE TRIGGER prevent_protected_admin_deletion
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_protected_admin_deletion();

-- Ensure super_admin emails always have super_admin role on new membership inserts
CREATE OR REPLACE FUNCTION public.ensure_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.is_protected_super_admin(
    (SELECT email FROM auth.users WHERE id = NEW.user_id)
  ) THEN
    NEW.role := 'super_admin';
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_super_admin_role ON public.tenant_memberships;
CREATE TRIGGER ensure_super_admin_role
  BEFORE INSERT OR UPDATE ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_super_admin_role();
