import { handler, json, db, getClinic, str, email, hash, sendMail, adminEmail, siteUrl, HttpError } from '../../lib/server';
import { INSURER_BY_CODE } from '../../lib/taxonomy.mjs';
export const prerender = false;

const TYPES: Record<string, string> = {
  'novy-dospely': 'Registrace nového pacienta (dospělý)', 'novy-dite': 'Registrace dítěte',
  jednorazove: 'Jednorázové ošetření / bolest', hygiena: 'Dentální hygiena', jine: 'Jiné',
};

export const POST = handler(async (b, { ip }) => {
  const c = await getClinic(b.clinic_id);
  const name = str(b.name, { min: 3, max: 100, name: 'Jméno' });
  const phone = str(b.phone, { min: 9, max: 30, name: 'Telefon' });
  const mail = email(b.email);
  const message = str(b.message, { max: 2000, name: 'Zpráva' });
  const type = TYPES[b.patient_type] ?? 'Jiné';
  const ins = INSURER_BY_CODE[b.insurer] ? `${INSURER_BY_CODE[b.insurer].short} (${b.insurer})` : 'neuvedeno / samoplátce';
  if (!b.consent) throw new HttpError(400, 'Pro odeslání potřebujeme váš souhlas s předáním údajů ordinaci.');
  const ih = ip ? hash(ip) : null;
  if (ih) {
    const { count } = await db().from('inquiries').select('id', { count: 'exact', head: true }).eq('ip_hash', ih).gte('created_at', new Date(Date.now() - 3600e3).toISOString());
    if ((count ?? 0) >= 5) throw new HttpError(429, 'Odeslali jste hodně poptávek najednou. Zkuste to prosím za hodinu.');
  }

  const direct = c.premium && c.email;
  const body = `Poptávka z webu zubnikliniky.cz\n\nOrdinace: ${c.display_name}\nTyp: ${type}\nJméno: ${name}\nTelefon: ${phone}\nE-mail: ${mail}\nPojišťovna: ${ins}\n\n${message || '(bez zprávy)'}\n\nProfil: ${siteUrl()}/zubar/${c.slug}`;
  const { error } = await db().from('inquiries').insert({
    clinic_id: c.id, name, phone, email: mail, insurer: b.insurer || null, patient_type: b.patient_type, message,
    forwarded_to: direct ? c.email : null, status: direct ? 'forwarded' : 'new', ip_hash: ih,
  });
  if (error) throw error;
  await db().rpc('track_event', { p_clinic: c.id, p_kind: 'inquiry' });

  if (direct) {
    await sendMail({ to: c.email, replyTo: mail, subject: `Nový pacient: ${type} – ${name}`, text: `${body}\n\nNa tento e-mail můžete rovnou odpovědět – odpověď půjde pacientovi.` });
  }
  if (adminEmail()) await sendMail({ to: adminEmail(), replyTo: mail, subject: `${direct ? '[předáno] ' : '[PŘEDAT] '}Poptávka – ${c.display_name}`, text: body });
  await sendMail({
    to: mail,
    subject: `Poptávka odeslána: ${c.display_name}`,
    text: `Dobrý den,\n\nvaši poptávku pro ordinaci ${c.display_name} jsme přijali${direct ? ' a předali ji ordinaci' : ' a předáme ji ordinaci'}. Ordinace se vám ozve na telefon ${phone} nebo e-mail. O přijetí rozhoduje vždy ordinace.\n\nPokud spěcháte, zkuste ordinaci zavolat přímo – kontakt najdete na ${siteUrl()}/zubar/${c.slug}\n\nzubnikliniky.cz`,
  });
  return json({ ok: true, message: direct ? 'Hotovo, poptávku jsme poslali ordinaci. Potvrzení najdete v e-mailu.' : 'Hotovo, poptávku jsme přijali a předáme ji ordinaci. Potvrzení najdete v e-mailu.' });
});
