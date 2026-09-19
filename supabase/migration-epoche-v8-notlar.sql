-- Epoche v8 — okul not sistemi
-- Eklemeli ve idempotent. Mevcut notlara dokunmaz.

-- Not bir konuya bağlanabilir ama zorunlu değil: hem yapılı hem serbest not
-- aynı tabloda yaşar. Bağsız notlar bugünkü davranışını aynen sürdürür.
ALTER TABLE rich_notes ADD COLUMN IF NOT EXISTS unit_id text;
ALTER TABLE rich_notes ADD COLUMN IF NOT EXISTS ders_kodu text;
ALTER TABLE rich_notes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'serbest'
  CHECK (kind IN ('serbest', 'konu', 'ders'));
ALTER TABLE rich_notes ADD COLUMN IF NOT EXISTS icon text;

-- Notlar arası bağlantı için ayrı tablo YOK, bilinçli olarak.
-- [[başlık]] yazımı notun kendi metninde duruyor; bağlantıları ayrı bir tabloya
-- kopyalamak her kaydetmede bakım isteyen ve bayatlayabilen ikinci bir gerçek
-- yaratırdı. Birkaç yüz notta bağlantılar içerikten anında hesaplanıyor.

CREATE INDEX IF NOT EXISTS idx_rich_notes_unit ON rich_notes (user_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_rich_notes_ders ON rich_notes (user_id, ders_kodu);
