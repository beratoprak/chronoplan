-- ============================================================
-- ChronoPlan — Supabase Veritabanı Şeması
-- Faz 5: Supabase Entegrasyonu
-- ============================================================
-- Bu dosyayı Supabase Dashboard > SQL Editor'de çalıştırın.
-- ============================================================

-- ── Etiketler (Tags) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          text        PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        text        NOT NULL,
  color       text        NOT NULL CHECK (color IN ('work', 'personal', 'project', 'meeting')),
  created_at  timestamptz DEFAULT now()
);

-- ── Görevler (Tasks) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                  text        PRIMARY KEY,
  user_id             uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title               text        NOT NULL,
  description         text,
  status              text        NOT NULL CHECK (status IN ('planned', 'active', 'done')),
  priority            text        NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  tags                jsonb       NOT NULL DEFAULT '[]',
  estimated_minutes   integer,
  checklist           jsonb       NOT NULL DEFAULT '[]',
  date                text        NOT NULL,
  created_at          text        NOT NULL,
  updated_at          text        NOT NULL,
  completed_at        text,
  "order"             integer     NOT NULL DEFAULT 0
);

-- ── Günlük Notlar (Notes) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          text        PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        text        NOT NULL,
  content     text        NOT NULL DEFAULT '',
  plain_text  text        NOT NULL DEFAULT '',
  updated_at  text        NOT NULL,
  UNIQUE (user_id, date)
);

-- ── Takvim Etkinlikleri (Events) ──────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                    text        PRIMARY KEY,
  user_id               uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title                 text        NOT NULL,
  description           text,
  date                  text        NOT NULL,
  start_time            text,
  end_time              text,
  tag_color             text        NOT NULL CHECK (tag_color IN ('work', 'personal', 'project', 'meeting')),
  is_all_day            boolean     NOT NULL DEFAULT false,
  recurrence            text        NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  recurrence_end_date   text
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Tags: kullanıcı yalnızca kendi etiketlerini görebilir / yönetebilir
CREATE POLICY "tags_owner" ON tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tasks: kullanıcı yalnızca kendi görevlerini görebilir / yönetebilir
CREATE POLICY "tasks_owner" ON tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notes: kullanıcı yalnızca kendi notlarını görebilir / yönetebilir
CREATE POLICY "notes_owner" ON notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Events: kullanıcı yalnızca kendi etkinliklerini görebilir / yönetebilir
CREATE POLICY "events_owner" ON events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- İndeksler (performans)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_id   ON tasks   (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date       ON tasks   (user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks   (user_id, status);
CREATE INDEX IF NOT EXISTS idx_notes_user_date  ON notes   (user_id, date);
CREATE INDEX IF NOT EXISTS idx_events_user_id   ON events  (user_id);
CREATE INDEX IF NOT EXISTS idx_events_date      ON events  (user_id, date);
CREATE INDEX IF NOT EXISTS idx_tags_user_id     ON tags    (user_id);
