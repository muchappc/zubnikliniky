// Platby prémiového profilu přes Stripe (předplatné, karta se strhává automaticky).
import Stripe from 'stripe';
import { HttpError } from './server';

const env = (k: string) => process.env[k] ?? (import.meta.env as any)[k] ?? '';

let _stripe: Stripe | null = null;
export function stripe() {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) throw new HttpError(503, 'Platby zatím nejsou nastavené. Napište mi prosím na leady@zubnikliniky.cz.');
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}
export const webhookSecret = () => env('STRIPE_WEBHOOK_SECRET');

// Ceny v haléřích. Provozovatel není plátce DPH, ceny jsou konečné.
export const PLANS = {
  mesicni: { label: 'měsíčně', amount: 99000, interval: 'month' as const, text: '990 Kč měsíčně' },
  rocni: { label: 'ročně', amount: 990000, interval: 'year' as const, text: '9 900 Kč ročně' },
};
export type Plan = keyof typeof PLANS;
export const isPlan = (p: unknown): p is Plan => typeof p === 'string' && p in PLANS;

// Konec aktuálního zaplaceného období (od API 2025-03 je na položkách předplatného).
export function periodEnd(sub: Stripe.Subscription): string | null {
  const ts = Math.max(0, ...sub.items.data.map((i) => i.current_period_end ?? 0));
  return ts ? new Date(ts * 1000).toISOString() : null;
}

// Prémium je aktivní, dokud je předplatné zaplacené (při selhání platby Stripe ještě několikrát zkouší – past_due necháme běžet).
export const isActiveStatus = (s: string) => s === 'active' || s === 'trialing' || s === 'past_due';
