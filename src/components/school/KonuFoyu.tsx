"use client";

// Konu föyü ve konuyu çalışmanın ortak mantığı.
//
// Gün sayfası (bugünün dersleri) ile ders sayfası (bir dersin bütün konuları)
// aynı föyü gösteriyor: öğreneceklerin → malzemen → nasıl çalışacaksın.
// İşaretleme, soru çözme, konu notu ve PDF okuyucu da ikisinde aynı; tek
// yerde dursun diye `useKonuCalisma` burada. Neyin hangi sırayla
// gösterileceği `lib/gun-sayfasi.ts`'teki `konuFoyu`'nda.

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, BookOpen, Check, ChevronRight, Info, NotebookPen, Play } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  AdimKolonuYok, buildSchoolDemoData, fetchSchoolData, okulOnbellegi, saveQuestionAttempt,
  setUnitNote, setUnitStep, type SchoolData, type StudyQuestion,
} from "@/lib/school-data";
import type { StudyUnit, UnitProgress } from "@/lib/study-plan";
import { buildUnitNote } from "@/lib/study-note";
import { ADIMLAR, ilerlemeKatsayisi, mevcutAdimHaritasi, type Adim } from "@/lib/ilerleme";
import { depoYolu } from "@/lib/pdf-kaynak";
import { ZorlukRozeti } from "./GeminiParcalari";
import {
  ADIM_ISARETI, foyMalzemesi, konuAdi, konuFoyu, soruDurumlari, soruSirasi,
  type FoyAdimi, type FoyMalzemesi, type MalzemeTuru,
} from "@/lib/gun-sayfasi";

const PdfReader = dynamic(() => import("@/components/editor/PdfReader").then((m) => m.PdfReader), { ssr: false });
const VideoOynatici = dynamic(() => import("./VideoOynatici").then((m) => m.VideoOynatici), { ssr: false });

/** İzlenen videolar (bu cihazda): bir konunun bütün videoları izlenince "İzle" işaretlenir. */
const IZLENEN = "epoche-izlenen-videolar";
function izlenenler(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(IZLENEN) ?? "[]")); } catch { return new Set(); }
}
function izlendiYaz(modulId: string): Set<string> {
  const set = izlenenler();
  set.add(modulId);
  try { localStorage.setItem(IZLENEN, JSON.stringify(Array.from(set))); } catch { /* saklanamazsa yalnız bu oturum */ }
  return set;
}

export interface Ortak {
  data: SchoolData;
  ilerleme: Map<string, UnitProgress>;
  adimHaritasi: Map<string, Adim[]>;
  kazanimlar: Map<string, { id: string; metin: string }[]>;
  unitById: Map<string, StudyUnit>;
  kazanimVar: boolean;
  /** Bu dersin PDF'i olan konularının numaraları. */
  pdfliKonular: number[];
  mesgul: string | null;
  salt: boolean;
  onAdim: (unitId: string, adim: Adim, deger: boolean) => void;
  onSoru: (soru: StudyQuestion, harf: string) => Promise<void>;
  onNot: (unitId: string) => void;
  onPdf: (yol: string, baslik: string) => void;
  /** Uygulama içi video (Faz F). */
  onVideo: (m: FoyMalzemesi, unitId: string) => void;
}

/**
 * Tam ekran çalışma sayfalarının ortak durumu: okul verisi, işaretleme,
 * soru çözme, konu notu, PDF okuyucu. Esc ile kapanır (PDF açıksa önce PDF);
 * açıkken arkadaki sayfa kaymaz.
 */
export function useKonuCalisma(kapat: () => void) {
  const { user, isDemoMode, addRichNote, requestRichNote, setView } = useAppStore();
  const salt = isDemoMode || !user?.id;
  // Okul sekmesiyle aynı önbellek: sayfa ilk karede dolu açılır, ağ arkadan tazeler.
  const [data, setData] = useState<SchoolData | null>(() => (salt ? null : okulOnbellegi(user?.id)));
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ yol: string; baslik: string } | null>(null);
  const [video, setVideo] = useState<{ m: FoyMalzemesi; unitId: string } | null>(null);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      setData(salt || !user?.id ? buildSchoolDemoData() : await fetchSchoolData(user.id));
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Veri alınamadı");
    }
  }, [salt, user?.id]);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (video) setVideo(null); else if (pdf) setPdf(null); else kapat();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [pdf, video, kapat]);

  useEffect(() => {
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = onceki; };
  }, []);

  const dersAdi = useCallback((kod: string) => data?.courses.find((c) => c.kod === kod)?.ad ?? kod, [data?.courses]);
  const unitById = useMemo(() => new Map((data?.units ?? []).map((u) => [u.id, u as StudyUnit])), [data?.units]);
  const adimHaritasi = useMemo(
    () => mevcutAdimHaritasi(data?.units ?? [], data?.modules ?? [], data?.questions ?? []),
    [data?.units, data?.modules, data?.questions],
  );
  const ilerleme = useMemo(
    () => new Map<string, UnitProgress>((data?.progress ?? []).map((p) => [p.unit_id, p])),
    [data?.progress],
  );
  const kazanimlar = useMemo(() => {
    const map = new Map<string, { id: string; metin: string }[]>();
    for (const k of [...(data?.outcomes ?? [])].sort((a, b) => a.sira - b.sira)) {
      map.set(k.unit_id, [...(map.get(k.unit_id) ?? []), { id: k.id, metin: k.metin }]);
    }
    return map;
  }, [data?.outcomes]);
  /** Bazı derslerde (Matematik, Bilgi Yönetimi, İngilizce) hiç kazanım metni yok. */
  const kazanimliDersler = useMemo(() => {
    const set = new Set<string>();
    for (const k of data?.outcomes ?? []) {
      const kod = unitById.get(k.unit_id)?.ders_kodu;
      if (kod) set.add(kod);
    }
    return set;
  }, [data?.outcomes, unitById]);
  /** Dersin PDF'i olan konu numaraları: PDF'siz konuda "PDF'ler şu konularda" demek için. */
  const pdfliKonular = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const u of data?.units ?? []) {
      if (u.tip !== "konu" || u.konu_no == null) continue;
      const pdfli = foyMalzemesi((data?.modules ?? []).filter((m) => m.unit_id === u.id)).some((m) => m.tur === "kitap");
      if (pdfli) map.set(u.ders_kodu, [...(map.get(u.ders_kodu) ?? []), u.konu_no]);
    }
    for (const l of Array.from(map.values())) l.sort((a, b) => a - b);
    return map;
  }, [data?.units, data?.modules]);

  const adimDegistir = useCallback(async (unitId: string, adim: Adim, deger: boolean) => {
    if (!user?.id || isDemoMode) return;
    setMesgul(unitId);
    setHata(null);
    try {
      await setUnitStep(user.id, unitId, adim, deger);
      await yukle();
    } catch (e) {
      setHata(e instanceof AdimKolonuYok ? e.message : `Kaydedilemedi: ${e instanceof Error ? e.message : e}`);
    } finally {
      setMesgul(null);
    }
  }, [user?.id, isDemoMode, yukle]);

  const soruCoz = useCallback(async (soru: StudyQuestion, harf: string) => {
    if (!user?.id || isDemoMode) return;
    try {
      await saveQuestionAttempt(user.id, soru.id, harf, harf === soru.dogru);
      // Çözülen soru konunun "Soru çöz" adımını da işaretler.
      if (soru.unit_id) await setUnitStep(user.id, soru.unit_id, "soru", true).catch((e) => console.error("Soru adımı yazılamadı:", e));
      await yukle();
    } catch (e) {
      setHata(`Cevap kaydedilemedi: ${e instanceof Error ? e.message : e}`);
    }
  }, [user?.id, isDemoMode, yukle]);

  /** Konu notunu açar; yoksa kazanım, materyal ve sorularla dolu bir şablonla kurar. */
  const notuAc = useCallback(async (unitId: string) => {
    if (!data) return;
    const mevcut = ilerleme.get(unitId)?.not_id;
    if (mevcut) {
      requestRichNote(mevcut);
      setView("notes");
      kapat();
      return;
    }
    const unit = unitById.get(unitId);
    if (!unit) return;
    setMesgul(unitId);
    try {
      const tohum = buildUnitNote(
        unit,
        kazanimlar.get(unitId) ?? [],
        data.modules.filter((m) => m.unit_id === unitId),
        data.questions.filter((q) => q.unit_id === unitId),
      );
      const not = addRichNote({ ...tohum, pinned: false });
      if (user?.id && !isDemoMode) await setUnitNote(user.id, unitId, not.id);
      requestRichNote(not.id);
      setView("notes");
      kapat();
    } finally {
      setMesgul(null);
    }
  }, [data, ilerleme, unitById, kazanimlar, addRichNote, requestRichNote, setView, kapat, user?.id, isDemoMode]);

  /** Bir dersin föy bileşenlerine verilecek ortak değerler. */
  const ortak = useCallback((kod: string): Ortak | null => data && {
    data, ilerleme, adimHaritasi, kazanimlar, unitById, mesgul, salt,
    kazanimVar: kazanimliDersler.has(kod),
    pdfliKonular: pdfliKonular.get(kod) ?? [],
    onAdim: adimDegistir, onSoru: soruCoz, onNot: notuAc,
    onPdf: (yol: string, baslik: string) => setPdf({ yol, baslik }),
    onVideo: (m: FoyMalzemesi, unitId: string) => setVideo({ m, unitId }),
  }, [data, ilerleme, adimHaritasi, kazanimlar, unitById, mesgul, salt, kazanimliDersler, pdfliKonular, adimDegistir, soruCoz, notuAc]);

  /**
   * Video %90 izlenince: bu cihazda izlendi say; konunun uygulamada oynayan
   * bütün videoları izlendiyse "İzle" adımını işaretle (Plan v3: "videoyu
   * bitirince İzle otomatik işaretlenir"). Zaten işaretliyse dokunma.
   */
  const videoIzlendi = useCallback((modulId: string, unitId: string) => {
    const izlenen = izlendiYaz(modulId);
    const videolar = foyMalzemesi((data?.modules ?? []).filter((x) => x.unit_id === unitId)).filter((x) => x.oynatilir);
    const hepsi = videolar.length > 0 && videolar.every((x) => izlenen.has(x.modulId));
    if (hepsi && !ilerleme.get(unitId)?.adimlar?.izle) void adimDegistir(unitId, "izle", true);
  }, [data?.modules, ilerleme, adimDegistir]);

  return {
    data, setData, hata, setHata, yukle, salt, dersAdi, unitById, ilerleme, adimHaritasi, ortak,
    pdfKatmani: video ? (
      <VideoOynatici
        modulId={video.m.modulId}
        baslik={video.m.ad}
        oysUrl={video.m.oys_url}
        onKapat={() => setVideo(null)}
        onIzlendi={() => videoIzlendi(video.m.modulId, video.unitId)}
      />
    ) : pdf && (
      <div className="fixed inset-0 z-50 flex justify-center" style={{ background: "var(--surface-base)" }}>
        <div className="w-full max-w-4xl flex" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <PdfReader yol={pdf.yol} baslik={pdf.baslik} onKapat={() => setPdf(null)} />
        </div>
      </div>
    ),
  };
}

export function KonuBasligi({ unitId, baslik, ...o }: Ortak & { unitId: string; baslik: string }) {
  const unit = o.unitById.get(unitId);
  const yuzde = Math.round(ilerlemeKatsayisi(o.ilerleme.get(unitId), o.adimHaritasi.get(unitId) ?? ADIMLAR) * 100);
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="flex-1 min-w-0 text-[15px] lg:text-[19px] font-medium leading-snug">
        {unit?.konu_no ? `Konu ${unit.konu_no} — ` : ""}{konuAdi(baslik)}
        {unit?.zorluk ? <span className="ml-2"><ZorlukRozeti zorluk={unit.zorluk} /></span> : null}
      </h3>
      <span className="text-[11px] lg:text-[13px] font-semibold tabular-nums shrink-0" style={{ color: yuzde === 100 ? "var(--priority-low-text)" : "var(--text-tertiary)" }}>
        %{yuzde}
      </span>
    </div>
  );
}

/** Föyün gövdesi: öğreneceklerin → malzemen → nasıl çalışacaksın → konu notu. */
export function Foy({ unitId, butce, bitiyor, ...o }: Ortak & { unitId: string; butce: number; bitiyor: boolean }) {
  const moduller = useMemo(() => o.data.modules.filter((m) => m.unit_id === unitId), [o.data.modules, unitId]);
  const sorular = useMemo(() => o.data.questions.filter((q) => q.unit_id === unitId), [o.data.questions, unitId]);
  const kazanim = o.kazanimlar.get(unitId) ?? [];
  const kayit = o.ilerleme.get(unitId);
  const foy = useMemo(() => konuFoyu({
    moduller, soruSayisi: sorular.length, kazanimSayisi: kazanim.length,
    mevcut: o.adimHaritasi.get(unitId) ?? ADIMLAR, kayit, butce, bitiyor,
  }), [moduller, sorular.length, kazanim.length, o.adimHaritasi, unitId, kayit, butce, bitiyor]);
  const dersKodu = o.unitById.get(unitId)?.ders_kodu ?? "";
  const ac = (m: FoyMalzemesi) => {
    if (m.oynatilir) o.onVideo(m, unitId);
    else if (m.cmid && dersKodu) o.onPdf(depoYolu(dersKodu, m.cmid), m.ad);
    else if (m.oys_url) window.open(m.oys_url, "_blank", "noopener");
  };

  const numarali = foy.adimlar.map((a, i) => ({ a, no: i + 1 }));
  const yapilan = numarali.filter(({ a }) => a.yapildi);
  const bugun = numarali.filter(({ a }) => !a.yapildi && a.bugun);
  const sonra = numarali.filter(({ a }) => !a.yapildi && !a.bugun);
  // Konuyu bitiren gün ya da hiç bölünmemiş konu: "bugün/sonra" ayrımı gereksiz.
  const ayir = sonra.length > 0;
  const adimProps = {
    unitId, sorular, ac, mesgul: o.salt || o.mesgul === unitId, onAdim: o.onAdim,
    soruProps: { denemeler: o.data.attempts, salt: o.salt, onSoru: o.onSoru },
  };

  return (
    <>
      <AltBaslik>Bu konuda öğreneceklerin</AltBaslik>
      {kazanim.length ? (
        <ul className="pl-4 lg:pl-6 space-y-1 lg:space-y-2.5 list-disc text-[13px] lg:text-[15px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          {kazanim.map((k) => <li key={k.id}>{k.metin}</li>)}
        </ul>
      ) : (
        <Bos>
          {o.kazanimVar ? "Bu konunun kazanım metni yok." : "Bu dersin OYS'sinde kazanım listesi yok."}
          {foy.pdfVar && " Kitap bölümünün ana başlıkları neyi bilmen gerektiğini gösterir."}
        </Bos>
      )}

      <AltBaslik>Malzemen</AltBaslik>
      <MalzemeTablosu foy={foy} soruSayisi={sorular.length} pdfliKonular={o.pdfliKonular} ac={ac} />

      <AltBaslik>Nasıl çalışacaksın</AltBaslik>
      {foy.aciklama && (
        <p className="text-[12px] lg:text-[14px] leading-relaxed rounded-xl px-3 py-2 mb-1 flex gap-2" style={{ background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)" }}>
          <Info size={14} className="shrink-0 mt-0.5" />{foy.aciklama}
        </p>
      )}
      {ayir && bugun.length > 0 && <GrupBasligi>Bugün{foy.bugunDakika ? ` · ~${foy.bugunDakika} dk` : ""}</GrupBasligi>}
      {bugun.map(({ a, no }) => <AdimSatiri key={no} adim={a} no={no} acik {...adimProps} />)}
      {ayir && <GrupBasligi>Sonraki çalışmada</GrupBasligi>}
      {sonra.map(({ a, no }) => <AdimSatiri key={no} adim={a} no={no} acik={false} {...adimProps} />)}
      {yapilan.length > 0 && <GrupBasligi>Yapıldı</GrupBasligi>}
      {yapilan.map(({ a, no }) => <AdimSatiri key={no} adim={a} no={no} acik={false} {...adimProps} />)}

      <button onClick={() => o.onNot(unitId)} disabled={o.mesgul === unitId} className="cp-btn cp-btn-ghost min-h-11 text-[12px] lg:text-[14px] mt-3 disabled:opacity-40">
        <NotebookPen size={14} />Konu notum
      </button>
    </>
  );
}

const SATIR_ADI: Record<MalzemeTuru, string> = {
  kitap: "Ders kitabı (PDF)", dosya: "Okuma dosyası", ses: "Sesli özet", video: "Video",
  hedef: "Öğrenme hedefleri", test: "Kendini dene", diger: "Diğer",
};
const SATIR_SIRASI: MalzemeTuru[] = ["kitap", "dosya", "ses", "video", "hedef", "test", "diger"];

function MalzemeDugmesi({ m, ac }: { m: FoyMalzemesi; ac: (m: FoyMalzemesi) => void }) {
  if (m.oynatilir) {
    return (
      <button onClick={() => ac(m)} className="cp-btn cp-btn-primary min-h-11 px-3 lg:px-5 text-[12px] lg:text-[14px] shrink-0">
        <Play size={14} />İzle
      </button>
    );
  }
  if (m.cmid) {
    return (
      <button onClick={() => ac(m)} className="cp-btn cp-btn-primary min-h-11 px-3 lg:px-5 text-[12px] lg:text-[14px] shrink-0">
        <BookOpen size={14} />Oku
      </button>
    );
  }
  if (!m.oys_url) return null;
  const fiil = m.tur === "video" ? "İzle" : m.tur === "ses" ? "Dinle" : m.tur === "test" ? "Çöz" : "Aç";
  return (
    <a href={m.oys_url} target="_blank" rel="noreferrer" className="cp-btn cp-btn-ghost min-h-11 px-3 lg:px-5 text-[12px] lg:text-[14px] shrink-0" title="OYS'de açılır">
      {fiil}<ArrowUpRight size={12} />
    </a>
  );
}

/** Konunun bütün malzemesi tür tür; olmayan PDF ve soru da satır olarak yazılır. */
function MalzemeTablosu({ foy, soruSayisi, pdfliKonular, ac }: {
  foy: ReturnType<typeof konuFoyu>;
  soruSayisi: number;
  pdfliKonular: number[];
  ac: (m: FoyMalzemesi) => void;
}) {
  const satirlar: { ad: string; icerik: React.ReactNode; key: string }[] = [];
  for (const tur of SATIR_SIRASI) {
    const liste = foy.malzeme.filter((m) => m.tur === tur);
    if (tur === "kitap" && !liste.length) {
      satirlar.push({
        key: "kitap-yok", ad: SATIR_ADI.kitap,
        icerik: (
          <span className="text-[12px] lg:text-[14px] leading-snug" style={{ color: "var(--priority-medium-text)" }}>
            Yok — bu konu için OYS'de okuma metni yayımlanmamış.
            <span className="block" style={{ color: "var(--text-tertiary)" }}>
              {pdfliKonular.length
                ? `Bu dersin PDF'i olan konuları: ${pdfliKonular.join(", ")}.`
                : "Bu dersin hiçbir konusunda uygulamada okunabilen PDF yok."}
            </span>
          </span>
        ),
      });
      continue;
    }
    liste.forEach((m, i) => satirlar.push({
      key: `${tur}-${i}`, ad: i === 0 ? SATIR_ADI[tur] : "",
      icerik: (
        <span className="w-full flex items-center gap-2 lg:gap-8 min-w-0">
          <span className="flex-1 min-w-0 text-[13px] lg:text-[15px] leading-snug">
            {m.ad}
            <span className="text-[11px] lg:text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {m.dakika > 0 && ` · ${m.dakika} dk`}
              {m.cmid ? " · uygulamada açılır" : " · OYS'de"}
              {m.tur === "ses" && " · isteğe bağlı"}
            </span>
          </span>
          <MalzemeDugmesi m={m} ac={ac} />
        </span>
      ),
    }));
  }
  satirlar.push({
    key: "soru", ad: "Çıkmış soru",
    icerik: <span className="text-[13px] lg:text-[15px]" style={{ color: soruSayisi ? undefined : "var(--text-tertiary)" }}>
      {soruSayisi ? `${soruSayisi} soru · bu sayfada çözülür` : "Bu konunun çıkmış sorusu yok."}
    </span>,
  });
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[130px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)] gap-x-3 lg:gap-x-6">
      {satirlar.map((s) => (
        <div key={s.key} className="contents">
          <dt className={`text-[11px] lg:text-[13px] sm:text-[12px] ${s.ad ? "pt-2 sm:pt-0 sm:min-h-11 sm:flex sm:items-center" : "hidden sm:block"}`} style={{ color: "var(--text-tertiary)" }}>{s.ad}</dt>
          <dd className="py-1 sm:py-1.5 lg:py-3 min-h-11 flex items-center">{s.icerik}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Numaralı tek adım: yönerge, kendi malzemesi, işaret kutusu; soru adımında sorular. */
function AdimSatiri({ adim, no, acik, unitId, sorular, ac, mesgul, onAdim, soruProps }: {
  adim: FoyAdimi;
  no: number;
  /** Bugünün adımı: soru adımıysa sorular hemen açık. */
  acik: boolean;
  unitId: string;
  sorular: StudyQuestion[];
  ac: (m: FoyMalzemesi) => void;
  mesgul: boolean;
  onAdim: (unitId: string, adim: Adim, deger: boolean) => void;
  soruProps: { denemeler: SchoolData["attempts"]; salt: boolean; onSoru: (soru: StudyQuestion, harf: string) => Promise<void> };
}) {
  const [sorularAcik, setSorularAcik] = useState(acik);
  const soluk = adim.yapildi || !acik;
  return (
    <div className="py-2.5 lg:py-6" style={{ borderTop: "0.5px solid var(--border-default)" }}>
      <div className="flex gap-2.5 lg:gap-5 items-start">
        <span
          className="w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-[12px] lg:text-[14px] font-semibold shrink-0 mt-0.5"
          style={adim.yapildi
            ? { background: "var(--priority-low-bg)", color: "var(--priority-low-text)" }
            : acik ? { background: "var(--tag-school-bg)", color: "var(--tag-school-text)" } : { background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}
        >
          {adim.yapildi ? <Check size={13} strokeWidth={3} /> : no}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] lg:text-[16px] leading-snug lg:leading-relaxed" style={{ color: soluk ? "var(--text-secondary)" : "var(--text-primary)" }}>
            {adim.metin}
          </p>
          <p className="text-[11px] lg:text-[13px] mt-0.5 lg:mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            {adim.dakika > 0 && `~${adim.dakika} dk`}
            {!adim.adim && `${adim.dakika > 0 ? " · " : ""}isteğe bağlı`}
          </p>
        </div>
        {adim.adim && (
          <IsaretKutusu
            isaretli={Boolean(adim.yapildi)}
            etiket={ADIM_ISARETI[adim.adim]}
            mesgul={mesgul}
            onDegis={(d) => onAdim(unitId, adim.adim as Adim, d)}
          />
        )}
      </div>
      {adim.malzeme.length > 0 && !adim.yapildi && (
        <ul className="mt-1.5 ml-8 lg:mt-4 lg:ml-[52px] space-y-1 lg:space-y-3">
          {adim.malzeme.map((m, i) => (
            <li key={i} className="flex items-center gap-2 lg:gap-8 text-[12px] lg:text-[14px]" style={{ color: "var(--text-secondary)" }}>
              <span className="flex-1 min-w-0 truncate">{m.ad}{m.dakika > 0 && <span style={{ color: "var(--text-tertiary)" }}> · {m.dakika} dk</span>}</span>
              <MalzemeDugmesi m={m} ac={ac} />
            </li>
          ))}
        </ul>
      )}
      {adim.soru && sorular.length > 0 && (
        <div className="mt-2 ml-8 lg:mt-4 lg:ml-[52px]">
          {sorularAcik
            ? <SoruAkisi sorular={sorular} sirala={soruSirasi} {...soruProps} />
            : (
              <button onClick={() => setSorularAcik(true)} className="cp-btn cp-btn-ghost min-h-11 text-[12px] lg:text-[14px]">
                Soruları aç<ChevronRight size={14} />
              </button>
            )}
        </div>
      )}
    </div>
  );
}

function IsaretKutusu({ isaretli, etiket, mesgul, onDegis }: {
  isaretli: boolean; etiket: string; mesgul: boolean; onDegis: (d: boolean) => void;
}) {
  return (
    <button
      onClick={() => onDegis(!isaretli)}
      disabled={mesgul}
      aria-pressed={isaretli}
      className="cp-btn min-h-11 px-2.5 lg:px-4 text-[11px] lg:text-[13px] gap-1.5 shrink-0 disabled:opacity-50"
      style={isaretli
        ? { background: "var(--priority-low-bg)", color: "var(--priority-low-text)", border: "0.5px solid transparent" }
        : { background: "transparent", color: "var(--text-secondary)", border: "0.5px solid var(--border-default)" }}
    >
      <span
        aria-hidden
        className="w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0"
        style={isaretli ? { background: "var(--priority-low-text)" } : { border: "1.5px solid var(--border-strong)" }}
      >
        {isaretli && <Check size={11} color="var(--surface-raised)" strokeWidth={3} />}
      </span>
      {etiket}
    </button>
  );
}

/**
 * Sorular tek tek. Sıra açılışta bir kez kurulur: cevapladığın soru listenin
 * sonuna kaçmasın, "Sonraki soru" seni gerçekten bir sonrakine götürsün.
 */
export function SoruAkisi({ sorular, denemeler, salt, onSoru, sirala }: {
  sorular: StudyQuestion[];
  denemeler: SchoolData["attempts"];
  salt: boolean;
  onSoru: (soru: StudyQuestion, harf: string) => Promise<void>;
  sirala: (s: StudyQuestion[], d: SchoolData["attempts"]) => StudyQuestion[];
}) {
  const [sira] = useState(() => sirala(sorular, denemeler));
  const [i, setI] = useState(0);
  const [verilen, setVerilen] = useState<Record<string, string>>({});
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const durum = useMemo(() => soruDurumlari(denemeler), [denemeler]);
  const cozulmemis = sira.filter((s) => !durum.has(s.id) && !verilen[s.id]).length;

  if (!sira.length) return <Bos>Çözülecek soru kalmadı ✓</Bos>;
  if (i >= sira.length) {
    return (
      <div className="rounded-xl p-3 text-[12px] lg:text-[14px]" style={{ background: "var(--surface-raised)" }}>
        Sorular bitti. <button onClick={() => setI(0)} className="underline underline-offset-2" style={{ color: "var(--tag-school-text)" }}>Baştan</button>
      </div>
    );
  }
  const soru = sira[i];
  const cevap = verilen[soru.id];
  const once = durum.get(soru.id);

  const sec = async (harf: string) => {
    if (cevap) return;
    setVerilen((v) => ({ ...v, [soru.id]: harf }));
    if (salt) return;
    setKaydediliyor(true);
    try { await onSoru(soru, harf); } finally { setKaydediliyor(false); }
  };

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-raised)" }}>
      <p className="text-[10px] lg:text-[12px] mb-1.5" style={{ color: "var(--text-tertiary)" }}>
        Soru {i + 1}/{sira.length} · {cozulmemis} çözülmedi
        {once === "yanlis" && !cevap && " · daha önce yanlış yaptın"}
        {once === "dogru" && !cevap && " · daha önce doğru bildin"}
      </p>
      <p className="text-[13px] lg:text-[15px] leading-snug font-medium whitespace-pre-wrap">{soru.govde}</p>
      <div className="mt-2 space-y-1.5">
        {soru.secenekler.map((sik) => {
          const secili = cevap === sik.harf;
          const dogruSik = cevap != null && sik.harf === soru.dogru;
          return (
            <button
              key={sik.harf}
              onClick={() => void sec(sik.harf)}
              disabled={cevap != null}
              className="w-full min-h-11 text-left rounded-lg px-3 py-2 text-[12px] lg:text-[14px] leading-snug disabled:cursor-default"
              style={{
                background: dogruSik ? "var(--priority-low-bg)" : secili ? "var(--priority-high-bg)" : "var(--surface-sunken)",
                color: dogruSik ? "var(--priority-low-text)" : secili ? "var(--priority-high-text)" : "var(--text-primary)",
              }}
            >
              <strong className="mr-1.5">{sik.harf})</strong>{sik.metin}
            </button>
          );
        })}
      </div>
      {cevap != null && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <p className="text-[12px] lg:text-[14px] flex-1" style={{ color: cevap === soru.dogru ? "var(--priority-low-text)" : "var(--priority-high-text)" }}>
            {soru.dogru == null ? "Cevap anahtarı yok." : cevap === soru.dogru ? "Doğru." : `Yanlış — doğrusu ${soru.dogru}.`}
            {kaydediliyor && " Kaydediliyor…"}
          </p>
          <button onClick={() => setI(i + 1)} className="cp-btn cp-btn-primary min-h-11 text-[12px] lg:text-[14px]">
            Sonraki soru<ChevronRight size={14} />
          </button>
        </div>
      )}
      {cevap == null && i + 1 < sira.length && (
        <button onClick={() => setI(i + 1)} className="mt-2 text-[11px] lg:text-[13px] min-h-9" style={{ color: "var(--text-tertiary)" }}>Bu soruyu geç</button>
      )}
    </div>
  );
}

export function AltBaslik({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[13px] lg:text-[18px] font-semibold mt-5 mb-1.5 lg:mt-10 lg:mb-4">{children}</h4>;
}

export function GrupBasligi({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] lg:text-[13px] font-medium mt-2 mb-1 lg:mt-6 lg:mb-2" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}

export function Bos({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] lg:text-[14px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}
