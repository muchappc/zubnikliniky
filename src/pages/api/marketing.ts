import { handler, json, str, email, sendMail, adminEmail, HttpError } from '../../lib/server';
export const prerender = false;

// Zájem o marketing (reklamy) z landing page s případovou studií. Neukládá se do databáze, jen přijde e-mail.
export const POST = handler(async (b) => {
  const clinic_name = str(b.clinic_name, { min: 3, max: 200, name: 'Ordinace' });
  const contact_name = str(b.contact_name, { min: 3, max: 100, name: 'Jméno' });
  const mail = email(b.email);
  const phone = str(b.phone, { max: 30, name: 'Telefon' });
  const message = str(b.message, { max: 4000, name: 'Zpráva' });
  const source = str(b.source, { max: 60, name: 'Zdroj' }) || 'web';
  if (!adminEmail().length) throw new HttpError(503, 'Formulář zatím není nastavený. Napište mi prosím e-mailem.');
  await sendMail({
    to: adminEmail(), replyTo: mail,
    subject: `Zájem o marketing (${source}): ${clinic_name}`,
    text: `${contact_name}\n${mail}\n${phone}\n\nOrdinace: ${clinic_name}\n\n${message}`,
  });
  await sendMail({ to: mail, subject: 'Vaši zprávu mám – zubnikliniky.cz', text: `Dobrý den,\n\nděkuji za zprávu ohledně ordinace ${clinic_name}. Ozvu se vám do dvou pracovních dnů.\n\nMartin Mucha\nzubnikliniky.cz` });
  return json({ ok: true, message: 'Děkuji, zprávu mám. Ozvu se vám do dvou pracovních dnů.' });
});
