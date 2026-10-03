"use client";

// Ders sayfası (Plan v3, Faz D).
//
// Okul sekmesindeki "Dersler" bölümünde bir derse basınca tam ekran açılır:
// üstte dersin durumu (eşik, kalan iş, bu haftanın planı, notun), altta vize
// ve final konuları. Konuya basınca gün sayfasındaki föyün aynısı açılır —
// plan dışı bir konuyu da aynı yolla çalışırsın. İşaretlemeler gün sayfası ve
// Okul sekmesiyle aynı tablolara yazılır.

import { ZorlukRozeti } from "./GeminiParcalari";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, RefreshCw, Save } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { requiredFinal, saveSchoolGrade } from "@/lib/school-data";
import { haftaninPlani, type PlanSatiri } from "@/lib/haftalik-plan-kayit";
import { hedefHafta } from "@/lib/haftalik-plan";
import { ADIMLAR, ilerlemeKatsayisi } from "@/lib/ilerleme";
import type { StudyUnit } from "@/lib/study-plan";
import { konuAdi } from "@/lib/gun-sayfasi";
import { dersOzetleri, soruSayisi, sureYazi } from "@/lib/ders-paneli";
import { AltBaslik, Bos, Foy, useKonuCalisma, type Ortak } from "./KonuFoyu";
import { KonuChecklist } from "./KonuChecklist";

/** Ekranı açan kabuk: ders seçili değilse hiçbir şey çizmez, veri yüklemez. */
export function DersSayfasi() {
  const kod = useAppStore((s) => s.dersSayfasiKodu);
  if (!kod) return null;
  return <DersSayfasiIcerik key={kod} kod={kod} />;
}

function DersSayfasiIcerik({ kod }: { kod: string }) {
  const { user, openDersSayfasi } = useAppStore();
  const kapat = useCallback(() => openDersSayfasi(null), [openDersSayfasi]);
  const k = useKonuCalisma(kapat);
  const { data, hata, salt } = k;
  const [haftaSatirlari, setHaftaSatirlari] = useState<PlanSatiri[]>([]);
  const [acik, setAcik] = useState<string | null>(null);

  useEffect(() => {
    void k.yukle();
    if (!salt && user?.id) {
      haftaninPlani(user.id, hedefHafta(new Date()).hafta).then(setHaftaSatirlari).catch((e) => console.error("Haftanın planı okunamadı:", e));
    }
    // Yalnız açılışta; sonraki tazelemeler işaretlemeden sonra föyün içinden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const course = data?.courses.find((c) => c.kod === kod);
  const ozet = useMemo(() => data && dersOzetleri({
    kodlar: [kod], units: data.units, ilerleme: k.ilerleme, adimHaritasi: k.adimHaritasi, haftaSatirlari,
  })[0], [data, kod, k.ilerleme, k.adimHaritasi, haftaSatirlari]);
  const ortak = k.ortak(kod);
  const grade = data?.grades.find((g) => g.ders_kodu === kod);
  const konuSayisi = ozet ? ozet.konular.vize.length + ozet.konular.final.length : 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--surface-base)" }} role="dialog" aria-modal="true" aria-label="Ders sayfası">
      <header
        className="flex items-center gap-2 px-3 sm:px-5 pb-2 shrink-0"
        style={{ borderBottom: "0.5px solid var(--border-default)", paddingTop: "calc(8px + env(safe-area-inset-top))" }}
      >
        <button onClick={kapat} className="cp-btn cp-btn-ghost min-h-11 px-2.5 gap-1.5 text-[13px]" aria-label="Okula dön">
          <ArrowLeft size={18} /><span className="hidden sm:inline">Okul</span>
        </button>
        <h1 className="min-w-0 flex-1 text-[15px] lg:text-[17px] font-semibold leading-tight truncate">{course?.ad ?? kod}</h1>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-3xl lg:max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-10 py-4 lg:py-8 space-y-4 lg:space-y-8" style={{ paddingBottom: "calc(32px + env(safe-area-inset-bottom))" }}>
          {hata && (
            <div className="rounded-xl px-3 py-2 text-[12px] flex items-center gap-2" role="alert" style={{ background: "var(--priority-high-bg)", color: "var(--priority-high-text)" }}>
              <span className="flex-1">{hata}</span>
              <button onClick={() => void k.yukle()} className="cp-btn cp-btn-ghost min-h-9 text-[11px]"><RefreshCw size={12} />Tekrar dene</button>
            </div>
          )}
          {salt && (
            <p className="text-[11px] rounded-xl px-3 py-2" style={{ background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}>
              Demo: işaretlemeler ve cevaplar kaydedilmez.
            </p>
          )}
          {!data && !hata && (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              <Loader2 size={16} className="animate-spin" />Ders yükleniyor…
            </div>
          )}

          {data && ozet && ortak && (
            <>
              <div>
                <p className="text-[11px] lg:text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  {kod}{course ? ` · ${course.akts} AKTS` : ""} · {konuSayisi} konu
                  {" · "}{ortak.pdfliKonular.length ? `${ortak.pdfliKonular.length} konuda PDF` : "uygulamada PDF yok"}
                  {" · "}{ortak.kazanimVar ? "kazanımlı" : "kazanım metni yok"}
                </p>
                <h2 className="text-[20px] lg:text-[28px] font-semibold leading-tight mt-0.5">{course?.ad ?? kod}</h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
                <Kutucuk baslik="Vize kapsamı" deger={`%${ozet.yuzde}`} alt={ozet.esikte ? "eşikte ✓" : `eşiğe ${soruSayisi(ozet.esige_kalan)}`} iyi={ozet.esikte} />
                <Kutucuk baslik="Vizeye kalan iş" deger={ozet.kalan_dakika ? `~${sureYazi(ozet.kalan_dakika)}` : "yok"} alt={`${ozet.konular.vize.length} vize konusu`} />
                <Kutucuk
                  baslik="Bu hafta"
                  deger={ozet.buHafta.length ? `${ozet.buHafta.length} konu` : "planda yok"}
                  alt={ozet.buHafta.length ? `${ozet.buHaftaBiten} tanesi bitti` : "plan pazar akşamı yeniden kurulur"}
                />
                <Kutucuk
                  baslik="Notun"
                  deger={grade?.harf ?? grade?.statu ?? (grade?.vize != null ? `Vize ${grade.vize}` : "—")}
                  alt={requiredFinal(grade?.vize) != null ? `finalde en az ${requiredFinal(grade?.vize)}` : "sınavdan sonra gir"}
                />
              </div>

              <div className="rounded-2xl p-4 sm:p-5 lg:p-10" style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
                <KonuListesi
                  baslik={`Vize konuları (${ozet.konular.vize.length})`}
                  konular={ozet.konular.vize}
                  buHafta={ozet.buHafta}
                  acik={acik}
                  setAcik={setAcik}
                  ortak={ortak}
                  ilk
                />
                {ozet.konular.final.length > 0 && (
                  <KonuListesi
                    baslik={`Final konuları (${ozet.konular.final.length})`}
                    aciklama="Vizeden sonra plana girer; istersen şimdiden çalışabilirsin."
                    konular={ozet.konular.final}
                    buHafta={ozet.buHafta}
                    acik={acik}
                    setAcik={setAcik}
                    ortak={ortak}
                  />
                )}
              </div>

              {!salt && user?.id && (
                <NotGirisi
                  kod={kod}
                  userId={user.id}
                  vize={grade?.vize ?? null}
                  final={grade?.final ?? null}
                  onKaydet={() => void k.yukle()}
                />
              )}
            </>
          )}
        </div>
      </div>

      {k.pdfKatmani}
    </div>
  );
}

function Kutucuk({ baslik, deger, alt, iyi }: { baslik: string; deger: string; alt: string; iyi?: boolean }) {
  return (
    <div className="rounded-2xl p-3 lg:p-5" style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
      <p className="text-[11px] lg:text-[13px]" style={{ color: "var(--text-tertiary)" }}>{baslik}</p>
      <p className="text-[17px] lg:text-[22px] font-semibold leading-tight mt-0.5">{deger}</p>
      <p className="text-[11px] lg:text-[13px] mt-0.5" style={{ color: iyi ? "var(--priority-low-text)" : "var(--text-tertiary)" }}>{alt}</p>
    </div>
  );
}

/** Konular kitap sırasıyla; kapalıyken satırda checklist, açılınca föy. */
function KonuListesi({ baslik, aciklama, konular, buHafta, acik, setAcik, ortak, ilk }: {
  baslik: string;
  aciklama?: string;
  konular: StudyUnit[];
  buHafta: string[];
  acik: string | null;
  setAcik: (id: string | null) => void;
  ortak: Ortak;
  ilk?: boolean;
}) {
  return (
    <section className={ilk ? undefined : "mt-8 lg:mt-12"}>
      <h3 className="text-[15px] lg:text-[19px] font-semibold">{baslik}</h3>
      {aciklama && <p className="text-[12px] lg:text-[14px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{aciklama}</p>}
      {!konular.length && <div className="mt-2"><Bos>Bu dilimde konu yok.</Bos></div>}
      <ul className="mt-2 lg:mt-4">
        {konular.map((u) => {
          const acikMi = acik === u.id;
          const mevcut = ortak.adimHaritasi.get(u.id) ?? ADIMLAR;
          const yuzde = Math.round(ilerlemeKatsayisi(ortak.ilerleme.get(u.id), mevcut) * 100);
          return (
            <li key={u.id} className="py-2 lg:py-4" style={{ borderTop: "0.5px solid var(--border-default)" }}>
              <button
                onClick={() => setAcik(acikMi ? null : u.id)}
                aria-expanded={acikMi}
                className="w-full min-h-11 flex items-center gap-2 lg:gap-4 text-left"
              >
                <ChevronRight size={16} className="shrink-0 transition-transform" style={{ color: "var(--text-tertiary)", transform: acikMi ? "rotate(90deg)" : undefined }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] lg:text-[17px] font-medium leading-snug">
                    {u.konu_no ? `Konu ${u.konu_no} — ` : ""}{konuAdi(u.baslik)}
                  </span>
                  <span className="block text-[11px] lg:text-[13px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    ~{u.tahmini_dakika} dk · {soruSayisi(u.soru_degeri)} değerinde
                    {u.zorluk ? <> · <ZorlukRozeti zorluk={u.zorluk} /></> : null}
                    {buHafta.includes(u.id) && <span style={{ color: "var(--tag-school-text)" }}> · bu haftanın planında</span>}
                  </span>
                </span>
                {/* Kapalıyken yüzde checklist'in yanında; açıkken föyde checklist yok, burada. */}
                {acikMi && (
                  <span className="text-[12px] lg:text-[14px] font-semibold tabular-nums shrink-0" style={{ color: yuzde === 100 ? "var(--priority-low-text)" : "var(--text-tertiary)" }}>
                    %{yuzde}
                  </span>
                )}
              </button>
              {acikMi ? (
                <div className="mt-1 lg:mt-2 pl-0 sm:pl-6 lg:pl-8">
                  <Foy unitId={u.id} butce={0} bitiyor {...ortak} />
                </div>
              ) : (
                <div className="mt-1.5 pl-6 lg:pl-8">
                  <KonuChecklist
                    kayit={ortak.ilerleme.get(u.id)}
                    mevcut={mevcut}
                    mesgul={ortak.salt || ortak.mesgul === u.id}
                    onDegis={(adim, deger) => ortak.onAdim(u.id, adim, deger)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Vize/final notu: eskiden Okul sekmesinde ayrı bir listedeydi, şimdi dersin kendi sayfasında. */
function NotGirisi({ kod, userId, vize, final, onKaydet }: {
  kod: string; userId: string; vize: number | null; final: number | null; onKaydet: () => void;
}) {
  const [v, setV] = useState(vize == null ? "" : String(vize));
  const [f, setF] = useState(final == null ? "" : String(final));
  const [durum, setDurum] = useState<string | null>(null);
  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setDurum("Kaydediliyor…");
    try {
      await saveSchoolGrade(userId, {
        courseCode: kod, term: "2026-2027 Güz",
        midterm: v === "" ? undefined : Number(v), final: f === "" ? undefined : Number(f),
      });
      setDurum("Kaydedildi");
      onKaydet();
    } catch (err) {
      setDurum(err instanceof Error ? err.message : "Kaydedilemedi");
    }
  };
  const alan = "rounded-xl px-3 text-[13px] lg:text-[15px] min-h-11 w-full";
  const stil = { background: "var(--surface-raised)", border: "1px solid var(--border-default)" };
  return (
    <form onSubmit={kaydet} className="rounded-2xl p-4 lg:p-6" style={{ background: "var(--surface-sunken)" }}>
      <AltBaslik>Notların</AltBaslik>
      <p className="text-[12px] lg:text-[14px] mb-3" style={{ color: "var(--text-tertiary)" }}>
        Sınav sonucu açıklanınca buraya gir; finalde kaç alman gerektiği hesaplanır.
      </p>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 lg:gap-4 max-w-md">
        <input value={v} onChange={(e) => setV(e.target.value)} type="number" min="0" max="100" placeholder="Vize" className={alan} style={stil} aria-label="Vize notu" />
        <input value={f} onChange={(e) => setF(e.target.value)} type="number" min="0" max="100" placeholder="Final" className={alan} style={stil} aria-label="Final notu" />
        <button type="submit" disabled={v === "" && f === ""} className="cp-btn cp-btn-primary min-h-11 disabled:opacity-40"><Save size={14} />Kaydet</button>
      </div>
      {durum && <p className="text-[11px] lg:text-[13px] mt-2" style={{ color: "var(--text-tertiary)" }}>{durum}</p>}
    </form>
  );
}
