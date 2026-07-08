-- ============================================================
-- Epoche v1.0 — Veri Güvenliği Migration'ı
-- Supabase Dashboard > SQL Editor'de bir kez çalıştırın.
-- Mevcut veriye dokunmaz; yalnızca kolon ve tablo ekler.
-- ============================================================

-- ── Soft delete: silinen kayıtlar fiziksel silinmez, işaretlenir ──
ALTER TABLE tasks  ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at text NOT NULL DEFAULT '';
ALTER TABLE notes  ADD COLUMN IF NOT EXISTS deleted_at text;

-- Tarihsiz görevler push edilebilsin (uygulama tarihsiz göreve izin veriyor)
ALTER TABLE tasks ALTER COLUMN date DROP NOT NULL;

-- ── Zengin Notlar ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rich_notes (
  id          text        PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text        NOT NULL DEFAULT '',
  content     text        NOT NULL DEFAULT '',
  tags        jsonb       NOT NULL DEFAULT '[]',
  pinned      boolean     NOT NULL DEFAULT false,
  created_at  text        NOT NULL,
  updated_at  text        NOT NULL,
  deleted_at  text
);

-- ── Medya (Kitap / Film / Makale) ─────────────────────────────
CREATE TABLE IF NOT EXISTS media_items (
  id          text        PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        text        NOT NULL CHECK (type IN ('book', 'movie', 'paper')),
  title       text        NOT NULL,
  author      text,
  director    text,
  journal     text,
  doi         text,
  abstract    text,
  year        integer,
  rating      integer,
  notes       text,
  status      text        NOT NULL CHECK (status IN ('want', 'in_progress', 'done')),
  created_at  text        NOT NULL,
  updated_at  text        NOT NULL,
  deleted_at  text
);

-- ── Pomodoro Oturumları ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_sessions (
  id                text        PRIMARY KEY,
  user_id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_label     text        NOT NULL DEFAULT 'Genel',
  duration_minutes  integer     NOT NULL,
  phase             text        NOT NULL CHECK (phase IN ('work', 'short_break', 'long_break')),
  completed_at      text        NOT NULL
);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE rich_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "rich_notes_owner" ON rich_notes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "media_items_owner" ON media_items
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "work_sessions_owner" ON work_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── İndeksler ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rich_notes_user    ON rich_notes    (user_id);
CREATE INDEX IF NOT EXISTS idx_media_items_user   ON media_items   (user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions (user_id);
