-- zubnikliniky.cz – databázové schéma pro Supabase
-- Spusť celé v Supabase: SQL Editor → New query → vložit → Run.


-- ============ Správci ============
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- První přihlášený uživatel si může roli správce vzít jednorázově (dokud je tabulka prázdná).
create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.admins) then return public.is_admin(); end if;
  insert into public.admins (user_id, email) values (auth.uid(), auth.jwt() ->> 'email');
  return true;
end $$;

-- ============ Ordinace ============
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nrpzs_id text,
  ico text,
  legal_name text not null,
  display_name text not null,
  categories text[] not null default '{}',
  is_clinic boolean not null default false,
  obory_raw text default '',
  street text default '',
  zip text default '',
  city text default '',
  city_part text default '',
  okres text default '',
  kraj text default 'Moravskoslezský kraj',
  lat double precision,
  lng double precision,
  phone text default '',
  email text default '',
  web text default '',
  description text default '',
  photos text[] not null default '{}',
  insurers text[] not null default '{}',
  accepts_new text check (accepts_new in ('ano','ne','omezene')),
  accepts_new_checked_at date,
  accepts_new_note text default '',
  opening_hours text default '',
  premium boolean not null default false,
  premium_until date,
  hidden boolean not null default false,
  admin_note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists clinics_city_idx on public.clinics (city);
create index if not exists clinics_nrpzs_idx on public.clinics (nrpzs_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists clinics_touch on public.clinics;
create trigger clinics_touch before update on public.clinics for each row execute function public.touch_updated_at();

-- ============ Recenze ============
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 60),
  email text not null,                 -- nikdy se nezobrazuje, slouží k ověření a kontaktu při sporu
  email_hash text not null,
  ip_hash text,
  rating smallint not null check (rating between 1 and 5),
  text text not null check (char_length(text) between 20 and 3000),
  status text not null default 'pending' check (status in ('pending','published','hidden')),
  verify_token text unique,
  verified_at timestamptz,
  clinic_reply text,
  clinic_reply_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists reviews_clinic_idx on public.reviews (clinic_id, status);
create index if not exists reviews_email_idx on public.reviews (email_hash, created_at);

-- ============ Poptávky termínu od pacientů ============
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  name text not null,
  phone text,
  email text,
  insurer text,
  patient_type text,          -- dospělý / dítě
  message text,
  forwarded_to text,          -- komu byla poptávka odeslána e-mailem
  status text not null default 'new' check (status in ('new','forwarded','done','spam')),
  ip_hash text,
  created_at timestamptz default now()
);

-- ============ Nahlášení (recenze nebo neaktuálních údajů) ============
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('review','data')),
  clinic_id uuid references public.clinics(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  message text not null,
  email text,
  resolved boolean not null default false,
  created_at timestamptz default now()
);

-- ============ Žádosti ordinací (úprava profilu / prémiový profil) ============
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  clinic_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  interest text not null check (interest in ('udaje','premium','odpoved')),
  message text,
  status text not null default 'new' check (status in ('new','contacted','won','lost')),
  created_at timestamptz default now()
);

-- ============ Statistiky (denní souhrny, bez cookies a osobních údajů) ============
create table if not exists public.clinic_stats (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('view','web','phone','email','map','inquiry')),
  count integer not null default 0,
  primary key (clinic_id, day, kind)
);

create or replace function public.track_event(p_clinic uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  insert into public.clinic_stats (clinic_id, day, kind, count)
  values (p_clinic, (now() at time zone 'Europe/Prague')::date, p_kind, 1)
  on conflict (clinic_id, day, kind) do update set count = clinic_stats.count + 1;
$$;
revoke all on function public.track_event(uuid, text) from public, anon, authenticated;

-- ============ Oprávnění (RLS) ============
alter table public.admins enable row level security;
alter table public.clinics enable row level security;
alter table public.reviews enable row level security;
alter table public.inquiries enable row level security;
alter table public.reports enable row level security;
alter table public.claims enable row level security;
alter table public.clinic_stats enable row level security;

-- Veřejnost do databáze přímo nesmí vůbec (obsahuje interní poznámky). Web čte data při buildu
-- a zapisuje přes své API se service role klíčem; administrace pracuje jako přihlášený správce.
drop policy if exists clinics_public_read on public.clinics;
drop policy if exists clinics_admin_all on public.clinics;
create policy clinics_admin_all on public.clinics for all using (public.is_admin()) with check (public.is_admin());

-- Recenze: veřejnost nevidí nic přímo (e-maily!), web je čte při buildu přes service role.
do $$ declare t text; begin
  foreach t in array array['reviews','inquiries','reports','claims','clinic_stats','admins'] loop
    execute format('drop policy if exists %1$s_admin_all on public.%1$s', t);
    execute format('create policy %1$s_admin_all on public.%1$s for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ============ Fotky ============
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists photos_public_read on storage.objects;
create policy photos_public_read on storage.objects for select using (bucket_id = 'photos');
drop policy if exists photos_admin_write on storage.objects;
create policy photos_admin_write on storage.objects for all using (bucket_id = 'photos' and public.is_admin()) with check (bucket_id = 'photos' and public.is_admin());
