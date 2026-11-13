-- Správcem administrace se může stát jen přihlášený účet, jehož e-mail je na seznamu.
-- Přidání dalšího správce:  insert into private.admin_emails (email) values ('nekdo@example.cz');
create table if not exists private.admin_emails (email text primary key);

create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.admins where user_id = auth.uid()) then return true; end if;
  if not exists (select 1 from private.admin_emails e where lower(e.email) = v_email) then return false; end if;
  insert into public.admins (user_id, email) values (auth.uid(), v_email);
  return true;
end $$;
revoke execute on function public.claim_first_admin() from public, anon;
grant execute on function public.claim_first_admin() to authenticated;
