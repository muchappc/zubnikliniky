// Popis webu pro AI vyhledávače a asistenty (llmstxt.org).
import { getKraje, getCities, getCategoryCounts, getClinics } from '../lib/data';
import { SITE } from '../lib/site';
import { GROUPS } from '../lib/groups';

export async function GET() {
  const [kraje, cities, cats, all] = await Promise.all([getKraje(), getCities(), getCategoryCounts(), getClinics()]);
  const u = SITE.url;
  const txt = `# ${SITE.name}

> Katalog všech ${all.length} zubních ordinací, klinik, dentálních hygien a ortodontistů v České republice. U ordinací uvádí, zda berou nové pacienty, smluvní pojišťovny a recenze pacientů. Data vycházejí z Národního registru poskytovatelů zdravotních služeb (aktualizace každý měsíc), informace o přijímání pacientů se ověřují u pacientů a ordinací.

Provozovatel: ${SITE.operatorDetails}. Kontakt: ${SITE.contactEmail}.

## Jak web používat
- Vyhledávání podle jména, města, kraje, oboru a pojišťovny: ${u}/hledat?q=DOTAZ (parametry kraj, mesto, obor, pojistovna, nove=1)
- Profil ordinace: ${u}/zubar/{slug} – adresa, obory, stav příjmu nových pacientů s datem ověření, pojišťovny, recenze, poptávka termínu
- Strojově čitelný seznam všech ordinací: ${u}/index.json

## Kraje
${kraje.map((k) => `- [Zubaři ${k.loc}](${u}/kraj/${k.slug}): ${k.count} ordinací`).join('\n')}

## Největší města
${cities.slice(0, 40).map((c) => `- [Zubaři ${c.name}](${u}/mesto/${c.slug}): ${c.count} ordinací`).join('\n')}

## Obory
${cats.map((c) => `- [${c.name}](${u}/obor/${c.slug}): ${c.count} ordinací`).join('\n')}

## Komunita
${GROUPS.map((g) => `- [${g.name}](${g.url}) – ${g.kraj}`).join('\n')}

## Další stránky
- [Jak web funguje](${u}/o-nas)
- [Pro zubaře](${u}/pro-zubare)
- [Facebookové skupiny Hledám zubaře](${u}/skupiny)
`;
  return new Response(txt, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
