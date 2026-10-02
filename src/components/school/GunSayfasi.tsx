"use client";

// Gün sayfası (Plan v3, Faz C; 3 Ekim'de çalışma föyü olarak yeniden düzenlendi).
//
// Takvimdeki çalışma etkinliğine tıklayınca açılır. Üstte bugünün özeti; her
// ders bir föy: konu → öğreneceklerin → malzemen → nasıl çalışacaksın. Her
// adım kendi malzemesini taşır ve checklist'in bir adımını işaretler; olmayan
// malzeme (ör. PDF'siz konu) gizlenmez, açıkça "yok" yazar. Neyin hangi sırayla
// gösterileceği `lib/gun-sayfasi.ts`'teki `konuFoyu`'nda, burada yalnız çizim.
// Veri `ybs_haftalik_plan`'dan; ilerleme Okul sekmesiyle aynı tablolara yazılır.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, Info, Loader2, MoreHorizontal,
  NotebookPen, Pencil, RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  AdimKolonuYok, buildSchoolDemoData, fetchSchoolData, okulOnbellegi, saveQuestionAttempt,
  setUnitNote, setUnitStep, type SchoolData, type StudyQuestion,
} from "@/lib/school-data";
import type { StudyUnit, UnitProgress } from "@/lib/study-plan";
import { buildUnitNote } from "@/lib/study-note";
import { gununPlani, planEtkinlikId, planiHesapla, type PlanSatiri } from "@/lib/haftalik-plan-kayit";
import type { PlanParcasi } from "@/lib/haftalik-plan";
import { ADIMLAR, ilerlemeKatsayisi, mevcutAdimHaritasi, type Adim } from "@/lib/ilerleme";
import { depoYolu } from "@/lib/pdf-kaynak";
import {
  ADIM_ISARETI, eksikKonular, foyMalzemesi, konuAdi, konuFoyu, soruDurumlari, soruSirasi, tekrarSorulari,
  type FoyAdimi, type FoyMalzemesi, type MalzemeTuru,
} from "@/lib/gun-sayfasi";

const PdfReader = dynamic(() => import("@/components/editor/PdfReader").then((m) => m.PdfReader), { ssr: false });

/** Ekranı açan kabuk: tarih yoksa hiçbir şey çizmez, veri yüklemez. */
export function GunSayfasi() {
  const tarih = useAppStore((s) => s.gunSayfasiTarihi);
  if (!tarih) return null;
  return <GunSayfasiIcerik key={tarih} tarih={tarih} />;
}

function GunSayfasiIcerik({ tarih }: { tarih: string }) {
  const {
    user, isDemoMode, events, openGunSayfasi, openEventModal,
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
  const [menu, setMenu] = useState(false);
  const git = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

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
        <h1 className="min-w-0 flex-1 text-[15px] font-semibold leading-tight truncate">
          {format(parseISO(tarih), "d MMMM EEEE", { locale: tr })}
        </h1>
        {/* Çalışırken işe yaramayan düzenleme, göze batmasın diye menüde. */}
        {etkinlik && !isDemoMode && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="cp-icon-button" aria-label="Diğer" aria-expanded={menu}>
              <MoreHorizontal size={18} />
            </button>
            {menu && (
              <div className="absolute right-0 top-11 z-10 rounded-xl py-1 min-w-48" style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)", boxShadow: "var(--golge-kalkik)" }}>
                <button onClick={duzenle} className="w-full min-h-11 px-3 flex items-center gap-2 text-[13px] text-left" style={{ color: "var(--text-secondary)" }}>
                  <Pencil size={14} />Takvim etkinliğini düzenle
                </button>
              </div>
            )}
          </div>
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
            <div className="rounded-2xl p-4 text-[13px] leading-relaxed" style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)", color: "var(--text-secondary)" }}>
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

          {/* Bugünün özeti: kaç ders, hangileri, ne kadar. Satıra basınca derse iner. */}
          {data && dersSatirlari.length > 0 && (
            <div>
              <p className="text-[18px] font-semibold leading-tight">
                {gunTuru === "tekrar" ? "Tekrar günü" : "Bugün"} {dersSatirlari.length} ders · ~{toplamDakika} dk
              </p>
              <ol className="mt-2 space-y-1">
                {dersSatirlari.map((satir, i) => {
                  const ilk = satir.parcalar[0];
                  const unit = ilk && unitById.get(ilk.unit_id);
                  return (
                    <li key={satir.id}>
                      <button onClick={() => git(`ders-${i + 1}`)} className="w-full min-h-11 flex items-baseline gap-2 text-left text-[13px] rounded-lg px-2 -mx-2 hover:bg-[var(--surface-sunken)]">
                        <span className="font-semibold tabular-nums" style={{ color: "var(--tag-school-text)" }}>{i + 1}.</span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium">{dersAdi(satir.ders_kodu as string)}</span>
                          <span style={{ color: "var(--text-tertiary)" }}>
                            {satir.tur === "tekrar"
                              ? " — tekrar"
                              : ilk && ` — ${unit?.konu_no ? `${unit.konu_no}. konu: ` : ""}${konuAdi(ilk.baslik)}${satir.parcalar.length > 1 ? ` +${satir.parcalar.length - 1}` : ""}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>~{satir.dakika} dk</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {data && dersSatirlari.map((satir, i) => {
            const kod = satir.ders_kodu as string;
            const ortak: Ortak = {
              data, ilerleme, adimHaritasi, kazanimlar, unitById, mesgul, salt,
              kazanimVar: kazanimliDersler.has(kod),
              pdfliKonular: pdfliKonular.get(kod) ?? [],
              onAdim: adimDegistir, onSoru: soruCoz, onNot: notuAc,
              onPdf: (yol: string, baslik: string) => setPdf({ yol, baslik }),
            };
            return (
              <section
                key={satir.id}
                id={`ders-${i + 1}`}
                className="rounded-2xl p-4 sm:p-5 scroll-mt-3"
                style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}
              >
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  Ders {i + 1} · {satir.tur === "tekrar" ? "tekrar" : `~${satir.dakika} dk`}
                </p>
                <h2 className="text-[17px] font-semibold leading-snug">{dersAdi(kod)}</h2>
                {satir.tur === "tekrar"
                  ? <TekrarBolumu parcalar={satir.parcalar} dersKodu={kod} {...ortak} />
                  : satir.parcalar.map((p, j) => <KonuFoyuBolumu key={p.unit_id} parca={p} ilk={j === 0} {...ortak} />)}
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
}

/** Konunun parçası hakkında tek cümle: bugün konunun neresi yapılıyor. */
function parcaCumlesi(p: PlanParcasi, toplam: number): string | null {
  const tamami = toplam > 0 ? `Konunun tamamı ~${toplam} dk. ` : "";
  if (!p.devam && p.bitiyor) return null;
  if (!p.devam) return `${tamami}Bugün ~${p.dakika} dk'lık ilk kısmı; kalanı sonraki çalışmada.`;
  if (!p.bitiyor) return `${tamami}Önceki günden devam; bugün ~${p.dakika} dk, kalanı sonraki çalışmada.`;
  return `${tamami}Önceki günden devam; bugün bitiyor.`;
}

/** Normal gün: bir konu (ya da konunun bugünkü kısmı) föy olarak. */
function KonuFoyuBolumu({ parca, ilk, ...o }: Ortak & { parca: PlanParcasi; ilk: boolean }) {
  const unit = o.unitById.get(parca.unit_id);
  return (
    <div className={ilk ? "mt-1" : "mt-5 pt-4"} style={ilk ? undefined : { borderTop: "0.5px solid var(--border-default)" }}>
      <KonuBasligi unitId={parca.unit_id} baslik={parca.baslik} {...o} />
      {(() => { const c = parcaCumlesi(parca, unit?.tahmini_dakika ?? 0); return c && <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>{c}</p>; })()}
      <Foy unitId={parca.unit_id} butce={parca.dakika} bitiyor={parca.bitiyor} {...o} />
    </div>
  );
}

function KonuBasligi({ unitId, baslik, ...o }: Ortak & { unitId: string; baslik: string }) {
  const unit = o.unitById.get(unitId);
  const yuzde = Math.round(ilerlemeKatsayisi(o.ilerleme.get(unitId), o.adimHaritasi.get(unitId) ?? ADIMLAR) * 100);
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="flex-1 min-w-0 text-[15px] font-medium leading-snug">
        {unit?.konu_no ? `Konu ${unit.konu_no} — ` : ""}{konuAdi(baslik)}
      </h3>
      <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: yuzde === 100 ? "var(--priority-low-text)" : "var(--text-tertiary)" }}>
        %{yuzde}
      </span>
    </div>
  );
}

/** Föyün gövdesi: öğreneceklerin → malzemen → nasıl çalışacaksın → konu notu. */
function Foy({ unitId, butce, bitiyor, ...o }: Ortak & { unitId: string; butce: number; bitiyor: boolean }) {
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
    if (m.cmid && dersKodu) o.onPdf(depoYolu(dersKodu, m.cmid), m.ad);
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
        <ul className="pl-4 space-y-1 list-disc text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
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
        <p className="text-[12px] leading-relaxed rounded-xl px-3 py-2 mb-1 flex gap-2" style={{ background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)" }}>
          <Info size={14} className="shrink-0 mt-0.5" />{foy.aciklama}
        </p>
      )}
      {ayir && bugun.length > 0 && <GrupBasligi>Bugün{foy.bugunDakika ? ` · ~${foy.bugunDakika} dk` : ""}</GrupBasligi>}
      {bugun.map(({ a, no }) => <AdimSatiri key={no} adim={a} no={no} acik {...adimProps} />)}
      {ayir && <GrupBasligi>Sonraki çalışmada</GrupBasligi>}
      {sonra.map(({ a, no }) => <AdimSatiri key={no} adim={a} no={no} acik={false} {...adimProps} />)}
      {yapilan.length > 0 && <GrupBasligi>Yapıldı</GrupBasligi>}
      {yapilan.map(({ a, no }) => <AdimSatiri key={no} adim={a} no={no} acik={false} {...adimProps} />)}

      <button onClick={() => o.onNot(unitId)} disabled={o.mesgul === unitId} className="cp-btn cp-btn-ghost min-h-11 text-[12px] mt-3 disabled:opacity-40">
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
  if (m.cmid) {
    return (
      <button onClick={() => ac(m)} className="cp-btn cp-btn-primary min-h-11 px-3 text-[12px] shrink-0">
        <BookOpen size={14} />Oku
      </button>
    );
  }
  if (!m.oys_url) return null;
  const fiil = m.tur === "video" ? "İzle" : m.tur === "ses" ? "Dinle" : m.tur === "test" ? "Çöz" : "Aç";
  return (
    <a href={m.oys_url} target="_blank" rel="noreferrer" className="cp-btn cp-btn-ghost min-h-11 px-3 text-[12px] shrink-0" title="OYS'de açılır">
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
          <span className="text-[12px] leading-snug" style={{ color: "var(--priority-medium-text)" }}>
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
        <span className="w-full flex items-center gap-2 min-w-0">
          <span className="flex-1 min-w-0 text-[13px] leading-snug">
            {m.ad}
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
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
    icerik: <span className="text-[13px]" style={{ color: soruSayisi ? undefined : "var(--text-tertiary)" }}>
      {soruSayisi ? `${soruSayisi} soru · bu sayfada çözülür` : "Bu konunun çıkmış sorusu yok."}
    </span>,
  });
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-[130px_minmax(0,1fr)] gap-x-3">
      {satirlar.map((s) => (
        <div key={s.key} className="contents">
          <dt className={`text-[11px] sm:text-[12px] ${s.ad ? "pt-2 sm:pt-0 sm:min-h-11 sm:flex sm:items-center" : "hidden sm:block"}`} style={{ color: "var(--text-tertiary)" }}>{s.ad}</dt>
          <dd className="py-1 sm:py-1.5 min-h-11 flex items-center">{s.icerik}</dd>
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
    <div className="py-2.5" style={{ borderTop: "0.5px solid var(--border-default)" }}>
      <div className="flex gap-2.5 items-start">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 mt-0.5"
          style={adim.yapildi
            ? { background: "var(--priority-low-bg)", color: "var(--priority-low-text)" }
            : acik ? { background: "var(--tag-school-bg)", color: "var(--tag-school-text)" } : { background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}
        >
          {adim.yapildi ? <Check size={13} strokeWidth={3} /> : no}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-snug" style={{ color: soluk ? "var(--text-secondary)" : "var(--text-primary)" }}>
            {adim.metin}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
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
        <ul className="mt-1.5 ml-8 space-y-1">
          {adim.malzeme.map((m, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <span className="flex-1 min-w-0 truncate">{m.ad}{m.dakika > 0 && <span style={{ color: "var(--text-tertiary)" }}> · {m.dakika} dk</span>}</span>
              <MalzemeDugmesi m={m} ac={ac} />
            </li>
          ))}
        </ul>
      )}
      {adim.soru && sorular.length > 0 && (
        <div className="mt-2 ml-8">
          {sorularAcik
            ? <SoruAkisi sorular={sorular} sirala={soruSirasi} {...soruProps} />
            : (
              <button onClick={() => setSorularAcik(true)} className="cp-btn cp-btn-ghost min-h-11 text-[12px]">
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
      className="cp-btn min-h-11 px-2.5 text-[11px] gap-1.5 shrink-0 disabled:opacity-50"
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
 * Tekrar günü: dersin "Hakimim" denmemiş konuları açılır-kapanır föy olarak,
 * sorular dersin tamamından (doğru bildiklerin hariç) tek tek.
 */
function TekrarBolumu({ parcalar, dersKodu, ...o }: Ortak & { parcalar: PlanParcasi[]; dersKodu: string }) {
  const eksik = useMemo(() => eksikKonular(parcalar, o.ilerleme), [parcalar, o.ilerleme]);
  const sorular = useMemo(() => o.data.questions.filter((q) => q.ders_kodu === dersKodu), [o.data.questions, dersKodu]);
  const [acik, setAcik] = useState<string | null>(null);
  return (
    <>
      <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>
        Sınavdan önceki tekrar: önce hakim olmadığın konulara dön, sonra soruları çöz.
      </p>
      <AltBaslik>{eksik.length ? `1. Hakim olmadığın konular (${eksik.length})` : "Bütün konulara hakimsin ✓"}</AltBaslik>
      <ul className="space-y-2">
        {eksik.map((p) => (
          <li key={p.unit_id} className="rounded-2xl" style={{ background: "var(--surface-sunken)" }}>
            <button
              onClick={() => setAcik(acik === p.unit_id ? null : p.unit_id)}
              aria-expanded={acik === p.unit_id}
              className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-left"
            >
              <ChevronRight size={14} className="shrink-0 transition-transform" style={{ transform: acik === p.unit_id ? "rotate(90deg)" : undefined }} />
              <span className="flex-1 min-w-0"><KonuBasligi unitId={p.unit_id} baslik={p.baslik} {...o} /></span>
            </button>
            {acik === p.unit_id && (
              <div className="px-3 pb-3">
                <Foy unitId={p.unit_id} butce={0} bitiyor {...o} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <AltBaslik>{`${eksik.length ? "2" : "1"}. Çıkmış sorular · çözmediklerin ve yanlışların`}</AltBaslik>
      {sorular.length
        ? <SoruAkisi sorular={sorular} denemeler={o.data.attempts} salt={o.salt} onSoru={o.onSoru} sirala={tekrarSorulari} />
        : <Bos>Bu dersin çıkmış sorusu yok.</Bos>}
    </>
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
  return <h4 className="text-[13px] font-semibold mt-5 mb-1.5">{children}</h4>;
}

function GrupBasligi({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium mt-2 mb-1" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}

function Bos({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}
