import { describe, expect, it } from "vitest";
import { eksikKonular, gunMateryali, soruSirasi, tekrarSorulari } from "./gun-sayfasi";
import type { QuestionAttempt, StudyModule, StudyQuestion } from "./school-data";
import type { UnitProgress } from "./study-plan";

const soru = (id: string, soru_no: number): StudyQuestion =>
  ({ id, ders_kodu: "AAUF1105", unit_id: "u1", soru_no, bolum_no: 1, govde: id, secenekler: [], dogru: "A" });
const deneme = (question_id: string, dogru_mu: boolean, cozuldu_at: string): QuestionAttempt =>
  ({ id: `${question_id}-${cozuldu_at}`, question_id, verilen: "A", dogru_mu, cozuldu_at });
const modul = (id: string, ad: string, tip = "resource"): StudyModule =>
  ({ id, unit_id: "u1", ad, tip, oys_url: `https://oys/${id}`, tahmini_dakika: 10, yerel_dosya: null });

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

describe("gün materyali", () => {
  it("kitap, ses, video sırasıyla; e-pub ve çıkmış soru dosyası düşer", () => {
    const sonuc = gunMateryali([
      modul("ybs:mod:9", "Video anlatım", "hvp"),
      modul("ybs:mod:3", "Bölüm Özeti Ses Metni (Podcast)"),
      modul("ybs:mod:5", "Sınavda Çıkmış Örnek Sorular"),
      modul("ybs:mod:7", "Kitap Bölümü (E-Pub)"),
      modul("ybs:mod:1", "Kitap Bölümü"),
    ]);
    expect(sonuc.map((m) => m.etiket)).toEqual(["Kitap", "Ses", "Video"]);
  });

  it("yalnız kitap bölümü uygulamada okunur", () => {
    const [kitap, ses] = gunMateryali([modul("ybs:mod:1", "Kitap Bölümü"), modul("ybs:mod:3", "Podcast")]);
    expect(kitap.cmid).toBe("1");
    expect(ses.cmid).toBeNull();
  });
});
