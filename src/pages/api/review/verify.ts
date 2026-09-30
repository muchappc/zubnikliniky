import type { APIRoute } from 'astro';
import { db, triggerRebuild } from '../../../lib/server';
export const prerender = false;

export const GET: APIRoute = async ({ url, redirect }) => {
  const t = url.searchParams.get('token') ?? '';
  if (t.length < 20) return redirect('/recenze/neplatny-odkaz', 302);
  const week = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await db().from('reviews').update({ status: 'published', verified_at: new Date().toISOString(), verify_token: null })
    .eq('verify_token', t).eq('status', 'pending').gte('created_at', week).select('id');
  if (!data?.length) return redirect('/recenze/neplatny-odkaz', 302);
  await triggerRebuild();
  return redirect('/recenze/overeno', 302);
};
