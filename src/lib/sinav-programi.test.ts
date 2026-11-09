import { describe, expect, it } from "vitest";
import { girisBelgesiCoz, oturumGruplari } from "./sinav-programi";

describe("sınav programı (Faz H)", () => {
  it("gün ve oturuma göre gruplar, sıralar", () => {
    const g = oturumGruplari([
      { dilim: "vize", ders_kodu: "C", tarih: "2026-11-15", oturum: 1 },
      { dilim: "vize", ders_kodu: "A", tarih: "2026-11-14", oturum: 2 },
      { dilim: "vize", ders_kodu: "B", tarih: "2026-11-14", oturum: 1 },
      { dilim: "vize", ders_kodu: "D", tarih: "2026-11-14", oturum: 2 },
    ]);
    expect(g).toEqual([
      ["2026-11-14", [[1, ["B"]], [2, ["A", "D"]]]],
      ["2026-11-15", [[1, ["C"]]]],
    ]);
  });
});

// Giriş belgesinin pdf.js metni (biçim gerçek belgeden; kimlik bilgisi uydurma).
const BELGE = `SINAVA GİRİŞ BELGESİ
KİMLİK BİLGİLERİ
T.C. Kimlik No:   00000000000
Adı Soyadı:   Deneme ÖĞRENCİ
CUMARTESİ ÖĞLE OTURUMU
Sınav Merkezi
KONYA
Bu Oturumda Sınava Girilecek Dersler
1. (AAUF1107) Elektronik Ticarete Giriş Salon Adı   ZEMİN KAT
Sınav Tarihi   Sınav Saati   Sınav Süresi
14.11.2026   13:30   30 dk.
CUMARTESİ SABAH OTURUMU
Bu Oturumda Sınava Girilecek Dersler
1. (ATDİ107) Türk Dili I
2. (AATA107) Atatürk İlkeleri Ve İnkılap Tarihi I Salon Adı   ZEMİN KAT
Sınav Tarihi   Sınav Saati   Sınav Süresi
14.11.2026   09:30   60 dk.
PAZAR SABAH OTURUMU
Bu Oturumda Sınava Girilecek Dersler
1. (AAUF1105) Matematik I
2. (AAUF9999) Başka Ders Salon Adı   ZEMİN KAT
Sınav Tarihi   Sınav Saati
15.11.2026   09:30   60 dk.
ÖNEMLİ UYARILAR
1. (AAUF0000) uyarı metnindeki kod sayılmaz 16.11.2026`;

describe("giriş belgesi", () => {
  const sonuc = girisBelgesiCoz(BELGE, ["ATDİ107", "AATA107", "AAUF1107", "AAUF1105"]);

  it("dersleri gün ve oturumuyla çıkarır; aynı günün oturumları saate göre numaralanır", () => {
    expect(sonuc.satirlar).toEqual([
      { ders_kodu: "AAUF1107", tarih: "2026-11-14", oturum: 2 },
      { ders_kodu: "ATDİ107", tarih: "2026-11-14", oturum: 1 },
      { ders_kodu: "AATA107", tarih: "2026-11-14", oturum: 1 },
      { ders_kodu: "AAUF1105", tarih: "2026-11-15", oturum: 1 },
    ]);
  });

  it("listede olmayan kodu ayrıca bildirir, uyarı metnine bakmaz", () => {
    expect(sonuc.bilinmeyen).toEqual(["AAUF9999"]);
  });

  it("oturum yoksa boş döner", () => {
    expect(girisBelgesiCoz("Başka bir PDF", ["ATDİ107"])).toEqual({ satirlar: [], bilinmeyen: [] });
  });
});
