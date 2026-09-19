-- Epoche v4 — YBS Okul alanı. Yalnız eklemeli/idempotent migration.
-- Mevcut kullanıcı olayları, görevleri ve notları değiştirilmez.

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_managed boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminders jsonb NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS ack_required boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS acked_at timestamptz;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_managed boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminders jsonb NOT NULL DEFAULT '[]';

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%tag_color%'
  LOOP EXECUTE format('ALTER TABLE events DROP CONSTRAINT %I', c); END LOOP;
END $$;
ALTER TABLE events ADD CONSTRAINT events_tag_color_check CHECK (tag_color IN ('work','personal','project','meeting','school'));

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'tags'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%color%'
  LOOP EXECUTE format('ALTER TABLE tags DROP CONSTRAINT %I', c); END LOOP;
END $$;
ALTER TABLE tags ADD CONSTRAINT tags_color_check CHECK (color IN ('work','personal','project','meeting','school'));

CREATE TABLE IF NOT EXISTS ybs_sources (
  id text PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ad text NOT NULL, url text, content_hash text, last_ok_at timestamptz, last_try_at timestamptz,
  last_error text, max_age_hours integer NOT NULL DEFAULT 24,
  durum text NOT NULL DEFAULT 'bilinmiyor' CHECK (durum IN ('taze','degisti','gecici-hata','BAYAT','bilinmiyor'))
);

CREATE TABLE IF NOT EXISTS ybs_courses (
  kod text PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ad text NOT NULL, yariyil integer NOT NULL, akts integer NOT NULL, zorunlu boolean NOT NULL DEFAULT true,
  muafiyet_hakki boolean NOT NULL DEFAULT false, ortalamaya_etki boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS ybs_grades (
  id text PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ders_kodu text NOT NULL, donem text NOT NULL, vize numeric(5,2), final numeric(5,2), butunleme numeric(5,2),
  harf text, statu text CHECK (statu IN ('normal','M1','M2','BŞR','BŞZ')),
  kaynak text NOT NULL DEFAULT 'manuel' CHECK (kaynak IN ('manuel','obs')),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, ders_kodu, donem)
);

CREATE TABLE IF NOT EXISTS ybs_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ogrenci_no text, program text, sinav_merkezi text,
  obs_session_valid boolean NOT NULL DEFAULT false, obs_last_sync_at timestamptz
);

CREATE TABLE IF NOT EXISTS ybs_announcements (
  id text PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  baslik text NOT NULL, ozet text, url text NOT NULL, published_at timestamptz,
  source text NOT NULL, action_required boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz NOT NULL
);

ALTER TABLE ybs_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_announcements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY ybs_sources_owner ON ybs_sources FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_courses_owner ON ybs_courses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_grades_owner ON ybs_grades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_profile_owner ON ybs_profile FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_announcements_owner ON ybs_announcements FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_events_managed ON events (user_id, is_managed);
CREATE INDEX IF NOT EXISTS idx_tasks_managed ON tasks (user_id, is_managed);
CREATE INDEX IF NOT EXISTS idx_ybs_grades_user ON ybs_grades (user_id, donem);
CREATE INDEX IF NOT EXISTS idx_ybs_announcements_user ON ybs_announcements (user_id, published_at DESC);
