// Založení platby prémiového profilu: vrátí adresu platební stránky Stripe (Checkout).
import { handler, json, db, email, str, siteUrl, HttpError } from '../../lib/server';
import { stripe, PLANS, isPlan, type Plan } from '../../lib/stripe';
export const prerender = false;

export const POST = handler(async (b) => {
  if (!b.terms) throw new HttpError(400, 'Pro objednání je potřeba souhlasit s obchodními podmínkami.');
  const plan: Plan = isPlan(b.plan) ? b.plan : 'mesicni';
  const mail = email(b.email);
  const slug = str(b.clinic_slug, { min: 1, max: 200, name: 'Ordinace' });
  const { data: clinic } = await db().from('clinics').select('id, slug, display_name, street, city').eq('slug', slug).maybeSingle();
  if (!clinic) throw new HttpError(400, 'Vyberte prosím ordinaci ze seznamu.');

  const { data: running } = await db().from('subscriptions').select('id')
    .eq('clinic_id', clinic.id).in('status', ['active', 'trialing', 'past_due']).limit(1);
  if (running?.length) throw new HttpError(409, 'Tato ordinace už prémiový profil má. Pro změnu platby mi napište na leady@zubnikliniky.cz.');

  const p = PLANS[plan];
  const meta = { clinic_id: clinic.id, clinic_slug: clinic.slug, plan };
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    locale: 'cs',
    customer_email: mail,
    client_reference_id: clinic.id,
    metadata: meta,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'czk',
        unit_amount: p.amount,
        recurring: { interval: p.interval },
        product_data: { name: `Prémiový profil zubnikliniky.cz – ${clinic.display_name}`, metadata: { clinic_id: clinic.id } },
      },
    }],
    subscription_data: {
      metadata: meta,
      description: `Prémiový profil: ${clinic.display_name}, ${clinic.street}, ${clinic.city}`,
    },
    billing_address_collection: 'required',
    name_collection: { business: { enabled: true } },
    tax_id_collection: { enabled: true },
    custom_fields: [{
      key: 'ico', type: 'numeric', optional: true,
      label: { type: 'custom', custom: 'IČO' },
      numeric: { minimum_length: 8, maximum_length: 8 },
    }],
    custom_text: {
      submit: { message: `Platba se bude automaticky opakovat (${p.text}). Předplatné můžete kdykoli zrušit, profil pak běží do konce zaplaceného období.` },
    },
    allow_promotion_codes: true,
    success_url: `${siteUrl()}/pro-zubare/objednano?ordinace=${encodeURIComponent(clinic.slug)}`,
    cancel_url: `${siteUrl()}/pro-zubare?ordinace=${encodeURIComponent(clinic.slug)}#objednat`,
  });
  return json({ ok: true, url: session.url });
});
