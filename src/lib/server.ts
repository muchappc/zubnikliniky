// Pomocné funkce pro serverové API (běží na Vercelu jako serverless funkce).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';

const env = (k: string) => process.env[k] ?? (import.meta.env as any)[k] ?? '';

let _sb: SupabaseClient | null = null;
export function db() {
  if (!_sb) {
    const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new HttpError(503, 'Služba zatím není nastavená. Zkuste to prosím později.');
    _sb = createClient(url, key, { auth: { persistSession: false } });
  }
  return _sb;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

// Obal pro POST handlery: parsování JSON, ochrana proti botům, jednotné chyby.
export function handler(fn: (body: any, ctx: { request: Request; ip: string }) => Promise<Response>) {
  return async ({ request, clientAddress }: { request: Request; clientAddress?: string }) => {
    try {
      let body: any = {};
      try { body = await request.json(); } catch { throw new HttpError(400, 'Neplatný požadavek.'); }
      if (body.website_url) return json({ ok: true, message: 'Odesláno.' }); // honeypot – tváříme se, že je vše OK
      if (typeof body._t === 'number' && body._t < 2500) throw new HttpError(400, 'Formulář byl odeslán příliš rychle. Zkuste to prosím znovu.');
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || '';
      return await fn(body, { request, ip });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Něco se pokazilo na naší straně. Zkuste to prosím za chvíli znovu.' }, 500);
    }
  };
}

export const hash = (s: string) => createHash('sha256').update(env('HASH_SALT') + '|' + s.trim().toLowerCase()).digest('hex');
export const token = () => randomBytes(24).toString('base64url');

export function str(v: unknown, { min = 0, max = 2000, name = 'Pole' } = {}) {
  const s = String(v ?? '').trim();
  if (s.length < min) throw new HttpError(400, min <= 1 ? `${name} je povinné.` : `${name} je příliš krátké (alespoň ${min} znaků).`);
  if (s.length > max) throw new HttpError(400, `${name} je příliš dlouhé (nejvýše ${max} znaků).`);
  return s;
}
export function email(v: unknown, required = true) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s && !required) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 200) throw new HttpError(400, 'Zkontrolujte prosím e-mailovou adresu.');
  return s;
}
export const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

export async function getClinic(id: unknown) {
  if (!isUuid(id)) throw new HttpError(400, 'Neznámá ordinace.');
  const { data } = await db().from('clinics').select('id, slug, display_name, email, premium, city').eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'Ordinaci jsme nenašli.');
  return data;
}

export const siteUrl = () => env('PUBLIC_SITE_URL') || 'https://www.zubnikliniky.cz';
export const adminEmail = () => env('ADMIN_EMAIL');

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// Odeslání e-mailu přes Resend (https://resend.com). Bez klíče jen zaloguje.
export async function sendMail(opts: { to: string | string[]; subject: string; text: string; replyTo?: string }) {
  const key = env('RESEND_API_KEY');
  const from = env('MAIL_FROM') || 'zubnikliniky.cz <info@zubnikliniky.cz>';
  if (!key) { console.warn('[mail] RESEND_API_KEY chybí, e-mail neodeslán:', opts.subject, opts.to); return false; }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#0f2e35;max-width:560px">${escapeHtml(opts.text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0b6f70">$1</a>')
    .replace(/\n/g, '<br>')}</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text, html, reply_to: opts.replyTo }),
  });
  if (!res.ok) { console.error('[mail] Resend chyba', res.status, await res.text()); return false; }
  return true;
}

// Spustí nový build webu (aby se zveřejnily recenze a změny z administrace).
export async function triggerRebuild() {
  const hook = env('VERCEL_DEPLOY_HOOK_URL');
  if (!hook) return false;
  const r = await fetch(hook, { method: 'POST' }).catch(() => null);
  return !!r?.ok;
}

export async function requireAdmin(request: Request) {
  const jwt = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) throw new HttpError(401, 'Nepřihlášen.');
  const { data } = await db().auth.getUser(jwt);
  if (!data.user) throw new HttpError(401, 'Nepřihlášen.');
  const { data: adm } = await db().from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!adm) throw new HttpError(403, 'Nemáte oprávnění správce.');
  return data.user;
}
