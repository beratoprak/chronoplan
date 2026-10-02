import { describe, expect, it } from "vitest";
import { haftalikPlanKur, hedefHafta, type PlanGirdisi } from "./haftalik-plan";
import type { StudyUnit, UnitProgress } from "./study-plan";
import gercekBirimler from "./__fixtures__/ybs-units.json";

const u = (id: string, ders: string, no: number, dakika: number, soru = 5): StudyUnit => ({
  id, ders_kodu: ders, baslik: `${ders}-${no}`, tip: "konu", dilim: "vize", katman: "cekirdek",
  tahmini_dakika: dakika, soru_degeri: soru, konu_no: no,
});
const bos = new Map<string, UnitProgress>();
const temel = (units: StudyUnit[], ek: Partial<PlanGirdisi> = {}): PlanGirdisi => ({
  units, ilerleme: bos, sinavTarihi: "2026-11-14", dilim: "vize",
  baslangic: "2026-10-05", bitis: "2026-10-11", ...ek,
});

describe("haftalık planlayıcı — kurallar", () => {
  const dort = ["A", "B", "C", "D"].flatMap((d) => [u(`${d}1`, d, 1, 60), u(`${d}2`, d, 2, 60), u(`${d}3`, d, 3, 60)]);

  it("her gün iki farklı ders, her biri ~30 dk (kırıntı birleşirse en fazla 39)", () => {
    const p = haftalikPlanKur(temel(dort));
    expect(p.gunler).toHaveLength(7);
    for (const g of p.gunler) {
      expect(g.tur).toBe("calisma");
      expect(g.dersler).toHaveLength(2);
      expect(new Set(g.dersler.map((d) => d.ders_kodu)).size).toBe(2);
      for (const d of g.dersler) expect(d.dakika).toBeLessThanOrEqual(39);
    }
  });

  it("aynı ders üst üste iki gün gelmez (başka ders varken)", () => {
    const p = haftalikPlanKur(temel(dort));
    for (let i = 1; i < p.gunler.length; i++) {
      const dun = new Set(p.gunler[i - 1].dersler.map((d) => d.ders_kodu));
      for (const d of p.gunler[i].dersler) expect(dun.has(d.ders_kodu)).toBe(false);
    }
  });

  it("konular dersin kendi sırasıyla gelir ve uzun konu bölünür", () => {
    const p = haftalikPlanKur(temel([u("M1", "M", 1, 75), u("M2", "M", 2, 60), u("T1", "T", 1, 30)]));
    const mParcalari = p.gunler.flatMap((g) => g.dersler.filter((d) => d.ders_kodu === "M").flatMap((d) => d.parcalar));
    expect(mParcalari[0]).toMatchObject({ unit_id: "M1", dakika: 30, devam: false, bitiyor: false });
    expect(mParcalari[1]).toMatchObject({ unit_id: "M1", dakika: 30, devam: true, bitiyor: false });
    expect(mParcalari[2]).toMatchObject({ unit_id: "M1", dakika: 15, devam: true, bitiyor: true });
    expect(mParcalari[3].unit_id).toBe("M2");
  });

  it("hakim olunan konu plana girmez", () => {
    const ilerleme = new Map<string, UnitProgress>([["A1", { unit_id: "A1", durum: "hakim", gercek_dakika: 0 }]]);
    const p = haftalikPlanKur(temel(dort, { ilerleme }));
    const hepsi = p.gunler.flatMap((g) => g.dersler.flatMap((d) => d.parcalar.map((x) => x.unit_id)));
    expect(hepsi).not.toContain("A1");
  });

  it("eşikteki ders, eşik altındaki derslerin önüne geçmez", () => {
    // A eşikte (12+ soru hakim), B ve C değil.
    const units = [u("A1", "A", 1, 60, 13), u("A2", "A", 2, 60, 7), u("B1", "B", 1, 60, 10), u("B2", "B", 2, 60, 10), u("C1", "C", 1, 60, 10), u("C2", "C", 2, 60, 10)];
    const ilerleme = new Map<string, UnitProgress>([["A1", { unit_id: "A1", durum: "hakim", gercek_dakika: 0 }]]);
    const p = haftalikPlanKur(temel(units, { ilerleme, baslangic: "2026-10-05", bitis: "2026-10-05" }));
    expect(p.gunler[0].dersler.map((d) => d.ders_kodu).sort()).toEqual(["B", "C"]);
  });

  it("sınavdan önceki son 4 gün yalnız tekrar, sınav günleri boş", () => {
    const p = haftalikPlanKur(temel(dort, { baslangic: "2026-11-09", bitis: "2026-11-15" }));
    const turler = Object.fromEntries(p.gunler.map((g) => [g.tarih, g.tur]));
    expect(turler["2026-11-09"]).toBe("calisma");
    for (const t of ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]) expect(turler[t]).toBe("tekrar");
    expect(turler["2026-11-14"]).toBe("sinav");
    expect(turler["2026-11-15"]).toBe("sinav");
    const tekrarGunu = p.gunler.find((g) => g.tarih === "2026-11-10")!;
    expect(tekrarGunu.dersler.every((d) => d.tur === "tekrar")).toBe(true);
  });

  it("kapasite yetmezse uyarı verir", () => {
    const cok = Array.from({ length: 9 }, (_, i) => [1, 2, 3, 4, 5].map((n) => u(`D${i}-${n}`, `D${i}`, n, 120, 4))).flat();
    const p = haftalikPlanKur(temel(cok, { baslangic: "2026-11-01", bitis: "2026-11-07" }));
    expect(p.uyarilar.length).toBeGreaterThan(0);
    expect(p.esik_icin_gereken_dk).toBeGreaterThan(p.sinava_kadar_kapasite_dk);
  });
});

describe("haftalık planlayıcı — gerçek 9 ders", () => {
  const units = gercekBirimler as StudyUnit[];

  it("2 Ekim'den sınava kadar bütün günler dolu, 9 dersin hepsi plana giriyor", () => {
    const p = haftalikPlanKur({ units, ilerleme: bos, sinavTarihi: "2026-11-14", dilim: "vize", baslangic: "2026-10-05", bitis: "2026-11-13" });
    const calisma = p.gunler.filter((g) => g.tur === "calisma");
    expect(calisma.length).toBe(36);
    const dersler = new Set(calisma.flatMap((g) => g.dersler.map((d) => d.ders_kodu)));
    expect(dersler.size).toBe(9);
    // İlk hafta dokuz dersin hepsi en az bir kez geliyor.
    const ilkHafta = new Set(calisma.slice(0, 7).flatMap((g) => g.dersler.map((d) => d.ders_kodu)));
    expect(ilkHafta.size).toBe(9);
    // 10 dakikadan kısa kırıntı parça yok.
    for (const g of calisma) for (const d of g.dersler) for (const x of d.parcalar) expect(x.dakika).toBeGreaterThanOrEqual(10);
    // Eşik işi kapasiteye sığıyor, tamamı sığmıyor — 2 Ekim'deki gerçek durum.
    expect(p.esik_icin_gereken_dk).toBeLessThanOrEqual(p.sinava_kadar_kapasite_dk);
  });
});

describe("hedef hafta", () => {
  it("hafta içinde bugünden pazara", () => {
    expect(hedefHafta(new Date(2026, 9, 7, 10))).toEqual({ hafta: "2026-10-05", baslangic: "2026-10-07", bitis: "2026-10-11" });
  });
  it("pazar 21:00'den önce bu hafta", () => {
    expect(hedefHafta(new Date(2026, 9, 11, 20, 59)).hafta).toBe("2026-10-05");
  });
  it("pazar 21:00'den sonra gelecek hafta", () => {
    expect(hedefHafta(new Date(2026, 9, 11, 21, 0))).toEqual({ hafta: "2026-10-12", baslangic: "2026-10-12", bitis: "2026-10-18" });
  });
});
