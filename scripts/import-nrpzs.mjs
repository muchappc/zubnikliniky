#!/usr/bin/env node
// Ruční import z data/nrpzs-zubni.csv (lokální kontrola). Automaticky běží měsíční cron /api/cron/nrpzs.
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { buildClinics } from '../src/lib/nrpzs.mjs';
const rows = parse(fs.readFileSync('data/nrpzs-zubni.csv', 'utf8'), { columns: true, skip_empty_lines: true });
const { all, out, report } = buildClinics(rows);
fs.writeFileSync('data/nrpzs-merged.json', JSON.stringify(out));
fs.writeFileSync('data/duplicity.csv', 'mesto;adresa;sloucene_zaznamy\n' + report.map((r) => r.map((x) => `"${x.replace(/"/g, '""')}"`).join(';')).join('\n'));
console.log(`Míst v registru: ${all.length}, po sloučení: ${out.length}, sloučených skupin: ${report.length}`);
