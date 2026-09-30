import type { APIRoute } from 'astro';
import { requireAdmin, triggerRebuild, json, HttpError } from '../../../lib/server';
export const prerender = false;

// Tlačítko „Zveřejnit změny" v administraci – spustí nový build webu.
export const POST: APIRoute = async ({ request }) => {
  try {
    await requireAdmin(request);
    const ok = await triggerRebuild();
    if (!ok) throw new HttpError(500, 'Build se nepodařilo spustit. Je nastavená proměnná VERCEL_DEPLOY_HOOK_URL?');
    return json({ ok: true, message: 'Web se aktualizuje, změny budou vidět zhruba za 1–2 minuty.' });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: 'Chyba serveru.' }, 500);
  }
};
