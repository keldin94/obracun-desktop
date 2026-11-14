-- OBRAČUN v0.2: organizations, site-scoped access, and collaborative snapshots.
-- Run once in a DEDICATED Supabase project with SQL Editor.
-- Do not use a service-role key in a desktop or browser client.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists obracun_private;

create table if not exists public.obracun_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.obracun_members (
  company_id uuid not null references public.obracun_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  all_sites boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id,user_id)
);
create table if not exists public.obracun_sites (
  company_id uuid not null references public.obracun_companies(id) on delete cascade,
  site_id text not null check (length(site_id) between 6 and 100 and site_id ~ '^[a-zA-Z0-9_-]+$'),
  revision bigint not null default 1 check (revision>0),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (company_id,site_id)
);
create table if not exists public.obracun_site_grants (
  company_id uuid not null,
  user_id uuid not null,
  site_id text not null,
  primary key (company_id,user_id,site_id),
  foreign key (company_id,user_id) references public.obracun_members(company_id,user_id) on delete cascade
);
create table if not exists obracun_private.invitations (
  token_hash text primary key,
  company_id uuid not null references public.obracun_companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','editor','viewer')),
  all_sites boolean not null,
  site_ids text[] not null default '{}',
  expires_at timestamptz not null default (now()+interval '7 days'),
  created_by uuid not null references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz
);
create index if not exists obracun_invites_email_idx on obracun_private.invitations(lower(email));

alter table public.obracun_companies enable row level security;
alter table public.obracun_members enable row level security;
alter table public.obracun_sites enable row level security;
alter table public.obracun_site_grants enable row level security;

revoke all on public.obracun_companies, public.obracun_members, public.obracun_sites, public.obracun_site_grants from anon, authenticated;
grant select on public.obracun_companies, public.obracun_members, public.obracun_sites, public.obracun_site_grants to authenticated;
grant insert, update, delete on public.obracun_sites to authenticated;

-- Privileged helper functions are in a schema NOT exposed through PostgREST.
create or replace function obracun_private.is_member(p_company uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.obracun_members m where m.company_id=p_company and m.user_id=(select auth.uid()))$$;
create or replace function obracun_private.can_manage(p_company uuid)
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.obracun_members m where m.company_id=p_company and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))$$;
create or replace function obracun_private.can_see_site(p_company uuid,p_site text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.obracun_members m
  where m.company_id=p_company and m.user_id=(select auth.uid())
   and (m.role in ('owner','admin') or m.all_sites or
     exists(select 1 from public.obracun_site_grants g where g.company_id=p_company and g.user_id=m.user_id and g.site_id=p_site)))
$$;
create or replace function obracun_private.can_edit_site(p_company uuid,p_site text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.obracun_members m
  where m.company_id=p_company and m.user_id=(select auth.uid())
  and (m.role in ('owner','admin') or
       (m.role='editor' and (m.all_sites or
        exists(select 1 from public.obracun_site_grants g where g.company_id=p_company and g.user_id=m.user_id and g.site_id=p_site)))))
$$;
revoke all on function obracun_private.is_member(uuid), obracun_private.can_manage(uuid), obracun_private.can_see_site(uuid,text), obracun_private.can_edit_site(uuid,text) from public;
grant usage on schema obracun_private to authenticated;
grant execute on function obracun_private.is_member(uuid), obracun_private.can_manage(uuid), obracun_private.can_see_site(uuid,text), obracun_private.can_edit_site(uuid,text) to authenticated;

drop policy if exists ob_companies_read on public.obracun_companies;
create policy ob_companies_read on public.obracun_companies for select to authenticated using (obracun_private.is_member(id));
drop policy if exists ob_members_read on public.obracun_members;
create policy ob_members_read on public.obracun_members for select to authenticated using (obracun_private.is_member(company_id));
drop policy if exists ob_grants_read on public.obracun_site_grants;
create policy ob_grants_read on public.obracun_site_grants for select to authenticated using (user_id=(select auth.uid()) or obracun_private.can_manage(company_id));
drop policy if exists ob_sites_read on public.obracun_sites;
create policy ob_sites_read on public.obracun_sites for select to authenticated using (obracun_private.can_see_site(company_id,site_id));
drop policy if exists ob_sites_insert on public.obracun_sites;
create policy ob_sites_insert on public.obracun_sites for insert to authenticated with check (obracun_private.can_manage(company_id) and updated_by=(select auth.uid()));
drop policy if exists ob_sites_update on public.obracun_sites;
create policy ob_sites_update on public.obracun_sites for update to authenticated using (obracun_private.can_edit_site(company_id,site_id)) with check (obracun_private.can_edit_site(company_id,site_id) and updated_by=(select auth.uid()));
drop policy if exists ob_sites_delete on public.obracun_sites;
create policy ob_sites_delete on public.obracun_sites for delete to authenticated using (obracun_private.can_manage(company_id));

create or replace function public.obracun_create_company(p_name text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Prijava je obavezna'; end if;
 if length(btrim(coalesce(p_name,''))) not between 2 and 160 then raise exception 'Upiši naziv firme'; end if;
 insert into public.obracun_companies(name,created_by) values(btrim(p_name),(select auth.uid())) returning id into v_id;
 insert into public.obracun_members(company_id,user_id,role,all_sites) values(v_id,(select auth.uid()),'owner',true);
 return v_id;
end $$;

create or replace function public.obracun_create_invite(p_company uuid,p_email text,p_role text,p_all_sites boolean default true,p_sites text[] default '{}')
returns text language plpgsql security definer set search_path=''
as $$
declare v_role text; v_token text; v_email text;
begin
 select role into v_role from public.obracun_members where company_id=p_company and user_id=(select auth.uid());
 if v_role not in ('owner','admin') or v_role is null then raise exception 'Nemaš dozvolu za pozivanje'; end if;
 if p_role not in ('admin','editor','viewer') or (p_role='admin' and v_role<>'owner') then raise exception 'Nije dozvoljena uloga'; end if;
 v_email:=lower(btrim(p_email));
 if length(v_email)>254 or v_email !~ '^[^@ ]+@[^@ ]+[.][^@ ]+$' then raise exception 'Neispravan e-mail'; end if;
 v_token:=encode(extensions.gen_random_bytes(24),'hex');
 insert into obracun_private.invitations(token_hash,company_id,email,role,all_sites,site_ids,created_by)
 values(encode(extensions.digest(v_token,'sha256'),'hex'),p_company,v_email,p_role,coalesce(p_all_sites,false),
   case when coalesce(p_all_sites,false) then '{}'::text[] else coalesce(p_sites,'{}') end,(select auth.uid()));
 return v_token;
end $$;

create or replace function public.obracun_accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_inv obracun_private.invitations%rowtype; v_email text; v_verified timestamptz; v_site text;
begin
 if (select auth.uid()) is null then raise exception 'Prijava je obavezna'; end if;
 select lower(email),email_confirmed_at into v_email,v_verified from auth.users where id=(select auth.uid());
 if v_verified is null then raise exception 'Prvo potvrdi e-mail adresu'; end if;
 select * into v_inv from obracun_private.invitations
  where token_hash=encode(extensions.digest(btrim(p_token),'sha256'),'hex') for update;
 if not found or v_inv.used_at is not null or v_inv.expires_at<now() then raise exception 'Poziv je nevažeći ili istekao'; end if;
 if v_inv.email<>v_email then raise exception 'Poziv pripada drugoj e-mail adresi'; end if;
 if exists(select 1 from public.obracun_members where company_id=v_inv.company_id and user_id=(select auth.uid())) then
  raise exception 'Već si član firme';
 end if;
 insert into public.obracun_members(company_id,user_id,role,all_sites)
 values(v_inv.company_id,(select auth.uid()),v_inv.role,v_inv.all_sites);
 if not v_inv.all_sites then
  foreach v_site in array v_inv.site_ids loop
   if length(v_site) between 6 and 100 and v_site ~ '^[a-zA-Z0-9_-]+$' then
    insert into public.obracun_site_grants(company_id,user_id,site_id)
    values(v_inv.company_id,(select auth.uid()),v_site) on conflict do nothing;
   end if;
  end loop;
 end if;
 update obracun_private.invitations set used_at=now(), used_by=(select auth.uid()) where token_hash=v_inv.token_hash;
 return v_inv.company_id;
end $$;

create or replace function public.obracun_list_users(p_company uuid)
returns table(user_id uuid,email text,role text,all_sites boolean,site_ids text[])
language plpgsql security definer set search_path=''
as $$
begin
 if not obracun_private.can_manage(p_company) then raise exception 'Nemaš dozvolu'; end if;
 return query select m.user_id,u.email::text,m.role,m.all_sites,
  coalesce((select array_agg(g.site_id order by g.site_id) from public.obracun_site_grants g
      where g.company_id=p_company and g.user_id=m.user_id),'{}'::text[])
 from public.obracun_members m join auth.users u on u.id=m.user_id where m.company_id=p_company;
end $$;

create or replace function public.obracun_update_member(p_company uuid,p_user uuid,p_role text,p_all_sites boolean,p_sites text[] default '{}')
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor text; v_current text; v_site text;
begin
 select role into v_actor from public.obracun_members where company_id=p_company and user_id=(select auth.uid());
 select role into v_current from public.obracun_members where company_id=p_company and user_id=p_user;
 if v_actor not in ('owner','admin') or v_current is null then raise exception 'Nemaš dozvolu'; end if;
 if v_current='owner' or p_role='owner' then raise exception 'Vlasnik se ne može mijenjati'; end if;
 if p_role not in ('admin','editor','viewer') then raise exception 'Neispravna uloga'; end if;
 if (v_current='admin' or p_role='admin') and v_actor<>'owner' then raise exception 'Samo vlasnik mijenja administratore'; end if;
 update public.obracun_members set role=p_role,all_sites=coalesce(p_all_sites,false)
  where company_id=p_company and user_id=p_user;
 delete from public.obracun_site_grants where company_id=p_company and user_id=p_user;
 if not coalesce(p_all_sites,false) then
  foreach v_site in array coalesce(p_sites,'{}'::text[]) loop
   if length(v_site) between 6 and 100 and v_site ~ '^[a-zA-Z0-9_-]+$' then
     insert into public.obracun_site_grants(company_id,user_id,site_id)
     values(p_company,p_user,v_site) on conflict do nothing;
   end if;
  end loop;
 end if;
end $$;

create or replace function public.obracun_remove_member(p_company uuid,p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor text;v_current text;
begin
 select role into v_actor from public.obracun_members where company_id=p_company and user_id=(select auth.uid());
 select role into v_current from public.obracun_members where company_id=p_company and user_id=p_user;
 if v_actor not in ('owner','admin') or v_current is null then raise exception 'Nemaš dozvolu'; end if;
 if v_current='owner' or (v_current='admin' and v_actor<>'owner') then raise exception 'Nedozvoljeno uklanjanje'; end if;
 delete from public.obracun_members where company_id=p_company and user_id=p_user;
end $$;

revoke all on function public.obracun_create_company(text),public.obracun_create_invite(uuid,text,text,boolean,text[]),
 public.obracun_accept_invite(text),public.obracun_list_users(uuid),
 public.obracun_update_member(uuid,uuid,text,boolean,text[]),public.obracun_remove_member(uuid,uuid) from public,anon;
grant execute on function public.obracun_create_company(text),public.obracun_create_invite(uuid,text,text,boolean,text[]),
 public.obracun_accept_invite(text),public.obracun_list_users(uuid),
 public.obracun_update_member(uuid,uuid,text,boolean,text[]),public.obracun_remove_member(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('obracun-site-proofs','obracun-site-proofs',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false;

drop policy if exists ob_site_proof_select on storage.objects;
create policy ob_site_proof_select on storage.objects for select to authenticated
 using (bucket_id='obracun-site-proofs' and
   obracun_private.can_see_site((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]));
drop policy if exists ob_site_proof_insert on storage.objects;
create policy ob_site_proof_insert on storage.objects for insert to authenticated
 with check (bucket_id='obracun-site-proofs' and
   obracun_private.can_edit_site((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]));
drop policy if exists ob_site_proof_update on storage.objects;
create policy ob_site_proof_update on storage.objects for update to authenticated
 using (bucket_id='obracun-site-proofs' and
   obracun_private.can_edit_site((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]))
 with check (bucket_id='obracun-site-proofs' and
   obracun_private.can_edit_site((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]));
drop policy if exists ob_site_proof_delete on storage.objects;
create policy ob_site_proof_delete on storage.objects for delete to authenticated
 using (bucket_id='obracun-site-proofs' and
   obracun_private.can_edit_site((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]));
