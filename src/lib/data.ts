// Data pro generování stránek. V produkci se čtou ze Supabase při buildu,
// lokálně (bez proměnných prostředí) ze snapshotu data/clinics.json.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { slugify, CATEGORIES, OSTRAVA_PARTS_BY_ZIP, KRAJE, KRAJ_BY_NAME } from './taxonomy.mjs';

export interface Clinic {
  id: string;
  slug: string;
  nrpzs_id: string | null;
  legal_name: string;
  display_name: string;
  categories: string[];
  is_clinic: boolean;
  obory_raw: string;
  street: string;
  zip: string;
  city: string;
  city_part: string;
  okres: string;
  kraj: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  email: string;
  web: string;
  description: string;
  photos: string[];
  insurers: string[];
  accepts_new: 'ano' | 'ne' | 'omezene' | null;
  accepts_new_checked_at: string | null;
  opening_hours: string;
  premium: boolean;
  hidden: boolean;
  // odvozené
  rating_avg: number | null;
  rating_count: number;
  city_slug: string;
  part_slug: string;
  kraj_slug: string;
}

export interface Review {
  id: string;
  clinic_id: string;
  author_name: string;
  rating: number;
  text: string;
  created_at: string;
  clinic_reply: string | null;
  clinic_reply_at: string | null;
}

let cache: { clinics: Clinic[]; reviews: Review[]; merged: { slug: string; target: string }[] } | null = null;

async function load() {
  if (cache) return cache;
  const e = (k: string) => (import.meta.env as any)[k] ?? process.env[k] ?? '';
  const url = e('SUPABASE_URL') || e('PUBLIC_SUPABASE_URL');
  const service = e('SUPABASE_SERVICE_ROLE_KEY'), serverKey = e('SUPABASE_SERVER_KEY');
  const key = service || (serverKey ? e('PUBLIC_SUPABASE_ANON_KEY') : '');
  let rawClinics: any[] = [];
  let reviews: Review[] = [];
  let merged: { slug: string; target: string }[] = [];
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false }, global: service ? {} : { headers: { 'x-server-key': serverKey } } });
    const all: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('clinics').select('*').eq('hidden', false).range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    rawClinics = all;
    const { data: mg } = await sb.from('clinics').select('slug, merged_into').eq('hidden', true).not('merged_into', 'is', null);
    const slugById = new Map(all.map((c) => [c.id, c.slug]));
    merged = (mg ?? []).map((m: any) => ({ slug: m.slug, target: slugById.get(m.merged_into) })).filter((m: any) => m.target);
    const { data: rv, error: re } = await sb
      .from('reviews')
      .select('id, clinic_id, author_name, rating, text, created_at, clinic_reply, clinic_reply_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (re) throw re;
    reviews = rv as Review[];
  } else {
    if (process.env.VERCEL) throw new Error('Chybí PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVER_KEY – build na Vercelu by jinak zveřejnil zkušební data.');
    const file = path.resolve('data/clinics.json');
    rawClinics = JSON.parse(fs.readFileSync(file, 'utf8')).filter((c: any) => !c.hidden);
    rawClinics.forEach((c: any, i: number) => (c.id = c.id || `local-${i}`));
  }

  const stats = new Map<string, { sum: number; n: number }>();
  for (const r of reviews) {
    const s = stats.get(r.clinic_id) ?? { sum: 0, n: 0 };
    s.sum += r.rating; s.n += 1;
    stats.set(r.clinic_id, s);
  }
  // Stejně pojmenované obce v různých okresech: větší si nechá čistý slug, ostatní dostanou okres.
  const byName = new Map<string, Map<string, number>>();
  for (const c of rawClinics) {
    const m = byName.get(c.city) ?? new Map();
    m.set(c.okres || '', (m.get(c.okres || '') ?? 0) + 1);
    byName.set(c.city, m);
  }
  const citySlug = (city: string, okres: string) => {
    const m = byName.get(city);
    if (!m || m.size < 2) return slugify(city);
    const main = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return (okres || '') === main ? slugify(city) : slugify(`${city} ${okres}`);
  };
  const clinics: Clinic[] = rawClinics.map((c) => {
    const s = stats.get(c.id);
    const part = c.city_part || (/^ostrava$/i.test(c.city) ? OSTRAVA_PARTS_BY_ZIP[String(c.zip).replace(/\s/g, '')] ?? '' : '');
    return {
      ...c,
      categories: c.categories ?? [],
      insurers: c.insurers ?? [],
      photos: c.photos ?? [],
      city_part: part,
      rating_avg: s ? Math.round((s.sum / s.n) * 10) / 10 : null,
      rating_count: s?.n ?? 0,
      city_slug: citySlug(c.city, c.okres),
      part_slug: slugify(part),
      kraj_slug: KRAJ_BY_NAME[c.kraj]?.slug ?? slugify(c.kraj || ''),
    };
  });
  clinics.sort(defaultSort);
  cache = { clinics, reviews, merged };
  return cache;
}

// Výchozí pořadí: nejdřív kdo bere nové pacienty, pak hodnocení, pak abecedně.
// Prémiové profily NEjsou řazeny výš – zvýraznění je jen vizuální a označené.
export function defaultSort(a: Clinic, b: Clinic) {
  const rank = (c: Clinic) => (c.accepts_new === 'ano' ? 0 : c.accepts_new === 'omezene' ? 1 : c.accepts_new === null ? 2 : 3);
  return (
    rank(a) - rank(b) ||
    (b.rating_count > 0 ? b.rating_avg! : 0) - (a.rating_count > 0 ? a.rating_avg! : 0) ||
    a.display_name.localeCompare(b.display_name, 'cs')
  );
}

export async function getClinics() { return (await load()).clinics; }
export async function getReviews(clinicId: string) { return (await load()).reviews.filter((r) => r.clinic_id === clinicId); }
export async function getLatestReviews(n = 6) {
  const { reviews, clinics } = await load();
  const byId = new Map(clinics.map((c) => [c.id, c]));
  return reviews.filter((r) => byId.has(r.clinic_id)).slice(0, n).map((r) => ({ ...r, clinic: byId.get(r.clinic_id)! }));
}

export interface Place { name: string; slug: string; count: number; clinics: Clinic[]; kraj?: string; kraj_slug?: string; okres?: string }

export async function getMerged() { return (await load()).merged; }

export interface Kraj { name: string; slug: string; loc: string; count: number; cities: Place[] }
export async function getKraje(): Promise<Kraj[]> {
  const cities = await getCities();
  return KRAJE.map((k) => {
    const cs = cities.filter((c) => c.kraj_slug === k.slug);
    return { ...k, cities: cs, count: cs.reduce((n, c) => n + c.count, 0) };
  }).filter((k) => k.count > 0);
}

export async function getCities(): Promise<Place[]> {
  const map = new Map<string, Place>();
  for (const c of await getClinics()) {
    const p = map.get(c.city_slug) ?? { name: c.city_slug === slugify(c.city) ? c.city : `${c.city} (${c.okres})`, slug: c.city_slug, count: 0, clinics: [], kraj: c.kraj, kraj_slug: c.kraj_slug, okres: c.okres };
    p.count++; p.clinics.push(c);
    map.set(c.city_slug, p);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'cs'));
}

export async function getParts(citySlug: string): Promise<Place[]> {
  const map = new Map<string, Place>();
  for (const c of (await getClinics()).filter((c) => c.city_slug === citySlug && c.city_part)) {
    const p = map.get(c.part_slug) ?? { name: c.city_part, slug: c.part_slug, count: 0, clinics: [] };
    p.count++; p.clinics.push(c);
    map.set(c.part_slug, p);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function getCategoryCounts() {
  const all = await getClinics();
  // Obory s pár ordinacemi (např. implantologie, kterou registr nevede a doplňuje se ručně) zatím v přehledech neukazujeme.
  return CATEGORIES.map((cat) => ({ ...cat, count: all.filter((c) => c.categories.includes(cat.slug)).length })).filter((c) => c.count >= 10);
}

function distKm(a: Clinic, b: Clinic) {
  if (a.lat == null || b.lat == null || a.lng == null || b.lng == null) return Infinity;
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Podobné ordinace: stejný hlavní obor, nejblíž podle GPS, jinak stejná část města / město.
export async function getNearby(c: Clinic, n = 5) {
  let all = (await getClinics()).filter((x) => x.id !== c.id && x.categories[0] === c.categories[0]);
  // jen okolí (zhruba ±25 km), aby build s celou ČR netrval věčnost
  if (c.lat != null && c.lng != null) {
    const near = all.filter((x) => x.lat != null && x.lng != null && Math.abs(x.lat - c.lat!) < 0.25 && Math.abs(x.lng! - c.lng!) < 0.4);
    all = near.length >= n ? near : all.filter((x) => x.kraj_slug === c.kraj_slug);
  } else all = all.filter((x) => x.city_slug === c.city_slug || x.kraj_slug === c.kraj_slug);
  return all
    .map((x) => ({ x, d: distKm(c, x), same: (x.part_slug && x.part_slug === c.part_slug ? 0 : 1) + (x.city_slug === c.city_slug ? 0 : 2) }))
    .sort((a, b) => (isFinite(a.d) && isFinite(b.d) ? a.d - b.d : a.same - b.same || defaultSort(a.x, b.x)))
    .slice(0, n)
    .map(({ x, d }) => ({ clinic: x, km: isFinite(d) ? d : null }));
}

export function isDataSample() {
  return !(import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
}
