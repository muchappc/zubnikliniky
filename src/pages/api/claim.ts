import { handler, json, db, str, email, sendMail, adminEmail, siteUrl } from '../../lib/server';
export const prerender = false;

const LABEL: Record<string, string> = { udaje: 'Úprava údajů', premium: 'Prémiový profil', odpoved: 'Odpověď na recenzi' };

export const POST = handler(async (b) => {
  const clinic_name = str(b.clinic_name, { min: 3, max: 200, name: 'Ordinace' });
  const contact_name = str(b.contact_name, { min: 3, max: 100, name: 'Jméno' });
  const mail = email(b.email);
  const phone = str(b.phone, { max: 30, name: 'Telefon' });
  const interest = LABEL[b.interest] ? b.interest : 'udaje';
  const message = str([b.role ? `Role: ${b.role}` : '', b.message].filter(Boolean).join('\n'), { max: 4000, name: 'Zpráva' });
  let clinic_id: string | null = null, slug = '';
  if (typeof b.clinic_slug === 'string' && b.clinic_slug) {
    const { data } = await db().from('clinics').select('id, slug').eq('slug', b.clinic_slug).maybeSingle();
    clinic_id = data?.id ?? null; slug = data?.slug ?? '';
  }
  const { error } = await db().from('claims').insert({ clinic_id, clinic_name, contact_name, email: mail, phone, interest, message });
  if (error) throw error;
  if (adminEmail()) await sendMail({
    to: adminEmail(), replyTo: mail,
    subject: `${LABEL[interest]}: ${clinic_name}`,
    text: `${contact_name}\n${mail}\n${phone}\n\n${message}\n\n${slug ? `Profil: ${siteUrl()}/zubar/${slug}\n` : ''}Administrace: ${siteUrl()}/admin#zadosti`,
  });
  await sendMail({ to: mail, subject: 'Vaši žádost jsme přijali – zubnikliniky.cz', text: `Dobrý den,\n\nděkujeme, žádost (${LABEL[interest].toLowerCase()}) pro ${clinic_name} jsme přijali. Ozveme se vám do dvou pracovních dnů.\n\nzubnikliniky.cz` });
  return json({ ok: true, message: 'Děkujeme, žádost máme. Ozveme se vám do dvou pracovních dnů.' });
});
