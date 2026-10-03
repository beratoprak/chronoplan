-- Epoche v16 — PDF çalışma alanı: vurgular ve PDF'in yanındaki notlar.
--
-- belge: depodaki PDF yolu (ör. AAUF1103/37017.pdf). Kutular sayfaya oranla
-- (0-1) tutulur; yakınlaştırma değişse de vurgu yerinde kalır.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Yeniden çalıştırmak zararsız.

create table if not exists public.epoche_pdf_isaret (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  belge       text not null,
  sayfa       integer not null check (sayfa > 0),
  tur         text not null check (tur in ('vurgu', 'alti')),
  renk        text not null default 'sari',
  kutular     jsonb not null,                    -- [{x,y,w,h}] sayfaya oranla
  metin       text,
  olusturma   timestamptz not null default now()
);

create table if not exists public.epoche_pdf_not (
  id          text primary key,                  -- <user_id>:<belge>
  user_id     uuid not null references auth.users (id) on delete cascade,
  belge       text not null,
  metin       text not null default '',
  guncelleme  timestamptz not null default now()
);

create index if not exists idx_pdf_isaret on public.epoche_pdf_isaret (user_id, belge, sayfa);

alter table public.epoche_pdf_isaret enable row level security;
alter table public.epoche_pdf_not enable row level security;

do $$ begin
  create policy epoche_pdf_isaret_owner on public.epoche_pdf_isaret
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy epoche_pdf_not_owner on public.epoche_pdf_not
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
