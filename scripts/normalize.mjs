// Převod řádku z exportu (Lovable/Supabase CSV nebo NRPZS) na jednotný záznam ordinace.
import {
  categoriesFromText, PRIMARY_ORDER, OSTRAVA_PARTS_BY_ZIP, slugify, formatZip, formatPhone,
} from '../src/lib/taxonomy.mjs';

const ALIASES = {
  id: ['id', 'uuid'],
  slug: ['slug'],
  legal_name: ['legal_name', 'name', 'nazev', 'název', 'nazev_zarizeni', 'nazevzarizeni', 'poskytovatel', 'nazevposkytovatele'],
  display_name: ['display_name', 'zobrazovany_nazev'],
  type: ['type', 'typ', 'category', 'druhzarizeni', 'druh_zarizeni'],
  obory: ['obory', 'specializations', 'specialties', 'fields', 'oborpece', 'obor_pece', 'oborypece', 'obory_pece', 'specializace'],
  address: ['address', 'adresa', 'full_address'],
  street: ['street', 'ulice'],
  house: ['cislo_domovni', 'cislodomovniorientacni', 'house_number'],
  city: ['city', 'mesto', 'obec', 'město'],
  city_part: ['city_part', 'cast_obce', 'castobce'],
  zip: ['zip', 'psc', 'psč', 'postal_code'],
  okres: ['okres', 'district'],
  kraj: ['kraj', 'region'],
  phone: ['phone', 'telefon', 'poskytovateltelefon', 'tel'],
  email: ['email', 'e_mail', 'poskytovatelemail'],
  web: ['web', 'website', 'url', 'poskytovatelweb', 'www'],
  lat: ['lat', 'latitude', 'gps_lat', 'lat_wgs'],
  lng: ['lng', 'lon', 'longitude', 'gps_lng', 'gps_lon'],
  gps: ['gps', 'souradnice'],
  nrpzs_id: ['nrpzs_id', 'nrpzs', 'zdravotnickezarizeniid', 'zz_id', 'poskytovatelid'],
  ico: ['ico', 'ič', 'ic'],
  description: ['description', 'popis'],
  photos: ['photos', 'images', 'gallery', 'fotky'],
  premium: ['premium', 'is_premium', 'featured', 'is_featured', 'highlighted', 'zvyrazneno'],
  hidden: ['hidden', 'is_hidden', 'skryto'],
  insurers: ['insurers', 'pojistovny'],
  accepts_new: ['accepts_new', 'accepts_new_patients', 'nove_pacienty'],
};

const norm = (k) => String(k).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '');

export function mapHeaders(headers) {
  const out = {};
  const normed = headers.map(norm);
  for (const [field, list] of Object.entries(ALIASES)) {
    const i = normed.findIndex((h) => list.map(norm).includes(h));
    if (i >= 0) out[field] = headers[i];
  }
  return out;
}

export function parseList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith('[')) { try { return JSON.parse(s); } catch {} }
  if (s.startsWith('{') && s.endsWith('}')) {
    return s.slice(1, -1).match(/("([^"\\]|\\.)*"|[^,]+)/g)?.map((x) => x.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim()).filter(Boolean) ?? [];
  }
  return s.split(/[;|,]/).map((x) => x.trim()).filter(Boolean);
}

const truthy = (v) => /^(true|t|1|ano|yes)$/i.test(String(v ?? '').trim());

const TITLES = /^(MUDr\.|MDDr\.|Bc\.|Mgr\.|Ing\.|DiS\.|Ph\.D\.|PhDr\.|doc\.|prof\.|MBA|MSc\.|BSc\.|DDS|Dr\.)$/i;
const LEGAL = /[, ]+(s\.\s?r\.\s?o\.|spol\.\s?s\s?r\.\s?o\.|a\.\s?s\.|v\.\s?o\.\s?s\.|z\.\s?ú\.|o\.\s?p\.\s?s\.)\s*$/i;

function titleWord(w) {
  if (TITLES.test(w)) {
    const canon = ['MUDr.', 'MDDr.', 'Bc.', 'Mgr.', 'Ing.', 'DiS.', 'Ph.D.', 'PhDr.', 'doc.', 'prof.', 'MBA', 'MSc.', 'BSc.', 'DDS', 'Dr.'];
    return canon.find((c) => c.toLowerCase() === w.toLowerCase()) ?? w;
  }
  if (w.length < 2 || w !== w.toLocaleUpperCase('cs') || !/\p{L}/u.test(w)) return w;
  return w.split('-').map((p) => p.charAt(0).toLocaleUpperCase('cs') + p.slice(1).toLocaleLowerCase('cs')).join('-');
}

// Z právního názvu udělá čitelný zobrazovaný název.
export function displayName(legal) {
  let s = String(legal || '').replace(/\s+/g, ' ').trim();
  // "..., příspěvková organizace, LPS dos., ..." → uříznout za organizací
  s = s.replace(/,\s*(příspěvková organizace|státní příspěvková organizace).*$/i, '');
  // "Firma s.r.o., praktický lékař stomatolog" → "Firma s.r.o."
  s = s.replace(/,\s*(praktický lékař|zubní lékař|stomatolog|ordinace).*$/i, '');
  s = s.replace(/^(MUDr\.|MDDr\.)(?=\S)/, '$1 ');
  const hadLegal = LEGAL.test(s);
  s = s.replace(LEGAL, '').replace(/,\s*$/, '').trim();
  const words = s.split(' ');
  const hasTitle = words.some((w) => TITLES.test(w));
  const personLike = hasTitle || (!hadLegal && words.length >= 2 && words.length <= 3 && words.every((w) => /^[\p{Lu}][\p{L}-]+$/u.test(w)));
  if (personLike) return words.map(titleWord).join(' ');
  return s;
}

export function parseAddress(addr) {
  // "Opavská 6230/29a, 70800 Ostrava"
  const m = String(addr || '').match(/^(.*?),\s*(\d{3}\s?\d{2})\s+(.+)$/);
  if (!m) return { street: String(addr || '').trim() };
  return { street: m[1].trim(), zip: m[2].replace(/\s/g, ''), city: m[3].trim() };
}

function cleanUrl(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).toString().replace(/\/$/, ''); } catch { return ''; }
}

export function normalizeRow(row, h) {
  const get = (f) => (h[f] ? row[h[f]] : undefined);
  const legal = String(get('legal_name') || '').trim();
  const fromAddr = parseAddress(get('address'));
  const street = String(get('street') || fromAddr.street || '').trim() + (get('house') ? ' ' + get('house') : '');
  const zipRaw = String(get('zip') || fromAddr.zip || '').replace(/\s/g, '');
  const city = String(get('city') || fromAddr.city || '').replace(/\s*\d+$/, '').trim();

  const oboryList = parseList(get('obory'));
  const typeRaw = String(get('type') || '');
  let cats = categoriesFromText([...oboryList, typeRaw.replace(/zubni-klinika/, '')].join(' | '));
  if (!cats.length) cats = categoriesFromText(legal);
  if (!cats.length) cats = ['zubar'];
  cats.sort((a, b) => PRIMARY_ORDER.indexOf(a) - PRIMARY_ORDER.indexOf(b));

  const isClinic = /klinik|clinic|centrum|poliklinik|nemocnic/i.test(legal) || /klinik/i.test(typeRaw) || cats.length >= 3;

  let lat = parseFloat(get('lat')), lng = parseFloat(get('lng'));
  if ((isNaN(lat) || isNaN(lng)) && get('gps')) {
    const [a, b] = String(get('gps')).split(/[ ,;]+/).map(parseFloat);
    lat = a; lng = b;
  }

  const part = get('city_part') || (/^ostrava$/i.test(city) ? OSTRAVA_PARTS_BY_ZIP[zipRaw] : '') || '';
  const insurers = parseList(get('insurers')).map((x) => String(x).match(/\d{3}/)?.[0]).filter(Boolean);
  const accepts = String(get('accepts_new') || '').toLowerCase();

  return {
    id: get('id') || null,
    slug: get('slug') || null,
    nrpzs_id: get('nrpzs_id') ? String(get('nrpzs_id')) : null,
    ico: get('ico') ? String(get('ico')) : null,
    legal_name: legal,
    display_name: String(get('display_name') || '').trim() || displayName(legal),
    categories: cats,
    is_clinic: isClinic,
    obory_raw: oboryList.join(', '),
    street,
    zip: formatZip(zipRaw),
    city,
    city_part: part,
    okres: String(get('okres') || '').trim(),
    kraj: String(get('kraj') || 'Moravskoslezský kraj').trim(),
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    phone: formatPhone(get('phone')),
    email: String(get('email') || '').trim().toLowerCase(),
    web: cleanUrl(get('web')),
    description: String(get('description') || '').trim(),
    photos: parseList(get('photos')),
    insurers,
    accepts_new: ['ano', 'ne', 'omezene'].includes(accepts) ? accepts : null,
    accepts_new_checked_at: null,
    opening_hours: '',
    premium: truthy(get('premium')),
    hidden: truthy(get('hidden')),
  };
}

export function assignSlugs(rows) {
  const used = new Set(rows.filter((r) => r.slug).map((r) => r.slug));
  for (const r of rows) {
    if (r.slug) continue;
    const name = slugify(r.display_name), city = slugify(r.city);
    const base = (name.includes(city) ? name : `${name}-${city}`).replace(/^-|-$/g, '') || 'ordinace';
    let s = base, i = 2;
    while (used.has(s)) s = `${base}-${i++}`;
    used.add(s);
    r.slug = s;
  }
  return rows;
}
