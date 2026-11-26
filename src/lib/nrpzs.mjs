// Převod otevřených dat NRPZS na záznamy ordinací – sdílí importní skript i měsíční cron na Vercelu.
import { categoriesFromText, isDentalObor, PRIMARY_ORDER, slugify, formatZip, formatPhone } from './taxonomy.mjs';
import { displayName } from './display-name.mjs';

export const NRPZS_URL = 'https://datanzis.uzis.gov.cz/data/NR-01-NRPZS/NR-01-06/Otevrena-data-NR-01-06-nrpzs-mista-poskytovani-zdravotnich-sluzeb.csv';
export const isDentalRow = (r) => categoriesFromText(String(r.ZZ_obor_pece ?? '').replace(/,\s*/g, '|')).length > 0;

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cleanUrl = (u) => {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  s = s.replace(/^(https?:)\/+/, '$1//');
  try { return new URL(s).toString().replace(/\/$/, ''); } catch { return ''; }
};

function toClinic(r) {
  const obory = String(r.ZZ_obor_pece || '').split(/\s*,\s*/).filter(Boolean);
  const dental = obory.filter(isDentalObor);
  let cats = categoriesFromText(obory.join('|'));
  if (!cats.length) cats = ['zubar'];
  cats.sort((a, b) => PRIMARY_ORDER.indexOf(a) - PRIMARY_ORDER.indexOf(b));
  const legal = String(r.ZZ_nazev || r.poskytovatel_nazev).replace(/\s+/g, ' ').trim();
  const praha = /^Praha \d+$/.test(r.ZZ_obec);
  const city = praha ? 'Praha' : r.ZZ_obec.trim();
  const num = String(r.ZZ_cislo_domovni_orientacni || '').trim();
  const street = r.ZZ_ulice ? `${r.ZZ_ulice.trim()} ${num}`.trim() : `${r.ZZ_obec.trim()} ${num}`.trim();
  const m = String(r.ZZ_GPS || '').match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
  return {
    nrpzs_id: String(r.ZZ_misto_poskytovani_ID),
    ico: String(r.poskytovatel_ICO || '').trim() || null,
    legal_name: legal,
    display_name: displayName(legal),
    categories: cats,
    is_clinic: /klinik|clinic|centrum|poliklinik|nemocnic/i.test(legal) || cats.length >= 3 || obory.length > dental.length + 3,
    obory_raw: (dental.length ? dental : obory).map((o) => o.charAt(0).toLowerCase() + o.slice(1)).join(', '),
    street,
    zip: formatZip(r.ZZ_PSC),
    city,
    city_part: praha ? r.ZZ_obec.trim() : '',
    okres: String(r.ZZ_okres_nazev || '').trim(),
    kraj: String(r.ZZ_kraj_nazev || '').trim(),
    lat: m ? +m[1] : null,
    lng: m ? +m[2] : null,
    phone: formatPhone(r.poskytovatel_telefon),
    email: String(r.poskytovatel_email || '').trim().toLowerCase().split(/[\s,;]+/)[0] || '',
    web: cleanUrl(r.poskytovatel_web),
  };
}

// --- Duplicity -----------------------------------------------------------------------------
// Stejná adresa + stejné „jádro" názvu (bez titulů, právní formy a obecných slov):
// „MUDr. Ladislav Česnek" × „MUDr. Ladislav Česnek zubní praxe s.r.o.",
// „Vlasta Staňková DiS." × „MUDr. Vlasta Staňková", „Orto Plum" × „Orto Plum Advanced".
const GENERIC = new Set(('mudr mddr bc mgr ing dis phd doc prof dr mba msc bsc dds s r o sro spol a as v k z u '
  + 'zubni ordinace praxe soukroma soukromy privatni privatni stomatologicka stomatologicky stomatolog stomatologie '
  + 'prakticky lekar lekarstvi zubar zubarka ortho orto ortodoncie surgery stomatochirurgie chirurgie advanced plus '
  + 'dentalni hygiena hygienistka spolecnost rucenim omezenym the and clinic klinika centrum care dent dental denta dentes '
  + 'medico medical poliklinika esthetics estetika esthetic praha prague zubu zuby smile studio group').split(' '));
const core = (name, city = '') => {
  const cityWords = new Set(strip(city).split(/[^a-z0-9]+/));
  return strip(name).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 1 && !GENERIC.has(w) && !cityWords.has(w));
};
const isPerson = (name) => /\b(MUDr|MDDr|DiS|Bc|Mgr)\b/i.test(name) && !/s\.\s?r\.\s?o|a\.\s?s\./i.test(name);
const sub = (a, b) => a.length > 0 && a.every((w) => b.includes(w));
function sameEntity(a, b) {
  const ca = core(a.legal_name, a.city), cb = core(b.legal_name, b.city);
  if (!ca.length || !cb.length) return false;
  // u osob chceme shodu jména i příjmení (aspoň 2 slova), u firem stačí shodné jádro značky
  const need = isPerson(a.legal_name) || isPerson(b.legal_name) ? 2 : 1;
  if (Math.min(ca.length, cb.length) < need) return false;
  return sub(ca, cb) || sub(cb, ca);
}

export function buildClinics(rows) {
const all = rows.map(toClinic);
const byAddr = new Map();
for (const c of all) {
  const k = strip(`${c.street}|${c.zip}`).replace(/\s+/g, '');
  (byAddr.get(k) ?? byAddr.set(k, []).get(k)).push(c);
}
const out = [], report = [];
for (const group of byAddr.values()) {
  const used = new Set();
  for (let i = 0; i < group.length; i++) {
    if (used.has(i)) continue;
    const cluster = [group[i]];
    used.add(i);
    for (let j = i + 1; j < group.length; j++) {
      if (!used.has(j) && cluster.some((x) => sameEntity(x, group[j]))) { cluster.push(group[j]); used.add(j); }
    }
    // reprezentant: firma (ne osoba) s nejvíc obory, jinak první
    cluster.sort((a, b) => (isPerson(a.legal_name) - isPerson(b.legal_name)) || (b.categories.length - a.categories.length));
    const rep = { ...cluster[0], all_ids: cluster.map((x) => x.nrpzs_id) };
    if (cluster.length > 1) {
      rep.categories = [...new Set(cluster.flatMap((x) => x.categories))].sort((a, b) => PRIMARY_ORDER.indexOf(a) - PRIMARY_ORDER.indexOf(b));
      rep.obory_raw = [...new Set(cluster.flatMap((x) => x.obory_raw.split(', ')).filter(Boolean))].join(', ');
      for (const f of ['phone', 'email', 'web']) rep[f] = rep[f] || cluster.find((x) => x[f])?.[f] || '';
      report.push([rep.city + (rep.city_part ? ` (${rep.city_part})` : ''), rep.street, cluster.map((x) => x.legal_name).join(' + ')]);
    }
    out.push(rep);
  }
}

// slugy: jméno-město; kolize se řeší až v SQL proti existujícím (přidá se -<nrpzs_id>)
const seen = new Map();
for (const c of out) {
  const name = slugify(c.display_name), city = slugify(c.city_part || c.city);
  let s = (name.includes(city) ? name : `${name}-${city}`).replace(/^-|-$/g, '') || 'ordinace';
  if (seen.has(s)) s = `${s}-${c.nrpzs_id}`;
  seen.set(s, 1);
  c.slug_base = s;
}
return { all, out, report };
}

