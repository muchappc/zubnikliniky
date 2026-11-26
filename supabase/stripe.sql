-- Předplatné prémiového profilu přes Stripe.
-- Záznam vzniká po zaplacení (webhook checkout.session.completed) a aktualizuje se
-- z webhooků customer.subscription.* a invoice.*. Pole clinics.premium / premium_until
-- jsou odvozená a nastavuje je webhook.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null check (plan in ('mesicni','rocni')),
  status text not null,               -- active, past_due, canceled, unpaid, incomplete…
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  email text,
  company text,
  ico text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists subscriptions_clinic_idx on public.subscriptions (clinic_id);

alter table public.subscriptions enable row level security;
grant select, insert, update, delete on public.subscriptions to anon, authenticated;
drop policy if exists subscriptions_server_all on public.subscriptions;
create policy subscriptions_server_all on public.subscriptions for all to anon using (public.is_server()) with check (public.is_server());
drop policy if exists subscriptions_admin_all on public.subscriptions;
create policy subscriptions_admin_all on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

-- Webhooky od Stripe chodí opakovaně; zpracované události si pamatujeme.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz default now()
);
alter table public.stripe_events enable row level security;
grant select, insert on public.stripe_events to anon;
drop policy if exists stripe_events_server_all on public.stripe_events;
create policy stripe_events_server_all on public.stripe_events for all to anon using (public.is_server()) with check (public.is_server());

grant delete on public.stripe_events to anon;
