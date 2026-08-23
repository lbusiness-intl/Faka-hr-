/*
# Real Stripe billing: add missing columns

Required for the new create-checkout-session / stripe-webhook edge
functions, which replace the previous "simulated checkout" flow (see
those functions' source comments for the full context — the old flow
let any signed-in user grant their own tenant a paid plan for free by
calling the webhook endpoint directly from the browser, with zero
signature verification and zero real payment).
*/

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE INDEX IF NOT EXISTS tenants_stripe_customer_id_idx ON public.tenants (stripe_customer_id);
