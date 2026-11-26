#!/usr/bin/env node
// Stáhne otevřená data NRPZS (místa poskytování zdravotních služeb, celá ČR)
// a uloží jen zubní ordinace do data/nrpzs-zubni.csv. Spouští se v GitHub Actions.
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { categoriesFromText } from '../src/lib/taxonomy.mjs';

const URL = 'https://datanzis.uzis.gov.cz/data/NR-01-NRPZS/NR-01-06/Otevrena-data-NR-01-06-nrpzs-mista-poskytovani-zdravotnich-sluzeb.csv';
const res = await fetch(URL);
if (!res.ok) throw new Error(`Stažení selhalo: ${res.status}`);
const raw = (await res.text()).replace(/^﻿/, '');
const first = raw.slice(0, raw.indexOf('\n'));
const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
const rows = parse(raw, { columns: true, skip_empty_lines: true, delimiter, relax_quotes: true, relax_column_count: true });
console.log('Řádků v registru:', rows.length, 'sloupce:', Object.keys(rows[0]).join(', '));
const dental = rows.filter((r) => categoriesFromText(String(r.ZZ_obor_pece ?? '').replace(/,\s*/g, '|')).length > 0);
console.log('Zubních míst:', dental.length);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/nrpzs-zubni.csv', stringify(dental, { header: true }));
