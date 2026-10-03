-- Epoche v15 — Figürlerim: takvimin köşesinde sallanan, kullanıcının yüklediği resimler.
--
-- Resim küçültülüp (en fazla 256 px) veri adresi olarak satırda durur; yalnız
-- sahibi okur/yazar. Kodda ya da herkese açık bir yerde durmaz.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Yeniden çalıştırmak zararsız.

create table if not exists public.epoche_figurler (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  ad          text,
  resim       text not null check (length(resim) < 400000),   -- data:image/...;base64
  sira        smallint not null default 0,
  olusturma   timestamptz not null default now()
);

create index if not exists idx_figurler_user on public.epoche_figurler (user_id, sira);

alter table public.epoche_figurler enable row level security;

do $$ begin
  create policy epoche_figurler_owner on public.epoche_figurler
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
