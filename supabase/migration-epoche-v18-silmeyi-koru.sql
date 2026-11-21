-- v18: Silinmiş kaydı eski bir yazma diriltemesin.
--
-- Sorun: istemci her eşitlemede tüm görevleri yeniden gönderiyor ve outbox,
-- sunucudan çekmeden önce boşalıyor. Eski bir cihazdaki (ör. telefonda eski bir
-- Safari sekmesi) kopya, silme işaretini `deleted_at = null` ile eziyor; silinen
-- görevler/etkinlikler geri geliyor, çift kayıt görünüyor.
--
-- Kural: kayıt silinmişse ve gelen yazmanın updated_at'i silinme anından yeni
-- değilse, deleted_at korunur. Silmeden SONRA bilinçli geri alma (daha yeni
-- updated_at) hâlâ çalışır.

create or replace function public.epoche_silmeyi_koru()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is not null and new.deleted_at is null
     and coalesce(nullif(new.updated_at::text, '')::timestamptz, 'epoch'::timestamptz)
         <= old.deleted_at::timestamptz then
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'events', 'rich_notes', 'media_items'] loop
    execute format('drop trigger if exists epoche_silmeyi_koru on public.%I', t);
    execute format(
      'create trigger epoche_silmeyi_koru before update on public.%I
         for each row execute function public.epoche_silmeyi_koru()', t);
  end loop;
end $$;
