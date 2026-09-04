// Paddle.js loader + checkout helper.
//
// This uses ONLY the Paddle client-side token (safe to ship in frontend
// code by design — it is not a secret, unlike a server-side API key).
// Opening a checkout from here does not, by itself, update anything in
// our database: Paddle confirms the transaction, then notifies us via a
// server-side webhook. That webhook (see supabase/functions/paddle-webhook)
// needs the Paddle API key and webhook signing secret configured as
// Supabase Edge Function secrets — those are NOT client tokens and must
// never be placed in frontend code or in this file.

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: { token: string; eventCallback?: (event: { name: string; data?: unknown }) => void }) => void;
      Environment: { set: (env: 'sandbox' | 'production') => void };
      Checkout: {
        open: (opts: {
          items: { priceId: string; quantity?: number }[];
          customer?: { email?: string };
          customData?: Record<string, string>;
          settings?: { successUrl?: string };
        }) => void;
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

function loadPaddleScript(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (window.Paddle) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PADDLE_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const isPaddleConfigured = Boolean(import.meta.env.VITE_PADDLE_CLIENT_TOKEN);

let initialized = false;

async function ensurePaddleReady(): Promise<void> {
  await loadPaddleScript();
  if (!window.Paddle) throw new Error('PADDLE_NOT_LOADED');
  if (!initialized) {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    if (!token) throw new Error('PADDLE_NOT_CONFIGURED');
    window.Paddle.Initialize({ token });
    initialized = true;
  }
}

// priceId must be a real Paddle Price ID (e.g. "pri_01h...") created in
// the Paddle dashboard for the plan being purchased. There is no way to
// derive this from our own `plan` id automatically — it has to be
// configured per plan. See VITE_PADDLE_PRICE_* env vars.
export async function openPaddleCheckout(opts: {
  priceId: string;
  tenantId: string;
  customerEmail?: string;
  successUrl?: string;
}): Promise<void> {
  await ensurePaddleReady();
  window.Paddle!.Checkout.open({
    items: [{ priceId: opts.priceId, quantity: 1 }],
    customer: opts.customerEmail ? { email: opts.customerEmail } : undefined,
    customData: { tenant_id: opts.tenantId },
    settings: opts.successUrl ? { successUrl: opts.successUrl } : undefined,
  });
}

// Maps our internal plan ids to Paddle Price IDs, read from env vars so
// nothing is hardcoded. Fill these in once the plans exist in the Paddle
// dashboard (Catalog > Prices) — until then, checkout for a plan without
// a configured price ID is refused rather than silently charging the
// wrong amount.
export function paddlePriceIdForPlan(plan: string): string | null {
  const map: Record<string, string | undefined> = {
    starter: import.meta.env.VITE_PADDLE_PRICE_STARTER,
    pro: import.meta.env.VITE_PADDLE_PRICE_PRO,
    premium: import.meta.env.VITE_PADDLE_PRICE_PREMIUM,
    enterprise: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE,
  };
  return map[plan] ?? null;
}
