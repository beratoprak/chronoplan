-- Epoche v13 — Gemini çıktıları (Plan v3, Faz G).
--
-- Motor (GitHub Actions) yazar, Epoche okur. Gemini yanıt vermezse son tahmin
-- kalır; hiç tahmin yoksa planlayıcı kendi kural tabanlı süresini kullanır.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Yeniden çalıştırmak zararsız.

-- Konu başına zorluk ve süre tahmini.
create table if not exists public.ybs_unit_tahmin (
  unit_id     text primary key,                 -- ybs_units.id
  user_id     uuid not null references auth.users (id) on delete cascade,
  zorluk      smallint not null check (zorluk between 1 and 5),
  dakika      integer not null check (dakika between 5 and 600),
  gerekce     text,
  kaynak      text not null default 'gemini' check (kaynak in ('gemini', 'kural')),
  model       text,
  girdi_ozeti text,                             -- girdi değişince yeniden tahmin
  olusturma   timestamptz not null default now()
);

-- Haftanın açıklaması: planla birlikte gün sayfasının ve panelin üstünde.
create table if not exists public.ybs_haftalik_aciklama (
  id          text primary key,                 -- <user_id>:<hafta>
  user_id     uuid not null references auth.users (id) on delete cascade,
  hafta       date not null,                    -- haftanın pazartesisi
  metin       text not null,
  model       text,
  plan_ozeti  text,                             -- plan değişince (yeniden planla) yeniden yazılır
  olusturma   timestamptz not null default now()
);

-- Tanınmayan türdeki yeni OYS malzemesi için Gemini'nin tür tahmini.
alter table public.ybs_modules add column if not exists tur_tahmini text
  check (tur_tahmini in ('kitap', 'video', 'ses', 'alistirma', 'okuma', 'diger'));

alter table public.ybs_unit_tahmin enable row level security;
alter table public.ybs_haftalik_aciklama enable row level security;

do $$ begin
  create policy ybs_unit_tahmin_owner on public.ybs_unit_tahmin
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy ybs_haftalik_aciklama_owner on public.ybs_haftalik_aciklama
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
