"use client";

// Gün sayfası (Plan v3, Faz C; 3 Ekim'de çalışma föyü olarak yeniden düzenlendi).
//
// Takvimdeki çalışma etkinliğine tıklayınca açılır. Üstte bugünün özeti; her
// ders bir föy: konu → öğreneceklerin → malzemen → nasıl çalışacaksın. Her
// adım kendi malzemesini taşır ve checklist'in bir adımını işaretler; olmayan
// malzeme (ör. PDF'siz konu) gizlenmez, açıkça "yok" yazar. Föy ve çalışma
// mantığı `KonuFoyu.tsx`'te (ders sayfası da aynısını kullanıyor).
// Veri `ybs_haftalik_plan`'dan; ilerleme Okul sekmesiyle aynı tablolara yazılır.

import { AciklamaKarti, haftaninAciklamasi } from "./GeminiParcalari";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowLeft, ChevronRight, Loader2, MoreHorizontal, Pencil, RefreshCw } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { buildSchoolDemoData } from "@/lib/school-data";
import { gununPlani, planEtkinlikId, planiHesapla, type PlanSatiri } from "@/lib/haftalik-plan-kayit";
import type { PlanParcasi } from "@/lib/haftalik-plan";
import { eksikKonular, konuAdi, tekrarSorulari } from "@/lib/gun-sayfasi";
import { AltBaslik, Bos, Foy, KonuBasligi, SoruAkisi, useKonuCalisma, type Ortak } from "./KonuFoyu";

/** Ekranı açan kabuk: tarih yoksa hiçbir şey çizmez, veri yüklemez. */
export function GunSayfasi() {
  const tarih = useAppStore((s) => s.gunSayfasiTarihi);
  if (!tarih) return null;
  return <GunSayfasiIcerik key={tarih} tarih={tarih} />;
}

function GunSayfasiIcerik({ tarih }: { tarih: string }) {
  const { user, isDemoMode, events, openGunSayfasi, openEventModal } = useAppStore();
  const kapat = useCallback(() => openGunSayfasi(null), [openGunSayfasi]);
  const k = useKonuCalisma(kapat);
  const { data, hata, setHata, salt, dersAdi, unitById } = k;
  const [satirlar, setSatirlar] = useState<PlanSatiri[] | null>(null);

  const yukle = useCallback(async () => {
    setHata(null);
    if (salt || !user?.id) {
      // Demoda kayıtlı plan yok; plan o an hesaplanıp günü ondan alınıyor.
      const demo = buildSchoolDemoData();
      k.setData(demo);
      const gun = planiHesapla(demo, events, parseISO(tarih))?.plan.gunler.find((g) => g.tarih === tarih);
      setSatirlar(gun?.dersler.map((d, i) => ({
        id: `demo:${tarih}:${i + 1}`, user_id: "demo", hafta: "", tarih, gun_turu: gun.tur, sira: i + 1,
        ders_kodu: d.ders_kodu, tur: d.tur, dakika: d.dakika, parcalar: d.parcalar, olusturma: "",
      })) ?? []);
      return;
    }
    try {
      const [, plan] = await Promise.all([k.yukle(), gununPlani(user.id, tarih)]);
      setSatirlar(plan);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Veri alınamadı");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salt, user?.id, tarih, events]);

  // `events` her senkronda yenilendiği için yalnız ilk açılışta yükleniyor;
  // sonraki tazelemeler işaretleme ve soru çözümünden sonra elle.
  const ilkYukleme = useRef(false);
  useEffect(() => {
    if (ilkYukleme.current) return;
    ilkYukleme.current = true;
    void yukle();
  }, [yukle]);

  const etkinlik = useMemo(() => events.find((e) => e.id === planEtkinlikId(tarih)), [events, tarih]);
  const duzenle = useCallback(() => {
    if (!etkinlik) return;
    kapat();
    openEventModal(etkinlik, undefined, { duzenle: true });
  }, [etkinlik, kapat, openEventModal]);

  const gunTuru = satirlar?.[0]?.gun_turu;
  const dersSatirlari = (satirlar ?? []).filter((s) => s.ders_kodu);
  const toplamDakika = dersSatirlari.reduce((t, s) => t + s.dakika, 0);
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
        <button onClick={kapat} className="cp-btn cp-btn-ghost min-h-11 px-2.5 gap-1.5 text-[13px] lg:text-[15px]" aria-label="Takvime dön">
          <ArrowLeft size={18} /><span className="hidden sm:inline">Takvim</span>
        </button>
        <h1 className="min-w-0 flex-1 text-[15px] lg:text-[19px] font-semibold leading-tight truncate">
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
                <button onClick={duzenle} className="w-full min-h-11 px-3 flex items-center gap-2 text-[13px] lg:text-[15px] text-left" style={{ color: "var(--text-secondary)" }}>
                  <Pencil size={14} />Takvim etkinliğini düzenle
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl lg:max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-10 py-4 lg:py-8 space-y-4 lg:space-y-8" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}>
          {hata && (
            <div className="rounded-xl px-3 py-2 text-[12px] lg:text-[14px] flex items-center gap-2" role="alert" style={{ background: "var(--priority-high-bg)", color: "var(--priority-high-text)" }}>
              <span className="flex-1">{hata}</span>
              <button onClick={() => void yukle()} className="cp-btn cp-btn-ghost min-h-9 text-[11px] lg:text-[13px]"><RefreshCw size={12} />Tekrar dene</button>
            </div>
          )}
          {salt && (
            <p className="text-[11px] lg:text-[13px] rounded-xl px-3 py-2" style={{ background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}>
              Demo: işaretlemeler ve cevaplar kaydedilmez.
            </p>
          )}

          {(!data || satirlar === null) && !hata && (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] lg:text-[14px]" style={{ color: "var(--text-tertiary)" }}>
              <Loader2 size={16} className="animate-spin" />Günün planı yükleniyor…
            </div>
          )}

          {data && satirlar !== null && !dersSatirlari.length && (
            <div className="rounded-2xl p-4 text-[13px] lg:text-[15px] leading-relaxed" style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)", color: "var(--text-secondary)" }}>
              {gunTuru === "sinav"
                ? "Bugün sınav günü. Başarılar!"
                : gunTuru === "bos"
                  ? "Bu gün için çalışma planlanmadı."
                  : "Bu gün için kayıtlı plan bulunamadı. Okul → Bu hafta → \"Yeniden planla\" ile plan yeniden kurulabilir."}
              {etkinlik?.description && (
                <pre className="mt-3 whitespace-pre-wrap text-[12px] lg:text-[14px] font-sans" style={{ color: "var(--text-tertiary)" }}>{etkinlik.description}</pre>
              )}
            </div>
          )}

          {/* Faz G: haftanın açıklaması (Gemini), planın üstünde. */}
          {data && <AciklamaKarti buyuk aciklama={haftaninAciklamasi(data.aciklamalar, satirlar?.[0]?.hafta)} />}

          {/* Bugünün özeti: kaç ders, hangileri, ne kadar. Satıra basınca derse iner. */}
          {data && dersSatirlari.length > 0 && (
            <div>
              <p className="text-[18px] lg:text-[26px] font-semibold leading-tight">
                {gunTuru === "tekrar" ? "Tekrar günü" : "Bugün"} {dersSatirlari.length} ders · ~{toplamDakika} dk
              </p>
              <ol className="mt-2 lg:mt-4 space-y-1 lg:space-y-2">
                {dersSatirlari.map((satir, i) => {
                  const ilk = satir.parcalar[0];
                  const unit = ilk && unitById.get(ilk.unit_id);
                  return (
                    <li key={satir.id}>
                      <button onClick={() => git(`ders-${i + 1}`)} className="w-full min-h-11 flex items-baseline gap-2 text-left text-[13px] lg:text-[15px] rounded-lg px-2 -mx-2 hover:bg-[var(--surface-sunken)]">
                        <span className="font-semibold tabular-nums" style={{ color: "var(--tag-school-text)" }}>{i + 1}.</span>
                        <span className="flex-1 min-w-0">
                          <span className="font-medium">{dersAdi(satir.ders_kodu as string)}</span>
                          <span style={{ color: "var(--text-tertiary)" }}>
                            {satir.tur === "tekrar"
                              ? " — tekrar"
                              : ilk && ` — ${unit?.konu_no ? `${unit.konu_no}. konu: ` : ""}${konuAdi(ilk.baslik)}${satir.parcalar.length > 1 ? ` +${satir.parcalar.length - 1}` : ""}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] lg:text-[14px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>~{satir.dakika} dk</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {data && dersSatirlari.map((satir, i) => {
            const kod = satir.ders_kodu as string;
            const ortak = k.ortak(kod) as Ortak;
            return (
              <section
                key={satir.id}
                id={`ders-${i + 1}`}
                className="rounded-2xl p-4 sm:p-5 lg:p-10 scroll-mt-3"
                style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}
              >
                <p className="text-[11px] lg:text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  Ders {i + 1} · {satir.tur === "tekrar" ? "tekrar" : `~${satir.dakika} dk`}
                </p>
                <h2 className="text-[17px] lg:text-[24px] font-semibold leading-snug">{dersAdi(kod)}</h2>
                {satir.tur === "tekrar"
                  ? <TekrarBolumu parcalar={satir.parcalar} dersKodu={kod} {...ortak} />
                  : satir.parcalar.map((p, j) => <KonuFoyuBolumu key={p.unit_id} parca={p} ilk={j === 0} {...ortak} />)}
              </section>
            );
          })}
        </div>
      </div>

      {k.pdfKatmani}
    </div>
  );
}

// ── Bölümler ─────────────────────────────────────────────────────

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
      {(() => { const c = parcaCumlesi(parca, unit?.tahmini_dakika ?? 0); return c && <p className="text-[12px] lg:text-[14px] mt-1" style={{ color: "var(--text-tertiary)" }}>{c}</p>; })()}
      <Foy unitId={parca.unit_id} butce={parca.dakika} bitiyor={parca.bitiyor} {...o} />
    </div>
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
      <p className="text-[12px] lg:text-[14px] mt-1" style={{ color: "var(--text-tertiary)" }}>
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
