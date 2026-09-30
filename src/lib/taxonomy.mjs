// Sdílené číselníky – používá je importní skript i web.

export const CATEGORIES = [
  { slug: 'zubar', name: 'Zubní lékař', plural: 'Zubní lékaři', short: 'Zubař', desc: 'Prohlídky, plomby, korunky a běžná péče o chrup.' },
  { slug: 'dentalni-hygiena', name: 'Dentální hygiena', plural: 'Dentální hygiena', short: 'Hygiena', desc: 'Profesionální čištění zubů, odstranění zubního kamene a prevence.' },
  { slug: 'ortodoncie', name: 'Ortodoncie', plural: 'Ortodontisté', short: 'Ortodoncie', desc: 'Rovnátka a léčba nesprávného skusu u dětí i dospělých.' },
  { slug: 'chirurgie', name: 'Zubní a orální chirurgie', plural: 'Zubní chirurgové', short: 'Chirurgie', desc: 'Složité extrakce, zuby moudrosti, zákroky v ústní dutině.' },
  { slug: 'parodontologie', name: 'Parodontologie', plural: 'Parodontologové', short: 'Parodontologie', desc: 'Léčba zánětů dásní a parodontózy.' },
  { slug: 'detska-stomatologie', name: 'Dětská stomatologie', plural: 'Dětští zubaři', short: 'Pro děti', desc: 'Zubní péče přizpůsobená dětem.' },
  { slug: 'implantologie', name: 'Implantologie', plural: 'Implantologie', short: 'Implantáty', desc: 'Náhrada chybějících zubů zubními implantáty.' },
];
export const CATEGORY_BY_SLUG = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

// Mapování textu oborů z NRPZS / exportu na naše kategorie.
const CATEGORY_PATTERNS = [
  ['dentalni-hygiena', /hygien/],
  ['ortodoncie', /ortodon/],
  ['chirurgie', /chirurg|maxilofac/],
  ['parodontologie', /parodont/],
  ['detska-stomatologie', /d[eě]tsk|pedostom|pedodon/],
  ['implantologie', /implant/],
  ['zubar', /zubn[ií] l[eé]ka|stomatolog|zub[aá]ř|protetik|zubn[ií] ordinace|^zubar$|zubni-lekar/],
];

export function categoriesFromText(text) {
  const t = String(text || '').toLowerCase();
  const out = new Set();
  for (const [slug, re] of CATEGORY_PATTERNS) if (re.test(t)) out.add(slug);
  return [...out];
}

// Pořadí, podle kterého se určí hlavní kategorie ordinace.
export const PRIMARY_ORDER = ['zubar', 'ortodoncie', 'chirurgie', 'parodontologie', 'detska-stomatologie', 'implantologie', 'dentalni-hygiena'];

export const INSURERS = [
  { code: '111', short: 'VZP', name: 'Všeobecná zdravotní pojišťovna' },
  { code: '201', short: 'VoZP', name: 'Vojenská zdravotní pojišťovna' },
  { code: '205', short: 'ČPZP', name: 'Česká průmyslová zdravotní pojišťovna' },
  { code: '207', short: 'OZP', name: 'Oborová zdravotní pojišťovna' },
  { code: '209', short: 'ZPŠ', name: 'Zaměstnanecká pojišťovna Škoda' },
  { code: '211', short: 'ZPMV', name: 'Zdravotní pojišťovna ministerstva vnitra' },
  { code: '213', short: 'RBP', name: 'RBP, zdravotní pojišťovna' },
];
export const INSURER_BY_CODE = Object.fromEntries(INSURERS.map((i) => [i.code, i]));

export const NEW_PATIENTS = {
  ano: { label: 'Bere nové pacienty', tone: 'yes' },
  omezene: { label: 'Nové pacienty bere omezeně', tone: 'limited' },
  ne: { label: 'Nové pacienty nebere', tone: 'no' },
};

// Části Ostravy podle PSČ (přibližné – dodávací pošta nekopíruje přesně hranice obvodů).
export const OSTRAVA_PARTS_BY_ZIP = {
  '70030': 'Ostrava-Jih', '70044': 'Ostrava-Jih', '70200': 'Moravská Ostrava a Přívoz', '70300': 'Vítkovice',
  '70800': 'Poruba', '70900': 'Mariánské Hory a Hulváky', '71000': 'Slezská Ostrava', '71100': 'Slezská Ostrava',
  '71200': 'Slezská Ostrava', '71300': 'Slezská Ostrava', '71500': 'Michálkovice', '71600': 'Radvanice a Bartovice',
  '71700': 'Radvanice a Bartovice', '71800': 'Slezská Ostrava', '71900': 'Slezská Ostrava', '72000': 'Hrabová',
  '72100': 'Svinov', '72200': 'Třebovice', '72300': 'Martinov', '72400': 'Nová Bělá a Stará Bělá',
  '72525': 'Polanka nad Odrou', '72526': 'Krásné Pole', '72527': 'Plesná', '72528': 'Lhotka', '72529': 'Petřkovice',
};

export function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' a ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

export function formatZip(z) {
  const d = String(z || '').replace(/\D/g, '');
  return d.length === 5 ? `${d.slice(0, 3)} ${d.slice(3)}` : String(z || '').trim();
}

export function formatPhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('00420')) d = '+420' + d.slice(5);
  if (/^\d{9}$/.test(d)) d = '+420' + d;
  const m = d.match(/^\+420(\d{3})(\d{3})(\d{3})$/);
  return m ? `+420 ${m[1]} ${m[2]} ${m[3]}` : d;
}

// Česká skloňování počtu: 1 ordinace, 2 ordinace, 5 ordinací
export function plural(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

// „v Ostravě", „ve Frýdku-Místku" – pro nadpisy a texty. Neznámá města: „v obci X".
const LOCATIVE = {
  'Ostrava': 'v Ostravě', 'Frýdek-Místek': 've Frýdku-Místku', 'Opava': 'v Opavě', 'Havířov': 'v Havířově',
  'Nový Jičín': 'v Novém Jičíně', 'Karviná': 'v Karviné', 'Třinec': 'v Třinci', 'Český Těšín': 'v Českém Těšíně',
  'Kopřivnice': 'v Kopřivnici', 'Krnov': 'v Krnově', 'Orlová': 'v Orlové', 'Frýdlant nad Ostravicí': 've Frýdlantu nad Ostravicí',
  'Bohumín': 'v Bohumíně', 'Bruntál': 'v Bruntále', 'Studénka': 've Studénce', 'Hlučín': 'v Hlučíně', 'Bílovec': 'v Bílovci',
  'Příbor': 'v Příboře', 'Frenštát pod Radhoštěm': 've Frenštátu pod Radhoštěm', 'Rýmařov': 'v Rýmařově', 'Vítkov': 've Vítkově',
  'Fulnek': 've Fulneku', 'Odry': 'v Odrách', 'Kravaře': 'v Kravařích', 'Jablunkov': 'v Jablunkově', 'Petřvald': 'v Petřvaldu',
  'Rychvald': 'v Rychvaldu', 'Šenov': 'v Šenově', 'Klimkovice': 'v Klimkovicích', 'Štramberk': 've Štramberku',
  'Hradec nad Moravicí': 'v Hradci nad Moravicí', 'Kopřivnice ': 'v Kopřivnici', 'Stonava': 've Stonavě', 'Doubrava': 'v Doubravě',
  'Albrechtice': 'v Albrechticích', 'Dolní Lutyně': 'v Dolní Lutyni', 'Třanovice': 'v Třanovicích', 'Brušperk': 'v Brušperku',
  'Paskov': 'v Paskově', 'Místek': 'v Místku', 'Štěpánkovice': 've Štěpánkovicích', 'Kylešovice': 'v Kylešovicích',
  'Budišov nad Budišovkou': 'v Budišově nad Budišovkou', 'Vratimov': 've Vratimově', 'Šenov u Nového Jičína': 'v Šenově u Nového Jičína',
  'Poruba': 'v Porubě', 'Ostrava-Jih': 'v Ostravě-Jihu', 'Moravská Ostrava a Přívoz': 'v Moravské Ostravě a Přívozu',
  'Vítkovice': 've Vítkovicích', 'Mariánské Hory a Hulváky': 'v Mariánských Horách a Hulvákách', 'Slezská Ostrava': 've Slezské Ostravě',
  'Michálkovice': 'v Michálkovicích', 'Radvanice a Bartovice': 'v Radvanicích a Bartovicích', 'Hrabová': 'v Hrabové', 'Svinov': 've Svinově',
  'Třebovice': 'v Třebovicích', 'Martinov': 'v Martinově', 'Nová Bělá a Stará Bělá': 'v Nové Bělé a Staré Bělé',
  'Polanka nad Odrou': 'v Polance nad Odrou', 'Krásné Pole': 'v Krásném Poli', 'Plesná': 'v Plesné', 'Lhotka': 'v Lhotce', 'Petřkovice': 'v Petřkovicích',
};
export function locative(name) {
  return LOCATIVE[name] ?? `v obci ${name}`;
}
