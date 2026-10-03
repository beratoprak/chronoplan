-- Epoche v17 — Okul notları: takvimin genel notlarından bağımsız, klasörlü not alanı.
--
-- Neden: okul notları (konu notu, hızlı okul notu) genel not sayfasına karışıyor,
-- PDF'in yanında alınan notlar (v16, epoche_pdf_not) ise hiçbir yerde
-- görünmüyordu. Okulla ilgili her not artık kendi tablosunda, kullanıcının
-- açabildiği, iç içe, sürükle-bırakla düzenlenen klasörlerde duruyor.
-- Eski kayıtlar SİLİNMEZ; buraya kopyalanır (aynı kimlikle, konu notu bağı kopmasın).
-- Tekrar çalıştırmak zararsız.

CREATE TABLE IF NOT EXISTS public.okul_klasor (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  ust_id      text REFERENCES public.okul_klasor (id) ON DELETE CASCADE,
  ad          text NOT NULL,
  sira        double precision NOT NULL DEFAULT 0,
  -- Uygulamanın kendi kurduğu klasörler (PDF notlarım → Ders → Konu) bunlarla
  -- tanınır; kullanıcının açtığı klasörde ikisi de boş.
  ders_kodu   text,
  unit_id     text,
  kok         text CHECK (kok IN ('pdf', 'ders')),
  olusturma   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.okul_not (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  klasor_id   text REFERENCES public.okul_klasor (id) ON DELETE SET NULL,
  baslik      text NOT NULL DEFAULT '',
  icerik      text NOT NULL DEFAULT '',
  tur         text NOT NULL DEFAULT 'serbest' CHECK (tur IN ('serbest', 'konu', 'pdf')),
  kaynak      text,               -- PDF notunda belgenin depo yolu (<ders>/<cmid>.pdf)
  ders_kodu   text,
  unit_id     text,
  sira        double precision NOT NULL DEFAULT 0,
  olusturma   timestamptz NOT NULL DEFAULT now(),
  guncelleme  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_okul_klasor_user ON public.okul_klasor (user_id, ust_id);
CREATE INDEX IF NOT EXISTS idx_okul_not_user ON public.okul_not (user_id, klasor_id);
-- Bir PDF'in tek notu olur: PDF'in yanında hangi not açılacağı buna dayanıyor.
CREATE UNIQUE INDEX IF NOT EXISTS uq_okul_not_pdf ON public.okul_not (user_id, kaynak) WHERE tur = 'pdf';

ALTER TABLE public.okul_klasor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okul_not ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY okul_klasor_owner ON public.okul_klasor
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY okul_not_owner ON public.okul_not
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) v16'daki PDF notları. Belge yolu "<ders>/<cmid>.pdf", malzeme kimliği
--    "ybs:mod:<cmid>": başlık malzemenin adı, ders ve konu malzemeden.
--    Klasörü boş kalır; uygulama ilk açılışta PDF notlarım → Ders → Konu'ya yerleştirir.
INSERT INTO public.okul_not (id, user_id, baslik, icerik, tur, kaynak, ders_kodu, unit_id, olusturma, guncelleme)
SELECT 'pdfnot-' || md5(n.user_id::text || ':' || n.belge), n.user_id,
       coalesce(m.ad, 'PDF notu'), n.metin, 'pdf', n.belge, u.ders_kodu, m.unit_id,
       n.guncelleme, n.guncelleme
FROM public.epoche_pdf_not n
LEFT JOIN public.ybs_modules m
  ON m.user_id = n.user_id AND m.id = 'ybs:mod:' || split_part(split_part(n.belge, '/', 2), '.', 1)
LEFT JOIN public.ybs_units u ON u.user_id = n.user_id AND u.id = m.unit_id
WHERE coalesce(n.metin, '') <> ''
ON CONFLICT DO NOTHING;

-- 2) Genel notlardaki okul notları (konu notu, ders notu, "okul" etiketli hızlı not).
--    Kimlik aynı kalır: ybs_unit_progress.not_id konu notunu bulmaya devam eder.
--    rich_notes'taki zaman damgaları metin; çevrilemeyen olursa şimdiki zaman.
INSERT INTO public.okul_not (id, user_id, baslik, icerik, tur, ders_kodu, unit_id, olusturma, guncelleme)
SELECT r.id, r.user_id, r.title, r.content,
       CASE WHEN r.kind = 'konu' THEN 'konu' ELSE 'serbest' END,
       r.ders_kodu, r.unit_id,
       CASE WHEN r.created_at ~ '^\d{4}-\d{2}-\d{2}' THEN r.created_at::timestamptz ELSE now() END,
       CASE WHEN r.updated_at ~ '^\d{4}-\d{2}-\d{2}' THEN r.updated_at::timestamptz ELSE now() END
FROM public.rich_notes r
WHERE r.deleted_at IS NULL
  AND (r.kind IN ('konu', 'ders') OR r.unit_id IS NOT NULL OR r.ders_kodu IS NOT NULL
       OR r.tags ? 'okul' OR r.tags ? 'Okul')
ON CONFLICT DO NOTHING;
