import { describe, expect, it } from "vitest";
import { eksikKonular, konuAdi, konuFoyu, soruSirasi, tekrarSorulari } from "./gun-sayfasi";
import type { QuestionAttempt, StudyModule, StudyQuestion } from "./school-data";
import type { UnitProgress } from "./study-plan";

const soru = (id: string, soru_no: number): StudyQuestion =>
  ({ id, ders_kodu: "AAUF1105", unit_id: "u1", soru_no, bolum_no: 1, govde: id, secenekler: [], dogru: "A" });
const deneme = (question_id: string, dogru_mu: boolean, cozuldu_at: string): QuestionAttempt =>
  ({ id: `${question_id}-${cozuldu_at}`, question_id, verilen: "A", dogru_mu, cozuldu_at });

describe("soru sırası", () => {
  const sorular = [soru("s1", 1), soru("s2", 2), soru("s3", 3), soru("s4", 4)];

  it("önce çözülmemiş, sonra yanlış, en son doğru", () => {
    const denemeler = [deneme("s1", true, "2026-10-01"), deneme("s2", false, "2026-10-01")];
    expect(soruSirasi(sorular, denemeler).map((s) => s.id)).toEqual(["s3", "s4", "s2", "s1"]);
  });

  it("sorunun son denemesi geçerli", () => {
    const denemeler = [deneme("s1", false, "2026-10-01"), deneme("s1", true, "2026-10-02")];
    expect(soruSirasi(sorular, denemeler).at(-1)?.id).toBe("s1");
  });

  it("tekrar gününde doğru bilinen soru gelmez", () => {
    const denemeler = [deneme("s1", true, "2026-10-01"), deneme("s2", false, "2026-10-01")];
    expect(tekrarSorulari(sorular, denemeler).map((s) => s.id)).toEqual(["s3", "s4", "s2"]);
  });
});

describe("tekrar günü konuları", () => {
  it("hakim olunan konu düşer", () => {
    const parca = (unit_id: string) => ({ unit_id, baslik: unit_id, dakika: 0, devam: false, bitiyor: false });
    const ilerleme = new Map<string, UnitProgress>([
      ["u1", { unit_id: "u1", durum: "hakim", gercek_dakika: 0 }],
      ["u2", { unit_id: "u2", durum: "calisildi", gercek_dakika: 0 }],
    ]);
    expect(eksikKonular([parca("u1"), parca("u2"), parca("u3")], ilerleme).map((p) => p.unit_id)).toEqual(["u2", "u3"]);
  });
});

// 2 Ekim'deki iki gerçek konu (OYS, 18 Eylül kazısı).
const m = (id: number, ad: string, tip: string, dk: number): StudyModule =>
  ({ id: `ybs:mod:${id}`, unit_id: "u", ad, tip, oys_url: `https://oys/${id}`, tahmini_dakika: dk, yerel_dosya: null });
const BIT_1 = [
  m(1, "#1 Öğrenme Hedefleri", "page", 3), m(2, "#1 Dersin Videosu", "hvp", 12),
  m(3, "#1 Bilgi Piramidi", "hvp", 12), m(4, "#1 Değerlendirme", "quiz", 15),
];
const BY_1 = [
  m(52167, "Video", "hvp", 12), m(52168, "Gözden Geçirelim", "hvp", 12), m(52169, "Kaynaklar", "page", 5),
  m(52166, "Kitap Bölümü", "resource", 35), m(74787, "Kitap Bölümü (E-Pub)", "resource", 0),
  m(74911, "Bölüm Özeti Ses Metni (Podcast)", "resource", 15),
];

describe("konu föyü", () => {
  it("PDF'siz konu bunu söyler, Oku adımı öğrenme hedeflerine bağlanır", () => {
    const f = konuFoyu({ moduller: BIT_1, soruSayisi: 0, kazanimSayisi: 3, mevcut: ["oku", "izle", "hakim"], butce: 30, bitiyor: false });
    expect(f.pdfVar).toBe(false);
    expect(f.aciklama).toMatch(/okunacak metni \(PDF\) yok/);
    expect(f.adimlar.map((a) => a.adim)).toEqual(["oku", "izle", null, "hakim"]);
    expect(f.adimlar[0].malzeme.map((x) => x.ad)).toEqual(["Öğrenme Hedefleri"]);
    expect(f.adimlar[1].metin).toContain('"Dersin Videosu", sonra "Bilgi Piramidi"');
    expect(f.adimlar[2].metin).toContain("Değerlendirme");
    // Bugün 30 dk: hedefler (3) + videolar (24); test sonraki güne kalır.
    expect(f.adimlar.map((a) => a.bugun)).toEqual([true, true, false, false]);
    expect(f.bugunDakika).toBe(27);
  });

  it("PDF'li konu: önce kitap, podcast isteğe bağlı, sonra video ve soru; e-pub ve kaynaklar adım değil", () => {
    const f = konuFoyu({ moduller: BY_1, soruSayisi: 1, kazanimSayisi: 0, mevcut: ["oku", "izle", "soru", "hakim"], butce: 30, bitiyor: false });
    expect(f.pdfVar).toBe(true);
    expect(f.aciklama).toBeNull();
    expect(f.adimlar.map((a) => a.adim)).toEqual(["oku", null, "izle", "soru", "hakim"]);
    expect(f.adimlar[0].malzeme[0]).toMatchObject({ tur: "kitap", cmid: "52166" });
    expect(f.malzeme.some((x) => /E-Pub/.test(x.ad))).toBe(false);
    expect(f.malzeme.find((x) => x.ad === "Kaynaklar")?.tur).toBe("diger");
    // 35 dk'lık okuma 30 dk'lık güne bölünmez: bugün yalnız okuma.
    expect(f.adimlar.map((a) => a.bugun)).toEqual([true, false, false, false, false]);
    expect(f.adimlar[4].metin).toMatch(/^Ana kavramları/);
  });

  it("işaretlenen adım geçilir; bugün kaldığın yerden başlar, isteğe bağlı podcast da geçilmiş sayılır", () => {
    const f = konuFoyu({
      moduller: BY_1, soruSayisi: 1, kazanimSayisi: 0, mevcut: ["oku", "izle", "soru", "hakim"],
      kayit: { adimlar: { oku: "2026-10-02", izle: "2026-10-03" } }, butce: 30, bitiyor: false,
    });
    expect(f.adimlar.map((a) => a.yapildi)).toEqual([true, true, true, false, false]);
    expect(f.adimlar.map((a) => a.bugun)).toEqual([false, false, false, true, true]);
  });

  it("kurtarma: çıkmış sorular ilk adım, okumanın şart olmadığı söylenir", () => {
    const f = konuFoyu({ moduller: BY_1, soruSayisi: 3, kazanimSayisi: 0, mevcut: ["oku", "izle", "soru", "hakim"], butce: 30, bitiyor: false, kurtarma: true });
    expect(f.adimlar.map((a) => a.adim)).toEqual(["soru", "oku", null, "izle", "hakim"]);
    expect(f.adimlar[0].metin).toMatch(/^Önce 3 çıkmış soruyu çöz/);
    expect(f.adimlar[0].bugun).toBe(true);
    expect(f.aciklama).toMatch(/^Kurtarma planı/);
  });

  it("kurtarma: çıkmış sorusu olmayan konuda OYS testi ilk adım (BİT)", () => {
    const f = konuFoyu({ moduller: BIT_1, soruSayisi: 0, kazanimSayisi: 3, mevcut: ["oku", "izle", "hakim"], butce: 30, bitiyor: false, kurtarma: true });
    expect(f.adimlar.map((a) => a.adim)).toEqual([null, "oku", "izle", "hakim"]);
    expect(f.adimlar[0].metin).toMatch(/^Önce kendini dene/);
    expect(f.aciklama).toMatch(/OYS'deki testi/);
  });

  it("kurtarma: ne sorusu ne testi olan konu değişmez", () => {
    const f = konuFoyu({ moduller: BIT_1.filter((x) => x.tip !== "quiz"), soruSayisi: 0, kazanimSayisi: 3, mevcut: ["oku", "izle", "hakim"], butce: 30, bitiyor: false, kurtarma: true });
    expect(f.adimlar.map((a) => a.adim)).toEqual(["oku", "izle", "hakim"]);
    expect(f.aciklama).not.toMatch(/Kurtarma/);
  });

  it("konuyu bitiren günde kalan her şey bugündür", () => {
    const f = konuFoyu({ moduller: BY_1, soruSayisi: 1, kazanimSayisi: 0, mevcut: ["oku", "izle", "soru", "hakim"], butce: 10, bitiyor: true });
    expect(f.adimlar.every((a) => a.bugun)).toBe(true);
  });

  it("İngilizce: okuma dosyaları yalnız OYS'de, bunu söyler", () => {
    const f = konuFoyu({
      moduller: [m(1, "Audio Files", "folder", 0), m(2, "Module 1: Student Book", "resource", 25), m(3, "Module 1: Work Book", "resource", 20)],
      soruSayisi: 0, kazanimSayisi: 0, mevcut: ["oku", "hakim"], butce: 30, bitiyor: false,
    });
    expect(f.aciklama).toMatch(/OYS'de açılır/);
    expect(f.adimlar[0]).toMatchObject({ adim: "oku" });
    expect(f.adimlar[0].malzeme.map((x) => x.tur)).toEqual(["dosya", "dosya"]);
  });

  it("konu adındaki numara ayıklanır", () => {
    expect(konuAdi("1-Temel Kavramlar")).toBe("Temel Kavramlar");
    expect(konuAdi("Bilgi ve İletişim Teknolojileri Giriş")).toBe("Bilgi ve İletişim Teknolojileri Giriş");
  });
});
