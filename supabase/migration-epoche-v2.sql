-- ============================================================
-- Epoche v2 — Ayar Senkronu + Otomatik Bulut Yedekleri
-- Supabase Dashboard > SQL Editor'de bir kez çalıştırın.
-- Mevcut veriye dokunmaz; yalnızca iki tablo ekler.
-- ============================================================

-- ── Kullanıcı ayarları (pomodoro, tema) ───────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pomodoro    jsonb,
  theme       text,
  updated_at  text        NOT NULL
);

-- ── Otomatik tam yedekler (günde 1 kez, uygulama kendisi alır) ─
CREATE TABLE IF NOT EXISTS backups (
  id          text        PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at  text        NOT NULL,
  data        jsonb       NOT NULL
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user_settings_owner" ON user_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "backups_owner" ON backups
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_backups_user ON backups (user_id, created_at);
