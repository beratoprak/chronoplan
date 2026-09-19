-- Epoche v9 — ezber kartı zamanlaması
-- Eklemeli ve idempotent.
--
-- Kartın METNİ burada tutulmuyor: o, notun içindeki blokta duruyor ve orası
-- kartın yazıldığı yer. Burada yalnız ZAMANLAMA var — aralık, kolaylık
-- katsayısı, sıradaki gösterim. İkisi farklı veri; kopya değil.
CREATE TABLE IF NOT EXISTS ybs_flashcards (
  id               text PRIMARY KEY,               -- blok içindeki cardId
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unit_id          text,
  ders_kodu        text,
  ease             numeric(4,2) NOT NULL DEFAULT 2.50,
  interval_days    integer NOT NULL DEFAULT 0,
  reps             integer NOT NULL DEFAULT 0,
  lapses           integer NOT NULL DEFAULT 0,
  due_at           timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz
);

ALTER TABLE ybs_flashcards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY ybs_flashcards_owner ON ybs_flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ybs_flashcards_due ON ybs_flashcards (user_id, due_at);
