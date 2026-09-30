import type { APIRoute } from 'astro';
import { db, isUuid } from '../../lib/server';
export const prerender = false;
const KINDS = new Set(['view', 'web', 'phone', 'email', 'map']);

// Anonymní počítadlo zobrazení a prokliků – bez cookies a bez IP.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (isUuid(b.clinic_id) && KINDS.has(b.kind) && !/bot|crawl|spider|preview/i.test(request.headers.get('user-agent') ?? '')) {
      await db().rpc('track_event', { p_clinic: b.clinic_id, p_kind: b.kind });
    }
  } catch {}
  return new Response(null, { status: 204 });
};
