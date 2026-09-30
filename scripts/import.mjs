#!/usr/bin/env node
// Použití:
//   node scripts/import.mjs data/export.csv            → zapíše data/clinics.json (lokální snapshot)
//   node scripts/import.mjs data/export.csv --push     → navíc nahraje do Supabase
//     (potřebuje SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY v prostředí)
// U ordinací, které už v databázi jsou, se při --push přepisují jen údaje z registru
// (název, adresa, obory, GPS). Ručně doplněné věci z administrace zůstanou.
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { mapHeaders, normalizeRow, assignSlugs } from './normalize.mjs';

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error('Zadej cestu k CSV.'); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
const delimiter = (raw.split('\n')[0].match(/;/g)?.length ?? 0) > (raw.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
const records = parse(raw, { columns: true, skip_empty_lines: true, delimiter, relax_quotes: true });
const headers = Object.keys(records[0] || {});
const h = mapHeaders(headers);
console.log('Rozpoznané sloupce:', h);
if (!h.legal_name) { console.error('Nenašel jsem sloupec s názvem ordinace.'); process.exit(1); }

let rows = records.map((r) => normalizeRow(r, h)).filter((r) => r.legal_name);

// Duplicity: stejný název + stejná adresa
const seen = new Set();
rows = rows.filter((r) => {
  const k = (r.legal_name + '|' + r.street + '|' + r.city).toLowerCase();
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
assignSlugs(rows);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/clinics.json', JSON.stringify(rows, null, 1));
const byCat = {};
rows.forEach((r) => r.categories.forEach((c) => (byCat[c] = (byCat[c] || 0) + 1)));
console.log(`Zapsáno ${rows.length} ordinací do data/clinics.json`);
console.log('Podle oborů:', byCat);
console.log('Bez GPS:', rows.filter((r) => r.lat == null).length, '| bez telefonu:', rows.filter((r) => !r.phone).length, '| bez webu:', rows.filter((r) => !r.web).length);

if (flags.includes('--push')) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Chybí SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: existing, error } = await sb.from('clinics').select('id, slug, nrpzs_id');
  if (error) throw error;
  const bySlug = new Map(existing.map((e) => [e.slug, e]));
  const byNrpzs = new Map(existing.filter((e) => e.nrpzs_id).map((e) => [e.nrpzs_id, e]));
  const inserts = [], updates = [];
  for (const r of rows) {
    const match = (r.nrpzs_id && byNrpzs.get(r.nrpzs_id)) || bySlug.get(r.slug);
    const { id, ...rest } = r;
    if (match) {
      updates.push({ id: match.id, legal_name: r.legal_name, obory_raw: r.obory_raw, street: r.street, zip: r.zip, city: r.city, okres: r.okres, kraj: r.kraj, lat: r.lat, lng: r.lng, nrpzs_id: r.nrpzs_id, ico: r.ico });
    } else inserts.push(id ? { id, ...rest } : rest);
  }
  for (let i = 0; i < inserts.length; i += 200) {
    const { error: e } = await sb.from('clinics').insert(inserts.slice(i, i + 200));
    if (e) throw e;
  }
  for (const u of updates) {
    const { id, ...rest } = u;
    const { error: e } = await sb.from('clinics').update(rest).eq('id', id);
    if (e) throw e;
  }
  console.log(`Supabase: ${inserts.length} nových, ${updates.length} aktualizovaných.`);
}
