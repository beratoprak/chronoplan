-- Epoche v6 — YBS çalışma sistemi
-- Eklemeli ve idempotent. Mevcut veriye dokunmaz.
--
-- Sahiplik kuralı: ybs_units / ybs_modules / ybs_outcomes motorundur (OYS'den türer).
-- ybs_unit_progress KULLANICININDIR — motor okur, asla üzerine yazmaz.

-- Çalışma birimi: bir dersin bir konu bloğu. Planlamanın atomu.
CREATE TABLE IF NOT EXISTS ybs_units (
  id                 text PRIMARY KEY,                    -- ybs:unit:AAUF1101:k4
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ders_kodu          text NOT NULL,
  oys_course_id      integer,
  bolum_no           integer,
  konu_no            integer,                             -- materyal bloğunda NULL
  baslik             text NOT NULL,
  tip                text NOT NULL CHECK (tip IN ('konu','materyal')),
  dilim              text CHECK (dilim IN ('vize','final')),
  katman             text NOT NULL CHECK (katman IN ('cekirdek','kultur')),
  modul_sayisi       integer NOT NULL DEFAULT 0,
  tahmini_dakika     integer NOT NULL DEFAULT 0,
  soru_degeri        numeric(6,3) NOT NULL DEFAULT 0,
  soru_degeri_kaynak text NOT NULL DEFAULT 'tahmin' CHECK (soru_degeri_kaynak IN ('tahmin','olcum')),
  last_verified_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz                          -- kaynaktan düşen birim emekliye ayrılır
);

-- OYS materyali: birimin altındaki tekil modül.
CREATE TABLE IF NOT EXISTS ybs_modules (
  id               text PRIMARY KEY,                      -- ybs:mod:<oys cmid>
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unit_id          text NOT NULL,
  oys_cmid         integer,
  ad               text NOT NULL,
  tip              text NOT NULL,
  oys_url          text,
  tahmini_dakika   integer NOT NULL DEFAULT 0,
  yerel_dosya      text,                                  -- Faz C: indirilen materyalin yolu
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- Kazanım: ABİT101'de OYS'den gelir, diğer derslerde türetilir.
CREATE TABLE IF NOT EXISTS ybs_outcomes (
  id       text PRIMARY KEY,
  user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unit_id  text NOT NULL,
  sira     integer NOT NULL DEFAULT 0,
  metin    text NOT NULL,
  kaynak   text NOT NULL DEFAULT 'oys' CHECK (kaynak IN ('oys','turetilmis'))
);

-- İLERLEME — kullanıcınındır. Motor bu tabloya yazmaz.
CREATE TABLE IF NOT EXISTS ybs_unit_progress (
  unit_id       text PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  durum         text NOT NULL DEFAULT 'dokunulmadi'
                CHECK (durum IN ('dokunulmadi','calisildi','test_edildi','hakim')),
  son_temas_at  timestamptz,
  gercek_dakika integer NOT NULL DEFAULT 0,
  dogru_oran    numeric(4,3),
  not_id        text,                                     -- Faz F: not sistemine köprü
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ybs_units         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_modules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_outcomes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ybs_unit_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY ybs_units_owner    ON ybs_units         FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_modules_owner  ON ybs_modules       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_outcomes_owner ON ybs_outcomes      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY ybs_progress_owner ON ybs_unit_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ybs_units_ders     ON ybs_units (user_id, ders_kodu, dilim);
CREATE INDEX IF NOT EXISTS idx_ybs_units_canli    ON ybs_units (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_ybs_modules_unit   ON ybs_modules (user_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_ybs_outcomes_unit  ON ybs_outcomes (user_id, unit_id);
