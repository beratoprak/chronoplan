-- Epoche v14 — sınav oturumları (Plan v3, Faz H).
--
-- Sınav giriş belgesi çıkınca Okul → Sınav programı'ndan dersler topluca girilir:
-- hangi gün, kaçıncı oturum. Planlayıcı tekrar günlerini buna göre dizer; sınav
-- günü sayfası o günün oturumlarını gösterir. Kullanıcı yazar, motor okur.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Yeniden çalıştırmak zararsız.

create table if not exists public.ybs_sinav_oturum (
  id          text primary key,                 -- <user_id>:<dilim>:<ders_kodu>
  user_id     uuid not null references auth.users (id) on delete cascade,
  dilim       text not null check (dilim in ('vize', 'final')),
  ders_kodu   text not null,
  tarih       date not null,
  oturum      smallint not null check (oturum between 1 and 6),
  olusturma   timestamptz not null default now()
);

create index if not exists idx_sinav_oturum on public.ybs_sinav_oturum (user_id, dilim);

alter table public.ybs_sinav_oturum enable row level security;

do $$ begin
  create policy ybs_sinav_oturum_owner on public.ybs_sinav_oturum
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
