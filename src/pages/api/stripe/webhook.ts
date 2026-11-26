// Webhook ze Stripe: zapíná a vypíná prémiový profil podle stavu předplatného.
// Události v nastavení Stripe: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.paid, invoice.payment_failed.
import type Stripe from 'stripe';
import { db, sendMail, adminEmail, siteUrl, triggerRebuild } from '../../../lib/server';
import { stripe, webhookSecret, periodEnd, isActiveStatus, PLANS, isPlan } from '../../../lib/stripe';
export const prerender = false;

const text = (s: string, status = 200) => new Response(s, { status });

async function syncSubscription(sub: Stripe.Subscription, extra: Record<string, unknown> = {}) {
  const clinic_id = (sub.metadata?.clinic_id as string) || null;
  const plan = isPlan(sub.metadata?.plan) ? sub.metadata.plan : 'mesicni';
  const until = periodEnd(sub);
  const row = {
    clinic_id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    plan,
    status: sub.status,
    current_period_end: until,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  const { error } = await db().from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
  if (!clinic_id) return { changed: false, clinic: null, active: false };

  const active = isActiveStatus(sub.status);
  const { data: before } = await db().from('clinics').select('premium, display_name, slug').eq('id', clinic_id).maybeSingle();
  const { error: e2 } = await db().from('clinics').update({ premium: active, premium_until: active ? until : null, updated_at: new Date().toISOString() }).eq('id', clinic_id);
  if (e2) throw e2;
  return { changed: !!before && before.premium !== active, clinic: before, active };
}

export const POST = async ({ request }: { request: Request }) => {
  const secret = webhookSecret();
  if (!secret) return text('Webhook není nastavený', 503);
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(payload, request.headers.get('stripe-signature') ?? '', secret);
  } catch (e) {
    console.error('[stripe] neplatný podpis', e);
    return text('Neplatný podpis', 400);
  }

  // Každou událost zpracujeme jen jednou.
  const { error: dup } = await db().from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return text('Už zpracováno');

  try {
    const admin = adminEmail();
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode !== 'subscription' || !s.subscription) break;
        const sub = await stripe().subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        const ico = s.custom_fields?.find((f) => f.key === 'ico')?.numeric?.value ?? null;
        const company = s.collected_information?.business_name ?? s.customer_details?.name ?? null;
        const mail = s.customer_details?.email ?? s.customer_email ?? null;
        const r = await syncSubscription(sub, { email: mail, company, ico });
        const plan = isPlan(sub.metadata?.plan) ? PLANS[sub.metadata.plan].text : '';
        if (admin.length) await sendMail({
          to: admin, replyTo: mail ?? undefined,
          subject: `Nový prémiový profil: ${r.clinic?.display_name ?? 'neznámá ordinace'}`,
          text: `Zaplaceno předplatné (${plan}).\n\nOrdinace: ${r.clinic?.display_name ?? '?'}\nProfil: ${siteUrl()}/zubar/${r.clinic?.slug ?? ''}\nFirma: ${company ?? '-'}\nIČO: ${ico ?? '-'}\nE-mail: ${mail ?? '-'}\n\nPrémium je zapnuté a web se právě přestavuje. Vyžádej si od ordinace popis a fotky.`,
        });
        if (mail) await sendMail({
          to: mail, replyTo: admin[0],
          subject: 'Prémiový profil je aktivní – zubnikliniky.cz',
          text: `Dobrý den,\n\nděkuji za objednávku prémiového profilu pro ${r.clinic?.display_name ?? 'vaši ordinaci'} (${plan}). Profil je aktivní a během několika minut se na webu zobrazí telefon, e-mail a odkaz na váš web.\n\nPošlete mi prosím odpovědí na tento e-mail krátký popis ordinace (3–5 vět) a až 5 fotografií (recepce, ordinace, budova, tým). Doplním je do profilu.\n\nPoptávky pacientů vám teď budou chodit rovnou do e-mailu ordinace. Pokud je chcete posílat na jinou adresu, dejte mi vědět.\n\nFakturu a potvrzení platby posílá Stripe zvlášť. Kartu změníte nebo předplatné zrušíte na ${siteUrl()}/pro-zubare/predplatne\n\nS pozdravem\nMartin Mucha\nzubnikliniky.cz`,
        });
        await triggerRebuild();
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const r = await syncSubscription(sub);
        if (r.changed) {
          await triggerRebuild();
          if (!r.active && admin.length) await sendMail({
            to: admin, subject: `Prémium skončilo: ${r.clinic?.display_name ?? sub.id}`,
            text: `Předplatné ${sub.id} je ve stavu „${sub.status}“. Prémiový profil jsem vypnul.\nProfil: ${siteUrl()}/zubar/${r.clinic?.slug ?? ''}`,
          });
        }
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.parent?.subscription_details?.subscription;
        if (subId) await syncSubscription(await stripe().subscriptions.retrieve(typeof subId === 'string' ? subId : subId.id));
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.parent?.subscription_details?.subscription;
        const clinic = (inv.parent?.subscription_details?.metadata?.clinic_slug as string) || '';
        if (admin.length) await sendMail({
          to: admin,
          subject: `Neprošla platba za prémium${clinic ? `: ${clinic}` : ''}`,
          text: `Stripe nedokázal strhnout platbu ${(inv.amount_due / 100).toLocaleString('cs-CZ')} Kč (${inv.customer_email ?? ''}). Platbu zkusí automaticky znovu a zákazníkovi pošle výzvu k aktualizaci karty. Pokud se nepodaří ani na další pokusy, předplatné se zruší a prémium se vypne samo.\nPředplatné: ${typeof subId === 'string' ? subId : subId?.id ?? '-'}`,
        });
        break;
      }
    }
  } catch (e) {
    console.error('[stripe] chyba zpracování', event.type, e);
    // Smažeme záznam o události, aby ji Stripe mohl doručit znovu.
    await db().from('stripe_events').delete().eq('id', event.id);
    return text('Chyba', 500);
  }
  return text('OK');
};
