import { describe, expect, it } from "vitest";
import { degerlendir, sinavaKadarTekrar, yeniKart, zamaniGelenler, type KartDurumu } from "./spaced-repetition";

const AN = "2026-09-19T09:00:00.000Z";
const gunSonra = (baslangic: string, gun: number) => new Date(new Date(baslangic).getTime() + gun * 86_400_000).toISOString();

describe("yeni kart", () => {
  it("hemen gösterilmeye hazır başlar", () => {
    const k = yeniKart(AN);
    expect(k.dueAt).toBe(AN);
    expect(k.reps).toBe(0);
    expect(k.ease).toBe(2.5);
  });
});

describe("değerlendirme", () => {
  it("ilk 'iyi' kartı yarına atar", () => {
    const k = degerlendir(yeniKart(AN), "iyi", AN);
    expect(k.interval).toBe(1);
    expect(k.reps).toBe(1);
    expect(k.dueAt).toBe(gunSonra(AN, 1));
  });

  it("ilk 'kolay' daha uzun aralık verir", () => {
    expect(degerlendir(yeniKart(AN), "kolay", AN).interval).toBe(3);
  });

  it("aralık tekrar ettikçe açılır", () => {
    let k = degerlendir(yeniKart(AN), "iyi", AN);
    k = degerlendir(k, "iyi", k.dueAt);
    expect(k.interval).toBeGreaterThan(1);
    expect(k.reps).toBe(2);
  });

  it("'tekrar' aralığı sıfırlar ve unutma sayar", () => {
    let k = degerlendir(yeniKart(AN), "iyi", AN);
    k = degerlendir(k, "tekrar", k.dueAt);
    expect(k.interval).toBe(0);
    expect(k.reps).toBe(0);
    expect(k.lapses).toBe(1);
  });

  it("kolaylık katsayısı alt sınırın altına inmez", () => {
    let k: KartDurumu = yeniKart(AN);
    for (let i = 0; i < 20; i++) k = degerlendir(k, "tekrar", AN);
    expect(k.ease).toBeGreaterThanOrEqual(1.3);
  });

  it("tek kötü değerlendirme katsayıyı dibe vurdurmaz", () => {
    const k = degerlendir(yeniKart(AN), "tekrar", AN);
    expect(k.ease).toBeCloseTo(2.3, 2);
  });

  it("'zor' aralığı açar ama 'iyi'den daha az", () => {
    const temel = degerlendir(degerlendir(yeniKart(AN), "iyi", AN), "iyi", gunSonra(AN, 1));
    const zor = degerlendir(degerlendir(yeniKart(AN), "iyi", AN), "zor", gunSonra(AN, 1));
    expect(zor.interval).toBeLessThan(temel.interval);
    expect(zor.interval).toBeGreaterThanOrEqual(1);
  });
});

describe("sıra", () => {
  it("zamanı gelmemiş kart listeye girmez", () => {
    const kartlar = [
      { id: "a", dueAt: gunSonra(AN, -1) },
      { id: "b", dueAt: gunSonra(AN, 2) },
    ];
    expect(zamaniGelenler(kartlar, AN).map((k) => k.id)).toEqual(["a"]);
  });

  it("en çok geciken önce gelir", () => {
    const kartlar = [
      { id: "yeni", dueAt: gunSonra(AN, -1) },
      { id: "eski", dueAt: gunSonra(AN, -5) },
    ];
    expect(zamaniGelenler(kartlar, AN).map((k) => k.id)).toEqual(["eski", "yeni"]);
  });

  it("tam zamanı gelen kart dahil edilir", () => {
    expect(zamaniGelenler([{ dueAt: AN }], AN)).toHaveLength(1);
  });
});

describe("sınava kadar tekrar sayısı", () => {
  it("uzun sürede birden çok tekrar öngörür", () => {
    expect(sinavaKadarTekrar(yeniKart(AN), gunSonra(AN, 56), AN)).toBeGreaterThan(3);
  });

  it("sınav geçmişse sıfır döner", () => {
    expect(sinavaKadarTekrar(yeniKart(AN), gunSonra(AN, -1), AN)).toBe(0);
  });
});
