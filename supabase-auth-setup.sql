-- Run this once in the Supabase SQL Editor for this project.
-- Adds staff login (viewer / editor roles) on top of the existing
-- products / movements / purchase_orders tables.

-- 1. Profiles table: one row per auth user, holding their role.
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- 2. Auto-create a profile (default role: viewer) whenever a new user
-- signs up or is invited. Promote them to 'editor' manually afterwards
-- (see step 5 below).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Lock down products / movements / purchase_orders:
-- any signed-in staff can read, only editors can write.
alter table products enable row level security;
alter table movements enable row level security;
alter table purchase_orders enable row level security;

-- Drop whatever open policies exist today on these three tables so we
-- don't end up with conflicting/duplicate rules.
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where tablename in ('products', 'movements', 'purchase_orders')
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "Authenticated read products" on products
  for select using (auth.role() = 'authenticated');
create policy "Editors write products" on products
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'editor'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'editor'));

create policy "Authenticated read movements" on movements
  for select using (auth.role() = 'authenticated');
create policy "Editors write movements" on movements
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'editor'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'editor'));

create policy "Authenticated read purchase_orders" on purchase_orders
  for select using (auth.role() = 'authenticated');
create policy "Editors write purchase_orders" on purchase_orders
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'editor'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'editor'));

-- 4. After running this file: invite staff from
--    Authentication -> Users -> Invite user (Supabase dashboard).
--    Each invite auto-creates a 'viewer' profile row via the trigger above.

-- 5. Promote a staff member to editor once their profile row exists
--    (i.e. after they've been invited):
-- update profiles set role = 'editor' where email = 'someone@example.com';
