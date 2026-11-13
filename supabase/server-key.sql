-- Serverový klíč: web (Vercel) se k databázi hlásí veřejným klíčem a tajnou hlavičkou x-server-key.
-- V databázi je uložen jen otisk (sha256) klíče, mimo veřejné API. Klíč sám je jen v proměnné
-- SUPABASE_SERVER_KEY na Vercelu. Nastavení otisku:
--   insert into private.server_keys (hash) values (encode(sha256(convert_to('<klíč>', 'utf8')), 'hex'));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.server_keys (hash text primary key, created_at timestamptz default now());

create or replace function public.is_server() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.server_keys k
    where k.hash = encode(sha256(convert_to(
      coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-server-key', ''), 'utf8')), 'hex')
  );
$$;

grant select, insert, update, delete on public.clinics, public.reviews, public.inquiries, public.reports, public.claims, public.clinic_stats to anon, authenticated;
grant select, insert, delete on public.admins to authenticated;
grant select on public.admins to anon;

do $$ declare t text; begin
  foreach t in array array['clinics','reviews','inquiries','reports','claims','clinic_stats','admins'] loop
    execute format('drop policy if exists %1$s_server_all on public.%1$s', t);
    execute format('create policy %1$s_server_all on public.%1$s for all to anon using (public.is_server()) with check (public.is_server())', t);
  end loop;
end $$;

-- Počítadlo zobrazení smí volat jen server.
create or replace function public.track_event(p_clinic uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_server() then raise exception 'forbidden'; end if;
  insert into public.clinic_stats (clinic_id, day, kind, count)
  values (p_clinic, (now() at time zone 'Europe/Prague')::date, p_kind, 1)
  on conflict (clinic_id, day, kind) do update set count = clinic_stats.count + 1;
end $$;
grant execute on function public.track_event(uuid, text) to anon;
revoke execute on function public.claim_first_admin() from anon;
