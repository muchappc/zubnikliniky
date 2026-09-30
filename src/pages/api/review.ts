import { handler, json, db, getClinic, str, email, hash, token, sendMail, siteUrl, adminEmail, HttpError } from '../../lib/server';
export const prerender = false;

export const POST = handler(async (b, { ip }) => {
  const clinic = await getClinic(b.clinic_id);
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Vyberte prosím hodnocení 1 až 5 hvězdiček.');
  const text = str(b.text, { min: 20, max: 3000, name: 'Text recenze' });
  const author = str(b.author_name, { min: 2, max: 60, name: 'Jméno' });
  const mail = email(b.email);
  if (!b.consent) throw new HttpError(400, 'Potvrďte prosím, že píšete o vlastní zkušenosti.');
  if (/https?:\/\/|www\./i.test(text)) throw new HttpError(400, 'Recenze nesmí obsahovat odkazy.');

  const eh = hash(mail), ih = ip ? hash(ip) : null;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db().from('reviews').select('id', { count: 'exact', head: true }).eq('email_hash', eh).gte('created_at', since);
  if ((count ?? 0) >= 3) throw new HttpError(429, 'Z tohoto e-mailu už byly dnes přidány 3 recenze. Zkuste to prosím zítra.');
  if (ih) {
    const { count: ic } = await db().from('reviews').select('id', { count: 'exact', head: true }).eq('ip_hash', ih).gte('created_at', since);
    if ((ic ?? 0) >= 10) throw new HttpError(429, 'Z tohoto připojení bylo dnes odesláno příliš mnoho recenzí.');
  }
  const { data: dup } = await db().from('reviews').select('id').eq('email_hash', eh).eq('clinic_id', clinic.id).neq('status', 'hidden').maybeSingle();
  if (dup) throw new HttpError(409, 'Na tuto ordinaci už jste recenzi napsali. Každý může hodnotit ordinaci jen jednou.');

  const t = token();
  const { error } = await db().from('reviews').insert({ clinic_id: clinic.id, author_name: author, email: mail, email_hash: eh, ip_hash: ih, rating, text, verify_token: t });
  if (error) throw error;

  const link = `${siteUrl()}/api/review/verify?token=${t}`;
  const sent = await sendMail({
    to: mail,
    subject: `Potvrďte recenzi: ${clinic.display_name}`,
    text: `Dobrý den,\n\nděkujeme za recenzi ordinace ${clinic.display_name}. Zveřejníme ji, jakmile ji potvrdíte kliknutím na tento odkaz (platí 7 dní):\n\n${link}\n\nPokud jste recenzi nepsali, e-mail ignorujte – nic se nezveřejní.\n\nzubnikliniky.cz`,
  });
  if (!sent) console.warn('Recenze uložena, ale ověřovací e-mail se neodeslal', clinic.id);
  if (adminEmail()) await sendMail({ to: adminEmail(), subject: `Nová recenze (${rating}★) – ${clinic.display_name}`, text: `${author}:\n${text}\n\nČeká na potvrzení e-mailem. Moderace: ${siteUrl()}/admin#recenze` });
  return json({ ok: true, message: 'Děkujeme! Poslali jsme vám e-mail s odkazem. Recenzi zveřejníme, až na něj kliknete.' });
});
