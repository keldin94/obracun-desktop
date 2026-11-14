-- OBRAČUN cloud podaci. Pokrenuti u Supabase SQL Editoru u projektu po izboru.
-- Za klijentsku aplikaciju koristi samo publishable/anon key, nikad service_role.
create table if not exists public.obracun_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision >= 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.obracun_snapshots enable row level security;
revoke all on public.obracun_snapshots from anon;
grant select, insert, update on public.obracun_snapshots to authenticated;

drop policy if exists obracun_read_own on public.obracun_snapshots;
create policy obracun_read_own on public.obracun_snapshots for select to authenticated using (auth.uid() = user_id);
drop policy if exists obracun_insert_own on public.obracun_snapshots;
create policy obracun_insert_own on public.obracun_snapshots for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists obracun_update_own on public.obracun_snapshots;
create policy obracun_update_own on public.obracun_snapshots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Prilozi su privatni. Korisnik smije raditi samo u svom podfolderu UUID/ID-priloga.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('obracun-dokaznice','obracun-dokaznice',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false;

drop policy if exists obracun_proofs_read on storage.objects;
create policy obracun_proofs_read on storage.objects for select to authenticated
using (bucket_id='obracun-dokaznice' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists obracun_proofs_insert on storage.objects;
create policy obracun_proofs_insert on storage.objects for insert to authenticated
with check (bucket_id='obracun-dokaznice' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists obracun_proofs_update on storage.objects;
create policy obracun_proofs_update on storage.objects for update to authenticated
using (bucket_id='obracun-dokaznice' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id='obracun-dokaznice' and (storage.foldername(name))[1] = (select auth.uid()::text));