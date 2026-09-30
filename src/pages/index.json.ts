import { getClinics } from '../lib/data';
// Kompaktní index pro vyhledávání na stránce /hledat.
export async function GET() {
  const rows = (await getClinics()).map((c) => [
    c.slug, c.display_name, c.street, c.city, c.city_slug, c.city_part, c.categories.join(' '),
    c.insurers.join(' '), c.accepts_new ?? '', c.premium ? 1 : 0, c.rating_avg ?? 0, c.rating_count, c.legal_name, c.is_clinic ? 1 : 0,
  ]);
  return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
}
