// Měsíční synchronizace s Národním registrem poskytovatelů zdravotních služeb.
// Spouští Vercel Cron (vercel.json) s hlavičkou Authorization: Bearer <CRON_SECRET>.
import { parse } from 'csv-parse/sync';
import { db, sendMail, adminEmail, triggerRebuild } from '../../../lib/server';
import { NRPZS_URL, isDentalRow, buildClinics } from '../../../lib/nrpzs.mjs';
export const prerender = false;

const env = (k: string) => process.env[k] ?? (import.meta.env as any)[k] ?? '';

export const GET = async ({ request }: { request: Request }) => {
  const secret = env('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const admin = adminEmail();
  try {
    const res = await fetch(NRPZS_URL);
    if (!res.ok) throw new Error(`Registr nevrátil data (HTTP ${res.status})`);
    const raw = (await res.text()).replace(/^﻿/, '');
    const first = raw.slice(0, raw.indexOf('\n'));
    const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
    const rows = parse(raw, { columns: true, skip_empty_lines: true, delimiter, relax_quotes: true, relax_column_count: true }) as any[];
    const { all, out, report } = buildClinics(rows.filter(isDentalRow));

    const sb = db();
    const clear = await sb.rpc('nrpzs_clear');
    if (clear.error) throw clear.error;
    for (let i = 0; i < out.length; i += 500) {
      const { error } = await sb.rpc('nrpzs_stage_rows', { rows: out.slice(i, i + 500) });
      if (error) throw error;
    }
    const { data: stats, error } = await sb.rpc('nrpzs_apply');
    if (error) throw error;
    const changed = stats.updated + stats.hidden + stats.inserted > 0;
    if (changed) await triggerRebuild();
    console.log('[nrpzs] hotovo', { registr: rows.length, zubni: all.length, ...stats });
    if (admin.length) await sendMail({
      to: admin,
      subject: `Aktualizace z registru: ${stats.inserted} nových, ${stats.hidden} skrytých`,
      text: `Měsíční aktualizace dat z Národního registru poskytovatelů proběhla.\n\nZubních pracovišť v registru: ${all.length} (po sloučení duplicit ${out.length}, sloučeno ${report.length} dvojic)\nNové ordinace: ${stats.inserted}\nAktualizované údaje (adresa, název, obory): ${stats.updated}\nSkryté (už nejsou v registru): ${stats.hidden}\n\n${changed ? 'Web se právě přestavuje.' : 'Beze změn, web se nepřestavuje.'}\nSkryté ordinace najdeš v administraci, v poznámce mají „už není v NRPZS“.`,
    });
    return Response.json({ ok: true, ...stats });
  } catch (e: any) {
    console.error('[nrpzs] chyba', e);
    await db().rpc('nrpzs_clear').then(() => null, () => null);
    if (admin.length) await sendMail({ to: admin, subject: 'Aktualizace z registru NRPZS selhala', text: `Měsíční aktualizace se nepovedla: ${e?.message ?? e}\n\nData na webu zůstala beze změny.` });
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
};
