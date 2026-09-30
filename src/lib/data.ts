// Data pro generování stránek. V produkci se čtou ze Supabase při buildu,
// lokálně (bez proměnných prostředí) ze snapshotu data/clinics.json.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { slugify, CATEGORIES, OSTRAVA_PARTS_BY_ZIP } from './taxonomy.mjs';

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

let cache: { clinics: Clinic[]; reviews: Review[] } | null = null;

async function load() {
  if (cache) return cache;
  const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  let rawClinics: any[] = [];
  let reviews: Review[] = [];
  if (url && key) {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const all: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('clinics').select('*').eq('hidden', false).range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    rawClinics = all;
    const { data: rv, error: re } = await sb
      .from('reviews')
      .select('id, clinic_id, author_name, rating, text, created_at, clinic_reply, clinic_reply_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (re) throw re;
    reviews = rv as Review[];
  } else {
    if (process.env.VERCEL) throw new Error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY – build na Vercelu by jinak zveřejnil zkušební data.');
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
      city_slug: slugify(c.city),
      part_slug: slugify(part),
    };
  });
  clinics.sort(defaultSort);
  cache = { clinics, reviews };
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

export interface Place { name: string; slug: string; count: number; clinics: Clinic[] }

export async function getCities(): Promise<Place[]> {
  const map = new Map<string, Place>();
  for (const c of await getClinics()) {
    const p = map.get(c.city_slug) ?? { name: c.city, slug: c.city_slug, count: 0, clinics: [] };
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
  return CATEGORIES.map((cat) => ({ ...cat, count: all.filter((c) => c.categories.includes(cat.slug)).length })).filter((c) => c.count > 0);
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
  const all = (await getClinics()).filter((x) => x.id !== c.id && x.categories[0] === c.categories[0]);
  return all
    .map((x) => ({ x, d: distKm(c, x), same: (x.part_slug && x.part_slug === c.part_slug ? 0 : 1) + (x.city_slug === c.city_slug ? 0 : 2) }))
    .sort((a, b) => (isFinite(a.d) && isFinite(b.d) ? a.d - b.d : a.same - b.same || defaultSort(a.x, b.x)))
    .slice(0, n)
    .map(({ x, d }) => ({ clinic: x, km: isFinite(d) ? d : null }));
}

export function isDataSample() {
  return !(import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL);
}
