-- Epoche v12 — haftalık çalışma planı (Plan v3, Faz B).
--
-- Her satır: bir günün bir dersi. Gün sayfası ve takvim buradan okur.
-- Plan Epoche'nin içinde hesaplanıp kullanıcının kendi oturumuyla yazılır;
-- motor bu tabloya dokunmaz.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Yeniden çalıştırmak zararsız.

create table if not exists public.ybs_haftalik_plan (
  id          text primary key,                 -- <tarih>:<sira>
  user_id     uuid not null references auth.users (id) on delete cascade,
  hafta       date not null,                    -- haftanın pazartesisi
  tarih       date not null,
  gun_turu    text not null check (gun_turu in ('calisma', 'tekrar', 'sinav', 'bos')),
  sira        smallint not null default 0,      -- günün kaçıncı dersi (0 = ders yok)
  ders_kodu   text,
  tur         text check (tur in ('konu', 'tekrar')),
  dakika      integer not null default 0,
  parcalar    jsonb not null default '[]'::jsonb,  -- [{unit_id, baslik, dakika, devam, bitiyor}]
  olusturma   timestamptz not null default now()
);

create index if not exists idx_haftalik_plan_tarih on public.ybs_haftalik_plan (user_id, tarih);

alter table public.ybs_haftalik_plan enable row level security;

do $$ begin
  create policy ybs_haftalik_plan_owner on public.ybs_haftalik_plan
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
