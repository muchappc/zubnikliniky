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

// Mapování oborů z NRPZS na naše kategorie. Porovnává se každý obor zvlášť a jen zubní obory –
// nemocnice mají v registru desítky jiných oborů (obecná „chirurgie", „dětská chirurgie"…), ty ignorujeme.
const CATEGORY_PATTERNS = [
  ['dentalni-hygiena', /dent[aá]ln[ií] hygien/],
  ['ortodoncie', /^ortodoncie$/],
  ['chirurgie', /or[aá]ln[ií] a maxilofaci[aá]ln[ií] chirurgie|stomatochirurgie|dentoalveol[aá]rn[ií] chirurgie|zubn[ií] chirurgie|orální chirurgie/],
  ['parodontologie', /parodontolog/],
  ['detska-stomatologie', /d[eě]tsk[aá] stomatologie|pedostomatolog|d[eě]tsk[ée] zubn/],
  ['implantologie', /implantolog/],
  ['zubar', /zubn[ií] l[eé]ka[rř]stv[ií]|stomatologie|zubn[ií] l[eé]ka[rř]|zub[aá][rř]|^zubar$|zubni-lekar|zubn[ií] ordinace/],
];

export function isDentalObor(term) {
  const t = String(term || '').toLowerCase().trim();
  return CATEGORY_PATTERNS.some(([, re]) => re.test(t)) || /zubn[ií] technik/.test(t);
}

export function categoriesFromText(text) {
  const terms = String(text || '').toLowerCase().split(/\s*[|,;]\s*/).map((x) => x.trim()).filter(Boolean);
  const out = new Set();
  for (const t of terms) for (const [slug, re] of CATEGORY_PATTERNS) if (re.test(t)) out.add(slug);
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

// Města mimo MSK (celá ČR) – lokál pro nadpisy.
const LOCATIVE_CZ = {
  'Praha': 'v Praze', 'Brno': 'v Brně', 'Plzeň': 'v Plzni', 'Olomouc': 'v Olomouci', 'České Budějovice': 'v Českých Budějovicích',
  'Hradec Králové': 'v Hradci Králové', 'Zlín': 've Zlíně', 'Liberec': 'v Liberci', 'Pardubice': 'v Pardubicích', 'Karlovy Vary': 'v Karlových Varech',
  'Mladá Boleslav': 'v Mladé Boleslavi', 'Ústí nad Labem': 'v Ústí nad Labem', 'Prostějov': 'v Prostějově', 'Uherské Hradiště': 'v Uherském Hradišti',
  'Kladno': 'v Kladně', 'Jihlava': 'v Jihlavě', 'Teplice': 'v Teplicích', 'Příbram': 'v Příbrami', 'Znojmo': 've Znojmě', 'Hodonín': 'v Hodoníně',
  'Vyškov': 've Vyškově', 'Přerov': 'v Přerově', 'Šumperk': 'v Šumperku', 'Tábor': 'v Táboře', 'Děčín': 'v Děčíně', 'Jablonec nad Nisou': 'v Jablonci nad Nisou',
  'Most': 'v Mostě', 'Kroměříž': 'v Kroměříži', 'Klatovy': 'v Klatovech', 'Chomutov': 'v Chomutově', 'Třebíč': 'v Třebíči', 'Břeclav': 'v Břeclavi',
  'Česká Lípa': 'v České Lípě', 'Beroun': 'v Berouně', 'Kolín': 'v Kolíně', 'Havlíčkův Brod': 'v Havlíčkově Brodě', 'Chrudim': 'v Chrudimi',
  'Litoměřice': 'v Litoměřicích', 'Žďár nad Sázavou': 've Žďáru nad Sázavou', 'Uherský Brod': 'v Uherském Brodě', 'Trutnov': 'v Trutnově', 'Slaný': 've Slaném',
  'Valašské Meziříčí': 've Valašském Meziříčí', 'Benešov': 'v Benešově', 'Vsetín': 've Vsetíně', 'Jindřichův Hradec': 'v Jindřichově Hradci',
  'Strakonice': 've Strakonicích', 'Kyjov': 'v Kyjově', 'Písek': 'v Písku', 'Cheb': 'v Chebu', 'Poděbrady': 'v Poděbradech', 'Rakovník': 'v Rakovníku',
  'Náchod': 'v Náchodě', 'Blansko': 'v Blansku', 'Kutná Hora': 'v Kutné Hoře', 'Jičín': 'v Jičíně', 'Říčany': 'v Říčanech', 'Louny': 'v Lounech',
  'Nymburk': 'v Nymburce', 'Mělník': 'v Mělníku', 'Český Krumlov': 'v Českém Krumlově', 'Pelhřimov': 'v Pelhřimově', 'Otrokovice': 'v Otrokovicích',
  'Jeseník': 'v Jeseníku', 'Žatec': 'v Žatci', 'Hranice': 'v Hranicích', 'Rožnov pod Radhoštěm': 'v Rožnově pod Radhoštěm', 'Turnov': 'v Turnově',
  'Brandýs nad Labem-Stará Boleslav': 'v Brandýse nad Labem-Staré Boleslavi', 'Litvínov': 'v Litvínově', 'Šternberk': 've Šternberku', 'Vlašim': 've Vlašimi',
  'Mariánské Lázně': 'v Mariánských Lázních', 'Rokycany': 'v Rokycanech', 'Lanškroun': 'v Lanškrouně', 'Jesenice': 'v Jesenici', 'Domažlice': 'v Domažlicích',
  'Kralupy nad Vltavou': 'v Kralupech nad Vltavou', 'Humpolec': 'v Humpolci', 'Veselí nad Moravou': 've Veselí nad Moravou', 'Ostrov': 'v Ostrově',
  'Lovosice': 'v Lovosicích', 'Rychnov nad Kněžnou': 'v Rychnově nad Kněžnou', 'Boskovice': 'v Boskovicích', 'Čáslav': 'v Čáslavi', 'Dobříš': 'v Dobříši',
  'Sokolov': 'v Sokolově', 'Neratovice': 'v Neratovicích', 'Hořice': 'v Hořicích', 'Zábřeh': 'v Zábřehu', 'Nové Město na Moravě': 'v Novém Městě na Moravě',
  'Holešov': 'v Holešově', 'Dvůr Králové nad Labem': 've Dvoře Králové nad Labem', 'Ústí nad Orlicí': 'v Ústí nad Orlicí', 'Vrchlabí': 've Vrchlabí',
  'Tachov': 'v Tachově', 'Chotěboř': 'v Chotěboři', 'Kadaň': 'v Kadani', 'Staré Město': 've Starém Městě', 'Roudné': 'v Roudném', 'Jaroměř': 'v Jaroměři',
  'Židlochovice': 'v Židlochovicích', 'Sušice': 'v Sušici', 'Svitavy': 've Svitavách', 'Dačice': 'v Dačicích', 'Tišnov': 'v Tišnově', 'Litomyšl': 'v Litomyšli',
  'Velké Meziříčí': 've Velkém Meziříčí', 'Nový Bydžov': 'v Novém Bydžově', 'Ledeč nad Sázavou': 'v Ledči nad Sázavou', 'Český Brod': 'v Českém Brodě',
  'Vysoké Mýto': 've Vysokém Mýtě', 'Lipník nad Bečvou': 'v Lipníku nad Bečvou', 'Varnsdorf': 've Varnsdorfu', 'Hlinsko': 'v Hlinsku',
  'Valašské Klobouky': 've Valašských Kloboukách', 'Bystřice nad Pernštejnem': 'v Bystřici nad Pernštejnem', 'Nový Bor': 'v Novém Boru',
  'Česká Třebová': 'v České Třebové', 'Mnichovo Hradiště': 'v Mnichově Hradišti', 'Prachatice': 'v Prachaticích', 'Třeboň': 'v Třeboni',
  'Hořovice': 'v Hořovicích', 'Mohelnice': 'v Mohelnici', 'Přeštice': 'v Přešticích', 'Blatná': 'v Blatné', 'Letovice': 'v Letovicích', 'Hustopeče': 'v Hustopečích',
  'Klášterec nad Ohří': 'v Klášterci nad Ohří', 'Napajedla': 'v Napajedlech', 'Litovel': 'v Litovli', 'Uničov': 'v Uničově', 'Holice': 'v Holicích',
  'Polička': 'v Poličce', 'Stříbro': 've Stříbře', 'Čelákovice': 'v Čelákovicích', 'Choceň': 'v Chocni', 'Kaplice': 'v Kaplici', 'Sezimovo Ústí': 'v Sezimově Ústí',
  'Žamberk': 'v Žamberku', 'Bystřice pod Hostýnem': 'v Bystřici pod Hostýnem', 'Ostrožská Nová Ves': 'v Ostrožské Nové Vsi', 'Přelouč': 'v Přelouči',
  'Aš': 'v Aši', 'Mníšek pod Brdy': 'v Mníšku pod Brdy', 'Velká Bíteš': 've Velké Bíteši', 'Kuřim': 'v Kuřimi',
};
export function locative(name) {
  if (LOCATIVE[name]) return LOCATIVE[name];
  if (LOCATIVE_CZ[name]) return LOCATIVE_CZ[name];
  const p = String(name).match(/^Praha (\d+)$/);
  if (p) return `v Praze ${p[1]}`;
  return `v obci ${name}`;
}

// Kraje – 2. a 6. pád pro nadpisy.
export const KRAJE = [
  ['Hlavní město Praha', 'v Praze'], ['Středočeský kraj', 've Středočeském kraji'], ['Jihočeský kraj', 'v Jihočeském kraji'],
  ['Plzeňský kraj', 'v Plzeňském kraji'], ['Karlovarský kraj', 'v Karlovarském kraji'], ['Ústecký kraj', 'v Ústeckém kraji'],
  ['Liberecký kraj', 'v Libereckém kraji'], ['Královéhradecký kraj', 'v Královéhradeckém kraji'], ['Pardubický kraj', 'v Pardubickém kraji'],
  ['Kraj Vysočina', 'v Kraji Vysočina'], ['Jihomoravský kraj', 'v Jihomoravském kraji'], ['Olomoucký kraj', 'v Olomouckém kraji'],
  ['Zlínský kraj', 've Zlínském kraji'], ['Moravskoslezský kraj', 'v Moravskoslezském kraji'],
].map(([name, loc]) => ({ name, loc, slug: slugify(name.replace(/^Hlavní město /, '')) }));
export const KRAJ_BY_NAME = Object.fromEntries(KRAJE.map((k) => [k.name, k]));
