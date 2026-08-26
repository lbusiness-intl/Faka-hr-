/*
# Real PayUnit billing: transactions table + invoice column

Supports the new create-payunit-checkout / payunit-webhook edge functions.
See those functions' source comments for the full security rationale —
PayUnit's API has no documented webhook signature scheme, so
payunit_transactions is the anchor record the webhook checks an inbound
notification against before ever confirming a transaction server-to-server
with PayUnit's own status endpoint.
*/

CREATE TABLE IF NOT EXISTS public.payunit_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_id text NOT NULL UNIQUE,
  checkout_id   text,
  plan          text NOT NULL,
  interval      text NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly','yearly')),
  amount        numeric(14,2) NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'XAF',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','cancelled')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payunit_transactions ENABLE ROW LEVEL SECURITY;

-- Written only by our own edge functions (service role, bypasses RLS).
-- Tenant admins may read their own transactions for support/troubleshooting.
DROP POLICY IF EXISTS "payunit_txn_select" ON public.payunit_transactions;
CREATE POLICY "payunit_txn_select"
ON public.payunit_transactions FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payunit_transaction_id text;
