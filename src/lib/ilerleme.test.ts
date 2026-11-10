import { describe, expect, it } from "vitest";
import vakaDosyasi from "./__fixtures__/ilerleme-vakalari.json";
import { ADIM_TAVANI, durumuTuret, ilerlemeKatsayisi, mevcutAdimHaritasi, type Adim, type IlerlemeKaydi } from "./ilerleme";

type Vaka = { ad: string; kayit: IlerlemeKaydi | null; mevcut: Adim[]; katsayi: number; durum: string | null };
const { vakalar } = vakaDosyasi as { vakalar: Vaka[] };

// Motordaki ilerleme.js ile aynı vakalar — aynı sonucu vermeli.
describe("ilerleme modeli (motorla ortak vakalar)", () => {
  for (const v of vakalar) {
    it(v.ad, () => {
      expect(ilerlemeKatsayisi(v.kayit, v.mevcut)).toBe(v.katsayi);
      if (v.durum !== null) expect(durumuTuret(v.kayit?.adimlar ?? {})).toBe(v.durum);
    });
  }

  it("Oku ya da İzle konuyu bitirir; yalnız Soru tavanda kalır (11 Kasım)", () => {
    expect(ilerlemeKatsayisi({ adimlar: { oku: "x" } })).toBe(1);
    expect(ilerlemeKatsayisi({ adimlar: { izle: "x" } })).toBe(1);
    expect(ilerlemeKatsayisi({ adimlar: { soru: "x" } })).toBeLessThanOrEqual(ADIM_TAVANI);
  });

  it("videosu olmayan konuda İzle adımı düşer", () => {
    const h = mevcutAdimHaritasi([{ id: "u1" }, { id: "u2" }], [{ unit_id: "u1", tip: "hvp" }], [{ unit_id: "u2" }]);
    expect(h.get("u1")).toEqual(["oku", "izle", "hakim"]);
    expect(h.get("u2")).toEqual(["oku", "soru", "hakim"]);
  });
});
