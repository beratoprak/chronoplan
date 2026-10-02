-- Epoche v10 + v11 + v12 — tek seferde çalıştır (2 Ekim 2026)
-- v10: PDF okuma izni, tasks kolonları · v11: konu checklist'i · v12: haftalık plan

-- Epoche v10 — 19 Eylül 2026 testinde bulunan üç şema kusurunun onarımı.
--
-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştırmak yeterli.
-- Hepsi yeniden çalıştırılabilir (idempotent); ikinci kez koşmak zarar vermez.

-- ─────────────────────────────────────────────────────────────
-- 1. Ders materyali kovasında okuma politikası
--
-- Kova özel ve `storage.objects` üzerinde bu kullanıcıya SELECT hakkı yoktu.
-- Sonuç: tarayıcı imzalı bağlantı isteyince RLS nesneyi gizliyor, Storage
-- "NoSuchKey" dönüyor, okuyucu "dosya yüklenmemiş olabilir" diyordu. Dosya
-- oradaydı; görme hakkı yoktu. PDF okuyucu bu yüzden hiçbir materyalde
-- açılmıyordu.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('ders-materyali', 'ders-materyali', false)
on conflict (id) do nothing;

drop policy if exists "ders materyalini giris yapan okur" on storage.objects;
create policy "ders materyalini giris yapan okur"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'ders-materyali');

-- ─────────────────────────────────────────────────────────────
-- 2. tasks tablosundaki eksik kolonlar ve NOT NULL tuzağı
--
-- v3 migration bu ortamda uygulanmamış: `due_date` yok. İstemci eksik kolonu
-- ayıklayıp yeniden deniyordu ama bu sırada `updated_at`'i de düşürüyordu ve
-- kolon NOT NULL/varsayılansız olduğu için ikinci deneme de patlıyordu. Tek
-- bir görev kaydı kuyruğu sonsuza kadar tıkayıp saniyede iki başarısız istek
-- atıyordu. İstemci tarafı ayrıca düzeltildi; burada şema hizalanıyor.
-- ─────────────────────────────────────────────────────────────

alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists scheduled_date date;
alter table public.tasks add column if not exists scheduled_start_time text;
alter table public.tasks add column if not exists scheduled_end_time text;
alter table public.tasks add column if not exists focus_date date;
alter table public.tasks add column if not exists recurrence text default 'none';

-- Damgası olmayan eski satırlar yazılamıyordu; varsayılan veriliyor.
alter table public.tasks alter column updated_at set default now();
alter table public.tasks alter column created_at set default now();
update public.tasks set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

-- Aynı tuzak diğer tablolarda da tekrarlanmasın.
alter table public.events alter column updated_at set default now();
alter table public.rich_notes alter column updated_at set default now();

-- ─────────────────────────────────────────────────────────────
-- 3. Soru denemesi tablosunun kullanıcı yazımına açık olduğunun teyidi
--
-- Not içindeki çıkmış soru çözüldüğünde artık buraya da kayıt düşüyor;
-- eskiden cevap yalnız notun JSON'una gömülüyordu ve plan motorunun
-- `dogru_oran` sinyali hiç beslenmiyordu.
-- ─────────────────────────────────────────────────────────────

alter table public.ybs_question_attempts enable row level security;

drop policy if exists "kendi denemelerini yonetir" on public.ybs_question_attempts;
create policy "kendi denemelerini yonetir"
  on public.ybs_question_attempts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Epoche v11 — konu checklist'i (Plan v3, Faz A).
--
-- Her konu dört adımla ilerler: Oku · İzle · Soru çöz · Hakimim. İşaretlenen
-- adım, işaretlendiği zamanla birlikte burada durur:
--   {"oku": "2026-10-03T19:12:00Z", "izle": null, "soru": "...", "hakim": null}
-- `durum` kolonu kalıyor ve adımlardan türetiliyor; eski sürümler bozulmasın.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Yeniden çalıştırmak zararsız.

alter table public.ybs_unit_progress
  add column if not exists adimlar jsonb not null default '{}'::jsonb;

comment on column public.ybs_unit_progress.adimlar is
  'Konu checklist''i: oku/izle/soru/hakim -> işaretlenme zamanı (ISO) ya da null';

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
