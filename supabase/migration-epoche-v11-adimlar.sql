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
