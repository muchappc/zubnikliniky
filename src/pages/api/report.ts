import { handler, json, db, str, email, isUuid, sendMail, adminEmail, siteUrl, HttpError } from '../../lib/server';
export const prerender = false;

export const POST = handler(async (b) => {
  const kind = b.kind === 'review' ? 'review' : 'data';
  const message = str(b.message, { min: 5, max: 3000, name: 'Zpráva' });
  const mail = email(b.email, false);
  const clinic_id = isUuid(b.clinic_id) ? b.clinic_id : null;
  const review_id = isUuid(b.review_id) ? b.review_id : null;
  if (kind === 'review' && !review_id) throw new HttpError(400, 'Neznámá recenze.');
  const { error } = await db().from('reports').insert({ kind, clinic_id, review_id, message, email: mail || null });
  if (error) throw error;
  let name = '';
  if (clinic_id) name = (await db().from('clinics').select('display_name, slug').eq('id', clinic_id).maybeSingle()).data?.display_name ?? '';
  if (adminEmail()) await sendMail({
    to: adminEmail(), replyTo: mail || undefined,
    subject: kind === 'review' ? `Nahlášená recenze – ${name}` : name ? `Oprava údajů – ${name}` : 'Zpráva z kontaktního formuláře',
    text: `${message}\n\nOd: ${mail || 'neuvedeno'}\nAdministrace: ${siteUrl()}/admin#hlaseni`,
  });
  return json({ ok: true, message: kind === 'review' ? 'Díky, recenzi posoudíme.' : 'Díky, zprávu máme a údaje prověříme.' });
});
