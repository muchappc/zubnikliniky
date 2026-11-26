// Odkaz do zákaznického portálu Stripe (změna karty, faktury, zrušení předplatného).
// Odkaz posíláme e-mailem na adresu, se kterou bylo předplatné objednané – nikdo cizí se k němu nedostane.
import { handler, json, db, email, sendMail, siteUrl } from '../../lib/server';
import { stripe } from '../../lib/stripe';
export const prerender = false;

export const POST = handler(async (b) => {
  const mail = email(b.email);
  const ok = json({ ok: true, message: 'Pokud k této adrese evidujeme předplatné, poslal jsem na ni odkaz pro správu předplatného.' });
  const { data } = await db().from('subscriptions').select('stripe_customer_id').ilike('email', mail).order('created_at', { ascending: false }).limit(1);
  const customer = data?.[0]?.stripe_customer_id;
  if (!customer) return ok;
  const session = await stripe().billingPortal.sessions.create({ customer, locale: 'cs', return_url: `${siteUrl()}/pro-zubare` });
  await sendMail({
    to: mail,
    subject: 'Správa předplatného – zubnikliniky.cz',
    text: `Dobrý den,\n\nna tomto odkazu změníte platební kartu, stáhnete faktury nebo zrušíte předplatné prémiového profilu:\n\n${session.url}\n\nOdkaz je platný krátkou dobu. Když vyprší, vyžádejte si nový na ${siteUrl()}/pro-zubare/predplatne\n\nMartin Mucha\nzubnikliniky.cz`,
  });
  return ok;
});
