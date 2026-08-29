/*
# Multi-PSP billing: real currency conversion tracking + Paystack/Flutterwave

The platform's plans are priced in USD (src/lib/plans.ts). Every payment
provider integration converts that USD price to the customer's currency
using a REAL, live exchange rate (see supabase/functions/_shared/currency.ts)
before charging — never the raw USD number sent as-is in a different
currency. This migration:

  1. Adds `amount_usd` to payunit_transactions so the USD reference price
     is preserved alongside the actually-charged local amount, for
     support/audit purposes.
  2. Creates paystack_transactions and flutterwave_transactions, mirroring
     the same "anchor record + server-to-server confirmation" pattern
     already used for PayUnit — even though Paystack and Flutterwave DO
     provide real webhook signatures (unlike PayUnit), so those two also
     get the extra safety of only ever activating a subscription for a
     transaction_id/tx_ref this platform itself created.
*/

ALTER TABLE public.payunit_transactions
  ADD COLUMN IF NOT EXISTS amount_usd numeric(14,2);

CREATE TABLE IF NOT EXISTS public.paystack_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference     text NOT NULL UNIQUE,
  plan          text NOT NULL,
  interval      text NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly','yearly')),
  amount        numeric(14,2) NOT NULL DEFAULT 0,
  amount_usd    numeric(14,2),
  currency      text NOT NULL DEFAULT 'NGN',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','cancelled')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paystack_txn_select" ON public.paystack_transactions;
CREATE POLICY "paystack_txn_select"
ON public.paystack_transactions FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

CREATE TABLE IF NOT EXISTS public.flutterwave_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tx_ref        text NOT NULL UNIQUE,
  plan          text NOT NULL,
  interval      text NOT NULL DEFAULT 'monthly' CHECK (interval IN ('monthly','yearly')),
  amount        numeric(14,2) NOT NULL DEFAULT 0,
  amount_usd    numeric(14,2),
  currency      text NOT NULL DEFAULT 'NGN',
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','cancelled')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flutterwave_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flutterwave_txn_select" ON public.flutterwave_transactions;
CREATE POLICY "flutterwave_txn_select"
ON public.flutterwave_transactions FOR SELECT
TO authenticated
USING (public.is_super_admin() OR public.is_admin_like_member(tenant_id));

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS flutterwave_tx_ref text,
  ADD COLUMN IF NOT EXISTS amount_usd numeric(14,2);
