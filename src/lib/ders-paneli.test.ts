import { describe, expect, it } from "vitest";
import { dersOzetleri, konuBitti, soruSayisi, sureYazi } from "./ders-paneli";
import type { PlanSatiri } from "./haftalik-plan-kayit";
import type { StudyUnit, UnitProgress } from "./study-plan";

const konu = (id: string, ders_kodu: string, konu_no: number, dilim: "vize" | "final", soru_degeri = 4): StudyUnit =>
  ({ id, ders_kodu, baslik: `${konu_no}-${id}`, tip: "konu", dilim, katman: "cekirdek", tahmini_dakika: 60, soru_degeri, konu_no });
const kayit = (unit_id: string, adimlar: UnitProgress["adimlar"]): UnitProgress =>
  ({ unit_id, durum: "calisildi", gercek_dakika: 0, adimlar });
const satir = (ders_kodu: string, unitIds: string[]): PlanSatiri => ({
  id: `${ders_kodu}-${unitIds[0]}`, user_id: "u", hafta: "2026-W40", tarih: "2026-10-03", gun_turu: "calisma", sira: 1,
  ders_kodu, tur: "konu", dakika: 30, olusturma: "",
  parcalar: unitIds.map((unit_id) => ({ unit_id, baslik: unit_id, dakika: 30, devam: false, bitiyor: true })),
});

describe("konu bitti mi", () => {
  it("çalışma adımlarının hepsi ya da Hakimim", () => {
    const mevcut = ["oku", "izle", "hakim"] as const;
    expect(konuBitti(kayit("a", { oku: "x" }), [...mevcut])).toBe(false);
    expect(konuBitti(kayit("a", { oku: "x", izle: "x" }), [...mevcut])).toBe(true);
    expect(konuBitti(kayit("a", { hakim: "x" }), [...mevcut])).toBe(true);
    expect(konuBitti(undefined)).toBe(false);
  });
});

describe("ders özetleri", () => {
  // İki ders, her biri vizede 5 konu × 4 soru = 20 soru.
  const units = [
    ...[1, 2, 3, 4, 5].map((n) => konu(`m${n}`, "MAT", n, "vize")),
    konu("m6", "MAT", 6, "final"),
    ...[1, 2, 3, 4, 5].map((n) => konu(`t${n}`, "TD", n, "vize")),
  ];
  const ilerleme = new Map<string, UnitProgress>([
    ["t1", kayit("t1", { hakim: "x" })], ["t2", kayit("t2", { hakim: "x" })], ["t3", kayit("t3", { hakim: "x" })],
    ["m1", kayit("m1", { oku: "x", izle: "x", soru: "x" })],
  ]);
  const adimHaritasi = new Map(units.map((u) => [u.id, ["oku", "izle", "soru", "hakim"] as ("oku" | "izle" | "soru" | "hakim")[]]));
  const ozet = dersOzetleri({
    kodlar: ["TD", "MAT"], units, ilerleme, adimHaritasi,
    haftaSatirlari: [satir("MAT", ["m1"]), satir("MAT", ["m2"]), satir("TD", ["t4"])],
  });

  it("eşiğe en uzak ders üstte", () => {
    expect(ozet.map((o) => o.kod)).toEqual(["MAT", "TD"]);
  });

  it("eşik hesabı plan motoruyla aynı: 3 konu hakim = 12 soru = eşikte", () => {
    const td = ozet.find((o) => o.kod === "TD")!;
    expect(td).toMatchObject({ kapsanan: 12, toplam: 20, esikte: true, esige_kalan: 0, yuzde: 60, esikYeri: 60 });
  });

  it("vize ve final konuları ayrı, kitap sırasıyla", () => {
    const mat = ozet.find((o) => o.kod === "MAT")!;
    expect(mat.konular.vize.map((u) => u.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(mat.konular.final.map((u) => u.id)).toEqual(["m6"]);
    // m1'in üç çalışma adımı işaretli: %75 → 3 soru.
    expect(mat.kapsanan).toBe(3);
  });

  it("bu hafta planlanan konular ve biteni", () => {
    const mat = ozet.find((o) => o.kod === "MAT")!;
    expect(mat.buHafta).toEqual(["m1", "m2"]);
    expect(mat.buHaftaBiten).toBe(1);
  });
});

describe("yazı biçimleri", () => {
  it("soru ve süre", () => {
    expect(soruSayisi(3.333)).toBe("3,3 soru");
    expect(soruSayisi(4)).toBe("4 soru");
    expect(sureYazi(45)).toBe("45 dk");
    expect(sureYazi(354)).toBe("5,9 sa");
  });
});
