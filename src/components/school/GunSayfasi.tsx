"use client";

// Gün sayfası (Plan v3, Faz C).
//
// Takvimdeki çalışma etkinliğine tıklayınca açılır: o günün iki dersi tek
// ekranda — konu, kazanımlar, kitap, podcast, video, çıkmış soru, checklist,
// konu notu. Amaç uygulamadan çıkmadan bir konuyu baştan sona çalışabilmek.
// Veri `ybs_haftalik_plan`'dan; ilerleme Okul sekmesiyle aynı tablolara yazılır.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, FileText, Headphones, Loader2,
  NotebookPen, Pencil, RefreshCw, Video,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  AdimKolonuYok, buildSchoolDemoData, fetchSchoolData, okulOnbellegi, saveQuestionAttempt,
  setUnitNote, setUnitStep, type SchoolData, type StudyQuestion,
} from "@/lib/school-data";
import type { StudyUnit, UnitProgress } from "@/lib/study-plan";
import { buildUnitNote } from "@/lib/study-note";
import { isaretliKazanimlar } from "@/lib/note-blocks";
import { gununPlani, planEtkinlikId, planiHesapla, type PlanSatiri } from "@/lib/haftalik-plan-kayit";
import type { PlanParcasi } from "@/lib/haftalik-plan";
import { ADIMLAR, mevcutAdimHaritasi, type Adim } from "@/lib/ilerleme";
import { depoYolu } from "@/lib/pdf-kaynak";
import { eksikKonular, gunMateryali, soruDurumlari, soruSirasi, tekrarSorulari } from "@/lib/gun-sayfasi";
import { KonuChecklist } from "./KonuChecklist";

const PdfReader = dynamic(() => import("@/components/editor/PdfReader").then((m) => m.PdfReader), { ssr: false });

/** Ekranı açan kabuk: tarih yoksa hiçbir şey çizmez, veri yüklemez. */
export function GunSayfasi() {
  const tarih = useAppStore((s) => s.gunSayfasiTarihi);
  if (!tarih) return null;
  return <GunSayfasiIcerik key={tarih} tarih={tarih} />;
}

function GunSayfasiIcerik({ tarih }: { tarih: string }) {
  const {
    user, isDemoMode, events, richNotes, openGunSayfasi, openEventModal,
    addRichNote, requestRichNote, setView,
  } = useAppStore();
  const kapat = useCallback(() => openGunSayfasi(null), [openGunSayfasi]);

  // Okul sekmesiyle aynı önbellek: sayfa ilk karede dolu açılır, ağ arkadan tazeler.
  const [data, setData] = useState<SchoolData | null>(() => okulOnbellegi(user?.id));
  const [satirlar, setSatirlar] = useState<PlanSatiri[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ yol: string; baslik: string } | null>(null);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      if (isDemoMode || !user?.id) {
        // Demoda kayıtlı plan yok; plan o an hesaplanıp günü ondan alınıyor.
        const demo = buildSchoolDemoData();
        setData(demo);
        const gun = planiHesapla(demo, events, parseISO(tarih))?.plan.gunler.find((g) => g.tarih === tarih);
        setSatirlar(gun?.dersler.map((d, i) => ({
          id: `demo:${tarih}:${i + 1}`, user_id: "demo", hafta: "", tarih, gun_turu: gun.tur, sira: i + 1,
          ders_kodu: d.ders_kodu, tur: d.tur, dakika: d.dakika, parcalar: d.parcalar, olusturma: "",
        })) ?? []);
        return;
      }
      const [veri, plan] = await Promise.all([fetchSchoolData(user.id), gununPlani(user.id, tarih)]);
      setData(veri);
      setSatirlar(plan);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Veri alınamadı");
    }
  }, [isDemoMode, user?.id, tarih, events]);

  // `events` her senkronda yenilendiği için yalnız ilk açılışta yükleniyor;
  // sonraki tazelemeler işaretleme ve soru çözümünden sonra elle.
  const ilkYukleme = useRef(false);
  useEffect(() => {
    if (ilkYukleme.current) return;
    ilkYukleme.current = true;
    void yukle();
  }, [yukle]);

  // Esc ile kapanır; PDF açıksa önce PDF kapanır.
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pdf) setPdf(null); else kapat();
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [pdf, kapat]);

  // Arka plandaki takvim kaymasın.
  useEffect(() => {
    const onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = onceki; };
  }, []);

  const etkinlik = useMemo(() => events.find((e) => e.id === planEtkinlikId(tarih)), [events, tarih]);
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
  const isaretli = useMemo(() => isaretliKazanimlar(richNotes), [richNotes]);

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
      // Çözülen soru konunun "Soru çöz" adımını da işaretler (Okul sekmesindeki gibi).
      if (soru.unit_id) await setUnitStep(user.id, soru.unit_id, "soru", true).catch((e) => console.error("Soru adımı yazılamadı:", e));
      await yukle();
    } catch (e) {
      setHata(`Cevap kaydedilemedi: ${e instanceof Error ? e.message : e}`);
    }
  }, [user?.id, isDemoMode, yukle]);

  /** Konu notunu açar; yoksa Okul sekmesindeki gibi dolu bir şablonla kurar. */
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

  const duzenle = useCallback(() => {
    if (!etkinlik) return;
    kapat();
    openEventModal(etkinlik, undefined, { duzenle: true });
  }, [etkinlik, kapat, openEventModal]);

  const gunTuru = satirlar?.[0]?.gun_turu;
  const dersSatirlari = (satirlar ?? []).filter((s) => s.ders_kodu);
  const toplamDakika = dersSatirlari.reduce((t, s) => t + s.dakika, 0);
  const salt = isDemoMode || !user?.id;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "var(--surface-base)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Gün sayfası"
    >
      <header
        className="flex items-center gap-2 px-3 sm:px-5 pb-2 shrink-0"
        style={{ borderBottom: "0.5px solid var(--border-default)", paddingTop: "calc(8px + env(safe-area-inset-top))" }}
      >
        <button onClick={kapat} className="cp-btn cp-btn-ghost min-h-11 px-2.5 gap-1.5 text-[13px]" aria-label="Takvime dön">
          <ArrowLeft size={18} /><span className="hidden sm:inline">Takvim</span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold leading-tight truncate">
            {format(parseISO(tarih), "d MMMM EEEE", { locale: tr })}
          </h1>
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {gunTuru === "tekrar" ? "Tekrar günü" : gunTuru === "sinav" ? "Sınav günü" : toplamDakika ? `Çalışma · ~${toplamDakika} dk` : "Çalışma planı"}
          </p>
        </div>
        {etkinlik && !isDemoMode && (
          <button onClick={duzenle} className="cp-btn cp-btn-ghost min-h-11 px-2.5 text-[11px] gap-1" title="Takvim etkinliğini düzenle">
            <Pencil size={13} /><span className="hidden sm:inline">Etkinliği düzenle</span>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 space-y-4" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}>
          {hata && (
            <div className="rounded-xl px-3 py-2 text-[12px] flex items-center gap-2" role="alert" style={{ background: "var(--priority-high-bg)", color: "var(--priority-high-text)" }}>
              <span className="flex-1">{hata}</span>
              <button onClick={() => void yukle()} className="cp-btn cp-btn-ghost min-h-9 text-[11px]"><RefreshCw size={12} />Tekrar dene</button>
            </div>
          )}
          {salt && (
            <p className="text-[11px] rounded-xl px-3 py-2" style={{ background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}>
              Demo: işaretlemeler ve cevaplar kaydedilmez.
            </p>
          )}

          {(!data || satirlar === null) && !hata && (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              <Loader2 size={16} className="animate-spin" />Günün planı yükleniyor…
            </div>
          )}

          {data && satirlar !== null && !dersSatirlari.length && (
            <div className="cp-card p-4 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {gunTuru === "sinav"
                ? "Bugün sınav günü. Başarılar!"
                : gunTuru === "bos"
                  ? "Bu gün için çalışma planlanmadı."
                  : "Bu gün için kayıtlı plan bulunamadı. Okul → Bu hafta → \"Yeniden planla\" ile plan yeniden kurulabilir."}
              {etkinlik?.description && (
                <pre className="mt-3 whitespace-pre-wrap text-[12px] font-sans" style={{ color: "var(--text-tertiary)" }}>{etkinlik.description}</pre>
              )}
            </div>
          )}

          {data && dersSatirlari.map((satir) => {
            const kod = satir.ders_kodu as string;
            const ortak = {
              data, ilerleme, adimHaritasi, kazanimlar, isaretli, mesgul, salt,
              kazanimVar: kazanimliDersler.has(kod),
              onAdim: adimDegistir, onSoru: soruCoz, onNot: notuAc,
              onPdf: (yol: string, baslik: string) => setPdf({ yol, baslik }),
            };
            return (
              <section key={satir.id} className="cp-card p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="text-[16px] font-semibold leading-snug">{dersAdi(kod)}</h2>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
                    {satir.tur === "tekrar" ? "tekrar" : `~${satir.dakika} dk`}
                  </span>
                </div>
                {satir.tur === "tekrar"
                  ? <TekrarBolumu parcalar={satir.parcalar} dersKodu={kod} {...ortak} />
                  : satir.parcalar.map((p) => <KonuBolumu key={p.unit_id} parca={p} {...ortak} />)}
              </section>
            );
          })}
        </div>
      </div>

      {pdf && (
        <div className="fixed inset-0 z-50 flex justify-center" style={{ background: "var(--surface-base)" }}>
          <div className="w-full max-w-4xl flex" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <PdfReader yol={pdf.yol} baslik={pdf.baslik} onKapat={() => setPdf(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bölümler ─────────────────────────────────────────────────────

interface Ortak {
  data: SchoolData;
  ilerleme: Map<string, UnitProgress>;
  adimHaritasi: Map<string, Adim[]>;
  kazanimlar: Map<string, { id: string; metin: string }[]>;
  isaretli: Set<string>;
  kazanimVar: boolean;
  mesgul: string | null;
  salt: boolean;
  onAdim: (unitId: string, adim: Adim, deger: boolean) => void;
  onSoru: (soru: StudyQuestion, harf: string) => Promise<void>;
  onNot: (unitId: string) => void;
  onPdf: (yol: string, baslik: string) => void;
}

/** Normal gün: bir konu (ya da konunun bir parçası) baştan sona. */
function KonuBolumu({ parca, ...o }: Ortak & { parca: PlanParcasi }) {
  const sorular = useMemo(
    () => o.data.questions.filter((q) => q.unit_id === parca.unit_id),
    [o.data.questions, parca.unit_id],
  );
  return (
    <div className="rounded-2xl p-3 sm:p-4 mb-3 last:mb-0" style={{ background: "var(--surface-sunken)" }}>
      <KonuBasligi parca={parca} {...o} />
      <Kazanimlar unitId={parca.unit_id} {...o} />
      <Materyal unitId={parca.unit_id} {...o} />
      {sorular.length > 0 && (
        <div className="mt-4">
          <AltBaslik>Çıkmış soru</AltBaslik>
          <SoruAkisi sorular={sorular} denemeler={o.data.attempts} salt={o.salt} onSoru={o.onSoru} sirala={soruSirasi} />
        </div>
      )}
    </div>
  );
}

/**
 * Tekrar günü: dersin "Hakimim" denmemiş konuları açılır-kapanır liste
 * olarak, sorular dersin tamamından (doğru bildiklerin hariç) tek tek.
 */
function TekrarBolumu({ parcalar, dersKodu, ...o }: Ortak & { parcalar: PlanParcasi[]; dersKodu: string }) {
  const eksik = useMemo(() => eksikKonular(parcalar, o.ilerleme), [parcalar, o.ilerleme]);
  const sorular = useMemo(() => o.data.questions.filter((q) => q.ders_kodu === dersKodu), [o.data.questions, dersKodu]);
  const [acik, setAcik] = useState<string | null>(null);
  return (
    <>
      <AltBaslik>{eksik.length ? `Hakim olmadığın konular (${eksik.length})` : "Bütün konulara hakimsin ✓"}</AltBaslik>
      <ul className="space-y-2">
        {eksik.map((p) => (
          <li key={p.unit_id} className="rounded-2xl" style={{ background: "var(--surface-sunken)" }}>
            <button
              onClick={() => setAcik(acik === p.unit_id ? null : p.unit_id)}
              aria-expanded={acik === p.unit_id}
              className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-left text-[13px] font-medium"
            >
              <ChevronRight size={14} className="shrink-0 transition-transform" style={{ transform: acik === p.unit_id ? "rotate(90deg)" : undefined }} />
              <span className="flex-1">{p.baslik}</span>
            </button>
            <div className="px-3 pb-3">
              <KonuChecklist
                kayit={o.ilerleme.get(p.unit_id)}
                mevcut={o.adimHaritasi.get(p.unit_id) ?? ADIMLAR}
                mesgul={o.salt || o.mesgul === p.unit_id}
                onDegis={(adim, deger) => o.onAdim(p.unit_id, adim, deger)}
              />
              {acik === p.unit_id && (
                <>
                  <Kazanimlar unitId={p.unit_id} {...o} />
                  <Materyal unitId={p.unit_id} {...o} />
                  <button onClick={() => o.onNot(p.unit_id)} disabled={o.mesgul === p.unit_id} className="cp-btn cp-btn-ghost min-h-11 text-[12px] mt-2 disabled:opacity-40">
                    <NotebookPen size={14} />Konu notum
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <AltBaslik>Çıkmış soru · çözmediklerin ve yanlışların</AltBaslik>
        {sorular.length
          ? <SoruAkisi sorular={sorular} denemeler={o.data.attempts} salt={o.salt} onSoru={o.onSoru} sirala={tekrarSorulari} />
          : <Bos>Bu dersin çıkmış sorusu yok.</Bos>}
      </div>
    </>
  );
}

function KonuBasligi({ parca, ...o }: Ortak & { parca: PlanParcasi }) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold leading-snug">{parca.baslik}</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            ~{parca.dakika} dk
            {parca.devam && " · önceki günden devam"}
            {parca.bitiyor ? " · bugün biter" : " · yarın devam eder"}
          </p>
        </div>
        <button
          onClick={() => o.onNot(parca.unit_id)}
          disabled={o.mesgul === parca.unit_id}
          className="cp-btn cp-btn-ghost min-h-11 text-[12px] shrink-0 self-start disabled:opacity-40"
        >
          <NotebookPen size={14} />Konu notum
        </button>
      </div>
      <div className="mt-2">
        <KonuChecklist
          kayit={o.ilerleme.get(parca.unit_id)}
          mevcut={o.adimHaritasi.get(parca.unit_id) ?? ADIMLAR}
          mesgul={o.salt || o.mesgul === parca.unit_id}
          onDegis={(adim, deger) => o.onAdim(parca.unit_id, adim, deger)}
        />
      </div>
    </>
  );
}

function Kazanimlar({ unitId, kazanimlar, isaretli, kazanimVar }: Ortak & { unitId: string }) {
  const liste = kazanimlar.get(unitId) ?? [];
  return (
    <div className="mt-4">
      <AltBaslik>Kazanımlar{liste.length ? ` · ${liste.filter((k) => isaretli.has(k.id)).length}/${liste.length}` : ""}</AltBaslik>
      {!liste.length ? (
        <Bos>{kazanimVar ? "Bu konunun kazanım metni yok." : "Bu derste kazanım metni yok."}</Bos>
      ) : (
        <ul className="pl-4 space-y-1 list-disc" style={{ color: "var(--text-secondary)" }}>
          {liste.map((k) => (
            <li key={k.id} className="text-[12px] leading-snug" style={isaretli.has(k.id) ? { textDecoration: "line-through", color: "var(--text-tertiary)" } : undefined}>
              {k.metin}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Materyal({ unitId, data, onPdf }: Ortak & { unitId: string }) {
  const liste = useMemo(() => gunMateryali(data.modules.filter((m) => m.unit_id === unitId)), [data.modules, unitId]);
  const dersKodu = data.units.find((u) => u.id === unitId)?.ders_kodu ?? "";
  if (!liste.length) return <div className="mt-4"><AltBaslik>Materyal</AltBaslik><Bos>Bu konuda materyal yok.</Bos></div>;
  return (
    <div className="mt-4">
      <AltBaslik>Materyal</AltBaslik>
      <ul className="space-y-1.5">
        {liste.map(({ modul, etiket, cmid }) => {
          const Ikon = etiket === "Video" ? Video : etiket === "Ses" ? Headphones : etiket === "Kitap" ? BookOpen : FileText;
          const okunur = Boolean(cmid && dersKodu);
          return (
            <li key={modul.id} className="flex items-stretch gap-1.5">
              <button
                onClick={() => okunur ? onPdf(depoYolu(dersKodu, cmid as string), modul.ad) : modul.oys_url && window.open(modul.oys_url, "_blank", "noopener")}
                disabled={!okunur && !modul.oys_url}
                className="flex-1 min-w-0 min-h-11 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] leading-snug disabled:opacity-50"
                style={{ background: "var(--surface-raised)", color: "var(--text-primary)" }}
              >
                <Ikon size={16} className="shrink-0" style={{ color: "var(--tag-school-text)" }} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{modul.ad}</span>
                  <span className="block text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {okunur ? "Uygulamada oku" : etiket === "Video" ? "OYS'de izle" : etiket === "Ses" ? "OYS'de dinle" : "OYS'de aç"}
                    {modul.tahmini_dakika > 0 && ` · ${modul.tahmini_dakika} dk`}
                  </span>
                </span>
                {!okunur && <ArrowUpRight size={13} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />}
              </button>
              {okunur && modul.oys_url && (
                <a href={modul.oys_url} target="_blank" rel="noreferrer" className="cp-btn cp-btn-ghost min-h-11 px-2.5 text-[10px] shrink-0" title="OYS'de aç">
                  OYS<ArrowUpRight size={11} />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Sorular tek tek. Sıra açılışta bir kez kurulur: cevapladığın soru listenin
 * sonuna kaçmasın, "Sonraki soru" seni gerçekten bir sonrakine götürsün.
 */
function SoruAkisi({ sorular, denemeler, salt, onSoru, sirala }: {
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
      <div className="rounded-xl p-3 text-[12px]" style={{ background: "var(--surface-raised)" }}>
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
      <p className="text-[10px] mb-1.5" style={{ color: "var(--text-tertiary)" }}>
        Soru {i + 1}/{sira.length} · {cozulmemis} çözülmedi
        {once === "yanlis" && !cevap && " · daha önce yanlış yaptın"}
        {once === "dogru" && !cevap && " · daha önce doğru bildin"}
      </p>
      <p className="text-[13px] leading-snug font-medium whitespace-pre-wrap">{soru.govde}</p>
      <div className="mt-2 space-y-1.5">
        {soru.secenekler.map((sik) => {
          const secili = cevap === sik.harf;
          const dogruSik = cevap != null && sik.harf === soru.dogru;
          return (
            <button
              key={sik.harf}
              onClick={() => void sec(sik.harf)}
              disabled={cevap != null}
              className="w-full min-h-11 text-left rounded-lg px-3 py-2 text-[12px] leading-snug disabled:cursor-default"
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
          <p className="text-[12px] flex-1" style={{ color: cevap === soru.dogru ? "var(--priority-low-text)" : "var(--priority-high-text)" }}>
            {soru.dogru == null ? "Cevap anahtarı yok." : cevap === soru.dogru ? "Doğru." : `Yanlış — doğrusu ${soru.dogru}.`}
            {kaydediliyor && " Kaydediliyor…"}
          </p>
          <button onClick={() => setI(i + 1)} className="cp-btn cp-btn-primary min-h-11 text-[12px]">
            Sonraki soru<ChevronRight size={14} />
          </button>
        </div>
      )}
      {cevap == null && i + 1 < sira.length && (
        <button onClick={() => setI(i + 1)} className="mt-2 text-[11px] min-h-9" style={{ color: "var(--text-tertiary)" }}>Bu soruyu geç</button>
      )}
    </div>
  );
}

function AltBaslik({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-tertiary)" }}>{children}</h4>;
}

function Bos({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}
