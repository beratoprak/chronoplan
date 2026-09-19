-- Epoche v7 — çıkmış sınav sorusu bankası
-- Eklemeli ve idempotent. Mevcut veriye dokunmaz.

CREATE TABLE IF NOT EXISTS ybs_questions (
  id           text PRIMARY KEY,                     -- ybs:q:<cmid>:<soru no>
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ders_kodu    text NOT NULL,
  unit_id      text,                                 -- bölüm eşleşmezse NULL kalır
  kaynak_cmid  integer,
  soru_no      integer NOT NULL,
  bolum_no     integer,
  govde        text NOT NULL,
  secenekler   jsonb NOT NULL DEFAULT '[]',
  dogru        text CHECK (dogru IS NULL OR dogru IN ('A','B','C','D','E')),
  last_verified_at timestamptz NOT NULL DEFAULT now()
);

-- Deneme kaydı: hangi soruyu ne zaman, doğru mu çözdü. Bu tablo KULLANICININDIR.
CREATE TABLE IF NOT EXISTS ybs_question_attempts (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id text NOT NULL,
  verilen     text CHECK (verilen IS NULL OR verilen IN ('A','B','C','D','E')),
  dogru_mu    boolean NOT NULL,
  cozuldu_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ybs_questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_question_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY ybs_questions_owner ON ybs_questions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_attempts_owner  ON ybs_question_attempts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ybs_questions_unit ON ybs_questions (user_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_ybs_questions_ders ON ybs_questions (user_id, ders_kodu);
CREATE INDEX IF NOT EXISTS idx_ybs_attempts_q     ON ybs_question_attempts (user_id, question_id);
