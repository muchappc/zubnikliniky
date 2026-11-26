-- Měsíční synchronizace s NRPZS (volá /api/cron/nrpzs na Vercelu se serverovým klíčem).
-- 1) nrpzs_stage_rows(rows) – nahraje dávku do pracovní tabulky
-- 2) nrpzs_apply()          – promítne ji do clinics a pracovní tabulku vyprázdní
-- Ruční úpravy (zobrazovaný název, popis, fotky, pojišťovny, příjem pacientů, prémium) se nepřepisují.

create table if not exists public.nrpzs_staging (
  nrpzs_id text primary key, all_ids text[], ico text, legal_name text, display_name text, categories text[],
  is_clinic boolean, obory_raw text, street text, zip text, city text, city_part text, okres text, kraj text,
  lat double precision, lng double precision, phone text, email text, web text, slug_base text
);
alter table public.nrpzs_staging enable row level security;

create or replace function public.nrpzs_stage_rows(rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_server() then raise exception 'forbidden'; end if;
  insert into public.nrpzs_staging select * from jsonb_populate_recordset(null::public.nrpzs_staging, rows)
  on conflict (nrpzs_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.nrpzs_clear() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_server() then raise exception 'forbidden'; end if;
  truncate public.nrpzs_staging;
end $$;

create or replace function public.nrpzs_apply() returns jsonb
language plpgsql security definer set search_path = public as $$
declare staged int; upd int; hid int; ins int;
begin
  if not public.is_server() then raise exception 'forbidden'; end if;
  select count(*) into staged from nrpzs_staging;
  -- pojistka proti poškozenému nebo neúplnému souboru z registru
  if staged < 5000 then
    truncate nrpzs_staging;
    raise exception 'Podezřele málo záznamů z registru (%), import přeskočen', staged;
  end if;

  update clinics c set
    nrpzs_id = s.nrpzs_id, ico = s.ico, legal_name = case when c.premium then c.legal_name else s.legal_name end,
    obory_raw = s.obory_raw, street = s.street, zip = s.zip, city = s.city, okres = s.okres, kraj = s.kraj,
    city_part = case when s.city_part <> '' then s.city_part else c.city_part end,
    lat = coalesce(s.lat, c.lat), lng = coalesce(s.lng, c.lng),
    phone = coalesce(nullif(c.phone,''), s.phone, ''), email = coalesce(nullif(c.email,''), s.email, ''), web = coalesce(nullif(c.web,''), s.web, ''),
    updated_at = now()
  from nrpzs_staging s
  where c.nrpzs_id = any(s.all_ids) and not c.hidden
    and (c.nrpzs_id, c.ico, c.legal_name, c.obory_raw, c.street, c.zip, c.city, c.okres, c.kraj, c.lat, c.lng)
        is distinct from (s.nrpzs_id, s.ico, case when c.premium then c.legal_name else s.legal_name end, s.obory_raw, s.street, s.zip, s.city, s.okres, s.kraj, coalesce(s.lat, c.lat), coalesce(s.lng, c.lng));
  get diagnostics upd = row_count;

  update clinics c set hidden = true, updated_at = now(),
    admin_note = coalesce(c.admin_note,'') || ' Skryto ' || to_char(now(), 'DD.MM.YYYY') || ': už není v NRPZS (ukončená činnost).'
  where c.nrpzs_id is not null and not c.hidden and not c.premium
    and not exists (select 1 from nrpzs_staging s where c.nrpzs_id = any(s.all_ids));
  get diagnostics hid = row_count;

  insert into clinics (slug, nrpzs_id, ico, legal_name, display_name, categories, is_clinic, obory_raw, street, zip, city, city_part, okres, kraj, lat, lng, phone, email, web,
    description, photos, insurers, opening_hours, premium, hidden)
  select case when exists (select 1 from clinics x where x.slug = s.slug_base) then s.slug_base || '-' || s.nrpzs_id else s.slug_base end,
    s.nrpzs_id, s.ico, s.legal_name, s.display_name, s.categories, s.is_clinic, s.obory_raw, s.street, s.zip, s.city, s.city_part, s.okres, s.kraj, s.lat, s.lng,
    coalesce(s.phone,''), coalesce(s.email,''), coalesce(s.web,''), '', '{}', '{}', '', false, false
  from nrpzs_staging s
  where not exists (select 1 from clinics c where c.nrpzs_id = any(s.all_ids));
  get diagnostics ins = row_count;

  truncate nrpzs_staging;
  return jsonb_build_object('staged', staged, 'updated', upd, 'hidden', hid, 'inserted', ins);
end $$;

revoke all on function public.nrpzs_stage_rows(jsonb), public.nrpzs_apply(), public.nrpzs_clear() from public;
grant execute on function public.nrpzs_stage_rows(jsonb), public.nrpzs_apply(), public.nrpzs_clear() to anon;
