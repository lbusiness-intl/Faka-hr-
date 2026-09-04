/*
# Paddle billing: identifier columns, mirroring the existing Stripe pattern

Paddle Billing issues its own customer and subscription identifiers,
exactly like Stripe does — so this follows migration 0016's Stripe
pattern rather than PayUnit's "anchor record" one: the paddle-webhook
edge function (server-side, signature-verified) is the only writer of
these columns, same as stripe-webhook already is for its own.
*/

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paddle_transaction_id text;
