// Ders paneli (Plan v3, Faz D) — saf hesaplar.
//
// Okul sekmesinde aynı bilgi üç yerde duruyordu (günün önerileri, ders durumu
// çubukları, bütün konular). Şimdi tek "Dersler" bölümü: her ders bir satır,
// basınca ders sayfası. Eşik hesabı study-plan.ts'teki `dersDurumlari`'nın
// aynısı — panel ile `npm run plan` farklı rakam söylemesin diye yeniden
// yazılmadı, yalnız sunuma uygun hâle getiriliyor.

import type { PlanSatiri } from "./haftalik-plan-kayit";
import { ADIMLAR, ilerlemeKatsayisi, isaretliAdimlar, type Adim } from "./ilerleme";
import { dersDurumlari, ESIK_SORU, type StudyUnit, type UnitProgress } from "./study-plan";

export interface DersOzeti {
  kod: string;
  /** Sınav dilimindeki (vize/final) kapsama, soru cinsinden. */
  kapsanan: number;
  toplam: number;
  esikte: boolean;
  esige_kalan: number;
  kalan_dakika: number;
  /** Sınav diliminde henüz bitmemiş konu sayısı (öğrenciye süre yerine bu gösterilir). */
  kalan_konu: number;
  /** Dilimin kaçta kaçı karşılanıyor (0-100). */
  yuzde: number;
  /** Eşiğin çubuktaki yeri (0-100): toplam 20 soruysa 60. */
  esikYeri: number;
  konular: { vize: StudyUnit[]; final: StudyUnit[] };
  /** Bu haftanın planında bu dersten geçen konular. */
  buHafta: string[];
  buHaftaBiten: number;
}

/**
 * Konu "bitti" mi: Hakimim denmiş ya da çalışma adımlarının (Oku, İzle,
 * Soru) hepsi işaretli. "Bu hafta 2 konu planlı, 1'i bitti" için.
 */
export function konuBitti(kayit: UnitProgress | undefined, mevcut: Adim[] = ADIMLAR): boolean {
  if (!kayit) return false;
  if (ilerlemeKatsayisi(kayit, mevcut) >= 1) return true;
  const calisma = mevcut.filter((a) => a !== "hakim");
  const isaretli = isaretliAdimlar(kayit, mevcut);
  return calisma.length > 0 && calisma.every((a) => isaretli.includes(a));
}

/** Konular kitaptaki sırayla; numarası olmayan sona. */
export function konuSirasi(a: StudyUnit, b: StudyUnit): number {
  return (a.konu_no ?? 999) - (b.konu_no ?? 999) || a.baslik.localeCompare(b.baslik, "tr");
}

/**
 * Derslerin özeti, en çok eksiği olan üstte (eşiğe en uzak ders önce, aynı
 * uzaklıkta kalan işi çok olan). `ilerleme` kayıtlarına konunun var olan
 * adımları burada eklenir; kayıtta yoksa dört adım varsayılırdı.
 */
export function dersOzetleri(args: {
  kodlar: string[];
  units: StudyUnit[];
  ilerleme: Map<string, UnitProgress>;
  adimHaritasi: Map<string, Adim[]>;
  haftaSatirlari: PlanSatiri[];
  dilim?: "vize" | "final";
}): DersOzeti[] {
  const { kodlar, units, adimHaritasi, haftaSatirlari } = args;
  const dilim = args.dilim ?? "vize";
  const ilerleme = new Map<string, UnitProgress>();
  for (const [id, k] of Array.from(args.ilerleme.entries())) ilerleme.set(id, { ...k, mevcut: adimHaritasi.get(id) ?? ADIMLAR });

  const konular = units.filter((u) => u.tip === "konu");
  const durum = new Map(dersDurumlari(konular.filter((u) => u.dilim === dilim), ilerleme).map((d) => [d.ders_kodu, d]));

  const ozetler = kodlar.map((kod): DersOzeti => {
    const d = durum.get(kod);
    const dersinKonulari = konular.filter((u) => u.ders_kodu === kod).sort(konuSirasi);
    const buHafta = Array.from(new Set(haftaSatirlari
      .filter((s) => s.ders_kodu === kod && s.tur === "konu")
      .flatMap((s) => s.parcalar.map((p) => p.unit_id))));
    const toplam = d?.toplam ?? 0;
    return {
      kod,
      kapsanan: d?.kapsanan ?? 0,
      toplam,
      esikte: d?.esikte ?? false,
      esige_kalan: d?.esige_kalan ?? ESIK_SORU,
      kalan_dakika: d?.kalan_dakika ?? 0,
      kalan_konu: dersinKonulari.filter((u) => u.dilim === dilim && ilerlemeKatsayisi(ilerleme.get(u.id), adimHaritasi.get(u.id) ?? ADIMLAR) < 1).length,
      yuzde: toplam > 0 ? Math.round(((d?.kapsanan ?? 0) / toplam) * 100) : 0,
      esikYeri: toplam > 0 ? Math.min(100, Math.round((ESIK_SORU / toplam) * 100)) : 60,
      konular: {
        vize: dersinKonulari.filter((u) => u.dilim === "vize"),
        final: dersinKonulari.filter((u) => u.dilim !== "vize"),
      },
      buHafta,
      buHaftaBiten: buHafta.filter((id) => konuBitti(ilerleme.get(id), adimHaritasi.get(id) ?? ADIMLAR)).length,
    };
  });
  return ozetler.sort((a, b) => b.esige_kalan - a.esige_kalan || b.kalan_dakika - a.kalan_dakika);
}

/** "3,3 soru", "4 soru": konu değerleri kesirli (40 soruyu konu sayısına bölünce). */
export function soruSayisi(n: number): string {
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} soru`;
}

/** "5,9 sa" ya da "45 dk". */
export function sureYazi(dakika: number): string {
  return dakika < 60 ? `${Math.round(dakika)} dk` : `${(dakika / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sa`;
}

// ── Durum tablosu (11 Kasım) ─────────────────────────────────────
//
// Berat: "hangi konulara çalışmadığımı bilmek benim hakkım". Plan kurtarmada
// yalnız 12 doğruya yetecek konuları alıyor; bu tablo sınav dilimindeki her
// konuyu gösterir: bitti, plana alındı, başladın ama planda yok, hiç
// dokunulmadı. Vize ya da final, hangisi sıradaysa.

export type KonuHali = "bitti" | "planda" | "basladin" | "dokunulmadi";
export const KONU_HALI_SIRASI: KonuHali[] = ["bitti", "planda", "basladin", "dokunulmadi"];

export interface DurumKonusu {
  id: string;
  baslik: string;
  konu_no: number | null;
  /** Konunun sınavda getirdiği tahmini soru. */
  soru: number;
  hal: KonuHali;
  /** Plana alındıysa ilk geldiği gün. */
  planTarihi?: string;
}

export interface DersDurumu {
  kod: string;
  toplam: number;
  kapsanan: number;
  esikte: boolean;
  esige_kalan: number;
  /** Eşiğin çubuktaki yeri (0-100). */
  esikYeri: number;
  /** Bitti + planda konular eşiği karşılıyor mu (plan bitince eşikte olur musun). */
  planlaEsikte: boolean;
  konular: DurumKonusu[];
  sayac: Record<KonuHali, number>;
}

/**
 * Derslerin sınav dilimindeki konu konu durumu. `planTarihleri`: bugünden
 * sonraki plan satırlarındaki konu → ilk tarih. Konular hal sırasıyla
 * (önce bitenler), aynı halde kitap sırasıyla.
 */
export function durumTablosu(args: {
  kodlar: string[];
  units: StudyUnit[];
  ilerleme: Map<string, UnitProgress>;
  adimHaritasi: Map<string, Adim[]>;
  planTarihleri: Map<string, string>;
  dilim: "vize" | "final";
}): DersDurumu[] {
  const { kodlar, units, adimHaritasi, planTarihleri, dilim } = args;
  const ilerleme = new Map<string, UnitProgress>();
  for (const [id, k] of Array.from(args.ilerleme.entries())) ilerleme.set(id, { ...k, mevcut: adimHaritasi.get(id) ?? ADIMLAR });
  const kapsam = units.filter((u) => u.tip === "konu" && u.dilim === dilim);
  const durum = new Map(dersDurumlari(kapsam, ilerleme).map((d) => [d.ders_kodu, d]));

  return kodlar.filter((kod) => kapsam.some((u) => u.ders_kodu === kod)).map((kod) => {
    const konular = kapsam.filter((u) => u.ders_kodu === kod).map((u): DurumKonusu => {
      const kayit = ilerleme.get(u.id);
      const mevcut = adimHaritasi.get(u.id) ?? ADIMLAR;
      const hal: KonuHali = konuBitti(kayit, mevcut) ? "bitti"
        : planTarihleri.has(u.id) ? "planda"
        : ilerlemeKatsayisi(kayit, mevcut) > 0 ? "basladin"
        : "dokunulmadi";
      return { id: u.id, baslik: u.baslik, konu_no: u.konu_no, soru: u.soru_degeri, hal, planTarihi: planTarihleri.get(u.id) };
    }).sort((a, b) => KONU_HALI_SIRASI.indexOf(a.hal) - KONU_HALI_SIRASI.indexOf(b.hal) || (a.konu_no ?? 999) - (b.konu_no ?? 999));
    const d = durum.get(kod);
    const toplam = d?.toplam ?? 0;
    const sayac = { bitti: 0, planda: 0, basladin: 0, dokunulmadi: 0 } as Record<KonuHali, number>;
    for (const k of konular) sayac[k.hal]++;
    const planla = konular.filter((k) => k.hal === "bitti" || k.hal === "planda").reduce((n, k) => n + k.soru, 0);
    return {
      kod, toplam,
      kapsanan: d?.kapsanan ?? 0,
      esikte: d?.esikte ?? false,
      esige_kalan: d?.esige_kalan ?? ESIK_SORU,
      esikYeri: toplam > 0 ? Math.min(100, Math.round((ESIK_SORU / toplam) * 100)) : 60,
      planlaEsikte: planla >= ESIK_SORU - 0.01,
      konular, sayac,
    };
  });
}

/** Bugünden sonraki plan satırlarından konu → ilk planlandığı gün. */
export function planTarihleri(satirlar: PlanSatiri[], bugun: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of [...satirlar].sort((a, b) => a.tarih.localeCompare(b.tarih))) {
    if (s.tur !== "konu" || s.tarih < bugun) continue;
    for (const p of s.parcalar) if (!m.has(p.unit_id)) m.set(p.unit_id, s.tarih);
  }
  return m;
}
