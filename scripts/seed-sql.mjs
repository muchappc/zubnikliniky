#!/usr/bin/env node
// Vytvoří supabase/seed.sql z data/clinics.json – vloží se v Supabase do SQL Editoru (bez potřeby tajných klíčů).
// Existující ordinace (stejné id) se nepřepíšou.
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('data/clinics.json', 'utf8'));
const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${(a ?? []).map(q).join(',')}]::text[]`;
const cols = ['id','slug','nrpzs_id','ico','legal_name','display_name','categories','is_clinic','obory_raw','street','zip','city','city_part','okres','kraj','lat','lng','phone','email','web','description','photos','insurers','accepts_new','premium','hidden'];
const vals = rows.map((r) => `(${[
  r.id ? q(r.id) : 'gen_random_uuid()', q(r.slug), q(r.nrpzs_id), q(r.ico), q(r.legal_name), q(r.display_name), arr(r.categories), r.is_clinic,
  q(r.obory_raw ?? ''), q(r.street ?? ''), q(r.zip ?? ''), q(r.city ?? ''), q(r.city_part ?? ''), q(r.okres ?? ''), q(r.kraj ?? ''),
  r.lat ?? 'null', r.lng ?? 'null', q(r.phone ?? ''), q(r.email ?? ''), q(r.web ?? ''), q(r.description ?? ''), arr(r.photos), arr(r.insurers),
  q(r.accepts_new), r.premium, r.hidden,
].join(', ')})`);
const sql = `-- Data ordinací (${rows.length}) – vygenerováno ${new Date().toISOString().slice(0, 10)} skriptem scripts/seed-sql.mjs
-- Spusť AŽ PO schema.sql. Prázdné textové hodnoty uloží jako ''.
insert into public.clinics (${cols.join(', ')}) values
${vals.join(',\n')}
on conflict (id) do nothing;
select count(*) as pocet_ordinaci from public.clinics;
`.replace(/\bnull, null, null\b/g, (m) => m);
fs.writeFileSync('supabase/seed.sql', sql.replace(/q\(''\)/g, "''"));
console.log('supabase/seed.sql:', rows.length, 'řádků,', Math.round(sql.length / 1024), 'kB');
