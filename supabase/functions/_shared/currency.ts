// _shared/currency.ts
//
// The platform's plans are priced in USD (see src/lib/plans.ts: Starter $19,
// Pro $39, Premium $69, Enterprise $299 — these are the single source of
// truth for what a customer owes). Every payment provider integration must
// convert that USD amount to whatever currency it actually charges in,
// using REAL, live exchange rates — never a stale or hardcoded rate table,
// and never silently charging the raw USD number in a different currency
// (that was a real bug found and fixed this session: PayUnit was being
// told to charge e.g. "19 XAF" instead of the XAF equivalent of $19).
//
// Rate source: open.er-api.com — a free, no-API-key exchange rate service
// covering ~160 currencies, updated daily. Results are cached in-memory
// per edge function instance for a short window to avoid hammering the
// API on every checkout click; a fresh fetch always happens if the cache
// is empty or stale.

type RateTable = { base: string; rates: Record<string, number>; fetchedAt: number };

let cache: RateTable | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — rates don't need to be
                                       // more real-time than that for billing.

async function getRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) {
    throw new Error(`Exchange rate service returned HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.result !== "success" || !json.rates) {
    throw new Error("Exchange rate service returned an unexpected response");
  }
  cache = { base: "USD", rates: json.rates, fetchedAt: Date.now() };
  return cache.rates;
}

/**
 * Converts a USD amount to the target currency using a live exchange rate.
 * Returns the amount rounded to 2 decimal places (or to a whole unit for
 * currencies that don't use minor units, e.g. XAF/XOF/JPY — those are
 * conventionally not decimalized, so we round to the nearest whole unit).
 *
 * Throws if the target currency isn't found in the live rate table or if
 * the rate service is unreachable — callers MUST treat that as a hard
 * failure (return an error to the client) rather than falling back to a
 * guessed or stale rate, since an incorrect conversion means charging the
 * wrong amount of real money.
 */
export async function convertFromUsd(usdAmount: number, targetCurrency: string): Promise<number> {
  const currency = targetCurrency.toUpperCase();
  if (currency === "USD") return usdAmount;

  const rates = await getRates();
  const rate = rates[currency];
  if (!rate) {
    throw new Error(`No live exchange rate available for currency "${currency}"`);
  }

  const ZERO_DECIMAL_CURRENCIES = new Set(["XAF", "XOF", "JPY", "KRW", "VND", "CLP", "PYG", "UGX", "RWF", "GNF", "BIF", "DJF", "KMF", "MGA", "XPF"]);
  const converted = usdAmount * rate;
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? Math.round(converted) : Math.round(converted * 100) / 100;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export const PLAN_PRICES_USD: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 19, yearly: 190 },
  pro: { monthly: 39, yearly: 390 },
  premium: { monthly: 69, yearly: 690 },
  enterprise: { monthly: 299, yearly: 2990 },
};
