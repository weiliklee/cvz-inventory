-- CVZ Inventory — product photos.
-- Run this once in the Supabase SQL Editor (after supabase-setup.sql and
-- supabase-auth-setup.sql). Safe to re-run: every statement is idempotent.
--
-- What this does:
--   1. Adds a nullable products.image_path column (stores the storage PATH,
--      never a full URL — the app builds the public URL itself).
--   2. Creates the public `product-images` storage bucket.
--   3. Adds storage.objects policies for that bucket only:
--        SELECT  -> anyone (bucket is public; product photos are not sensitive)
--        INSERT / UPDATE / DELETE -> editors only (same profiles role check as
--                   the existing "Editors write products" policy)
--
-- This script does NOT touch products / movements / purchase_orders / profiles
-- policies, and does not recreate any table.

-- 1. Photo path column -------------------------------------------------------
alter table products add column if not exists image_path text;

-- 2. Public storage bucket ---------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Belt and braces: if the bucket already existed as private, make it public.
-- Idempotent, and only affects this one bucket.
update storage.buckets set public = true where id = 'product-images';

-- Only compressed JPEGs, max 2 MB
update storage.buckets
set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg']
where id = 'product-images';

-- 3. Storage policies (bucket-scoped only) -----------------------------------
-- Read: anyone. The bucket is public, and the app reads images through
-- getPublicUrl(), which is an unauthenticated GET.
drop policy if exists "Product images are publicly readable" on storage.objects;
create policy "Product images are publicly readable" on storage.objects
  for select
  using (bucket_id = 'product-images');

-- Insert: editors only.
drop policy if exists "Editors upload product images" on storage.objects;
create policy "Editors upload product images" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'editor')
  );

-- Update: editors only.
drop policy if exists "Editors update product images" on storage.objects;
create policy "Editors update product images" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'editor')
  )
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'editor')
  );

-- Delete: editors only.
drop policy if exists "Editors delete product images" on storage.objects;
create policy "Editors delete product images" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'editor')
  );

-- Note: writing products.image_path is already editor-only, because it goes
-- through the existing products RLS "Editors write products" policy. No new
-- products policy is needed or created here.
