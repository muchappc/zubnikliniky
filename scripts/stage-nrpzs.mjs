// Jednorázové nahrání data/nrpzs-merged.json do public.nrpzs_staging (volá GitHub Action).
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync('data/nrpzs-merged.json', 'utf8'));
const url = 'https://bcjybdqbmtjqfbbizfkb.supabase.co/rest/v1/rpc/nrpzs_stage';
const key = 'sb_publishable_bPazT7FHGFSLEdBkO9rQNw_4XJd-bnC';
let total = 0;
for (let i = 0; i < rows.length; i += 500) {
  const res = await fetch(url, { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ rows: rows.slice(i, i + 500), token: process.env.IMPORT_TOKEN }) });
  const t = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${t}`);
  total += +t;
}
console.log('Nahráno do staging:', total, 'z', rows.length);
