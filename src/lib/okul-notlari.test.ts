import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase", () => ({ supabase: {} }));
import {
  agacKur, altKlasorler, klasorYolu, oncesineSira, otomatikKlasor, sonrakiSira, tasinabilirMi, yoldanDers,
  type OkulKlasor, type OkulNot,
} from "./okul-notlari";

const k = (id: string, ust: string | null, ek: Partial<OkulKlasor> = {}): OkulKlasor =>
  ({ id, ust_id: ust, ad: id, sira: 1, ders_kodu: null, unit_id: null, kok: null, ...ek });
const n = (id: string, klasor: string | null, ek: Partial<OkulNot> = {}): OkulNot =>
  ({ id, klasor_id: klasor, baslik: id, icerik: "", tur: "serbest", kaynak: null, ders_kodu: null, unit_id: null, sira: 1, olusturma: "2026-10-01", guncelleme: "2026-10-01", ...ek });

describe("otomatikKlasor", () => {
  const baglam = { dersKodu: "İŞL101", dersAdi: "İşletme", unitId: "u1", konuAdi: "Giriş", konuSira: 1 };
  it("boş ağaçta Kök → Ders → Konu kurar", () => {
    const { klasorId, yeniler } = otomatikKlasor([], "pdf", baglam);
    expect(yeniler.map((y) => y.ad)).toEqual(["PDF notlarım", "İşletme", "1. Giriş"]);
    expect(yeniler[1].ust_id).toBe(yeniler[0].id);
    expect(yeniler[2].ust_id).toBe(yeniler[1].id);
    expect(klasorId).toBe(yeniler[2].id);
  });
  it("taşınmış ve yeniden adlandırılmış klasörü kimliğiyle bulur, yeniden kurmaz", () => {
    const { yeniler } = otomatikKlasor([], "pdf", baglam);
    const tasindi = yeniler.map((y, i) => (i === 2 ? { ...y, ad: "Benim adım", ust_id: "baska" } : y));
    const ikinci = otomatikKlasor(tasindi, "pdf", baglam);
    expect(ikinci.yeniler).toEqual([]);
    expect(ikinci.klasorId).toBe(yeniler[2].id);
  });
  it("PDF ve ders kökleri birbirine karışmaz", () => {
    const { yeniler } = otomatikKlasor([], "pdf", baglam);
    const ders = otomatikKlasor(yeniler, "ders", baglam);
    expect(ders.yeniler.map((y) => y.ad)).toEqual(["Ders notlarım", "İşletme", "1. Giriş"]);
  });
  it("bağlamsız not kök klasöre düşer", () => {
    const { klasorId, yeniler } = otomatikKlasor([], "ders", null);
    expect(yeniler).toHaveLength(1);
    expect(klasorId).toBe(yeniler[0].id);
  });
});

describe("taşıma ve sıra", () => {
  const ks = [k("a", null), k("b", "a"), k("c", "b"), k("d", null)];
  it("klasör kendi altına taşınamaz", () => {
    expect(tasinabilirMi("a", "c", ks)).toBe(false);
    expect(tasinabilirMi("a", "a", ks)).toBe(false);
    expect(tasinabilirMi("b", "d", ks)).toBe(true);
    expect(tasinabilirMi("c", null, ks)).toBe(true);
  });
  it("alt klasörler ve yol", () => {
    expect(Array.from(altKlasorler("a", ks)).sort()).toEqual(["a", "b", "c"]);
    expect(klasorYolu("c", ks).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("öne bırakma sırası iki komşunun arasında", () => {
    const kardes = [{ id: "x", sira: 1 }, { id: "y", sira: 2 }, { id: "z", sira: 3 }];
    expect(oncesineSira(kardes, "z")).toBe(2.5);
    expect(oncesineSira(kardes, "x")).toBeLessThan(1);
    expect(sonrakiSira(kardes)).toBe(4);
  });
});

describe("agacKur", () => {
  it("klasörleri iç içe kurar, toplamı sayar, kayıp üstü köke alır", () => {
    const ks = [k("a", null, { sira: 2 }), k("b", "a"), k("yetim", "yok", { sira: 1 })];
    const ns = [n("1", "b"), n("2", "a"), n("3", null), n("4", "silinmis")];
    const { kokler, kokNotlari } = agacKur(ks, ns);
    expect(kokler.map((d) => d.klasor.id)).toEqual(["yetim", "a"]);
    expect(kokler[1].toplam).toBe(2);
    expect(kokler[1].altlar[0].notlar.map((x) => x.id)).toEqual(["1"]);
    expect(kokNotlari.map((x) => x.id)).toEqual(["3", "4"]);
  });
  it("döngülü veride sonsuza girmez", () => {
    const { kokler } = agacKur([k("a", "b"), k("b", "a"), k("c", null)], []);
    expect(kokler.map((d) => d.klasor.id)).toEqual(["c"]);
  });
});

it("depo yolundan dersi bulur", () => {
  expect(yoldanDers("ISL101/55.pdf", ["İŞL101", "MAT101"])).toBe("İŞL101");
  expect(yoldanDers("XYZ/1.pdf", ["İŞL101"])).toBeNull();
});
