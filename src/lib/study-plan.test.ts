import { describe, expect, it } from "vitest";
import {
  buildStudyPlan, dersDurumlari, ESIK_SORU, kalanGun, oner, projeksiyon,
  riskAltindakiDersler, tempo, type StudyUnit, type UnitProgress,
} from "./study-plan";

// YBS motorundaki plan.js testleriyle aynı durumlar; iki kopya birlikte korunuyor.
const u = (id: string, ders: string, dilim: "vize" | "final", soru: number, dakika: number): StudyUnit => ({
  id, ders_kodu: ders, baslik: id, tip: "konu", dilim, katman: "cekirdek",
  tahmini_dakika: dakika, soru_degeri: soru, konu_no: 1,
});
const ilerlemeden = (girdi: Record<string, UnitProgress["durum"]>) =>
  new Map(Object.entries(girdi).map(([k, durum]) => [k, { unit_id: k, durum, gercek_dakika: 0 }]));
const bos = new Map<string, UnitProgress>();

describe("ders durumları", () => {
  it("hiç çalışılmamışken hiçbir ders eşikte değildir", () => {
    const [d] = dersDurumlari([u("a", "X", "vize", 10, 60), u("b", "X", "vize", 10, 60)], bos);
    expect(d.kapsanan).toBe(0);
    expect(d.esige_kalan).toBe(ESIK_SORU);
    expect(d.esikte).toBe(false);
  });

  it("hakim olunan konular kapsamayı büyütür ve kalan süreyi sıfırlar", () => {
    const units = [u("a", "X", "vize", 10, 60), u("b", "X", "vize", 10, 60)];
    const [d] = dersDurumlari(units, ilerlemeden({ a: "hakim", b: "hakim" }));
    expect(d.kapsanan).toBe(20);
    expect(d.esikte).toBe(true);
    expect(d.kalan_dakika).toBe(0);
  });

  it("yalnız çalışıldı durumu eşiği tek başına geçirmez", () => {
    const units = [u("a", "X", "vize", 10, 60), u("b", "X", "vize", 10, 60)];
    const [d] = dersDurumlari(units, ilerlemeden({ a: "calisildi" }));
    expect(d.kapsanan).toBe(7);
    expect(d.esikte).toBe(false);
  });
});

describe("öneriler", () => {
  const units = [
    u("td1", "ATDI", "vize", 10, 79), u("td2", "ATDI", "vize", 10, 79),
    u("mat1", "MAT", "vize", 5, 60), u("mat2", "MAT", "vize", 5, 60),
    u("ikt1", "IKT", "vize", 5, 90),
  ];

  it("en verimli ders önce önerilir", () => {
    expect(oner(units, bos, 1)[0].ders_kodu).toBe("ATDI");
  });

  it("öneriler tek derse yığılmaz", () => {
    const o = oner(units, bos, 3);
    expect(new Set(o.map((x) => x.ders_kodu)).size).toBe(3);
  });

  it("eşiği geçen dersin konuları geriye düşer", () => {
    const doygun = oner(units, ilerlemeden({ td1: "hakim", td2: "hakim", mat1: "hakim", mat2: "hakim" }), 5);
    expect(doygun.map((x) => x.unit_id)).toEqual(["ikt1"]);
  });
});

describe("tempo ve projeksiyon", () => {
  it("pencere dışındaki oturumlar sayılmaz", () => {
    const o = [{ tarih: "2026-09-18T10:00:00Z", dakika: 70 }, { tarih: "2026-09-01T10:00:00Z", dakika: 600 }];
    expect(tempo(o, "2026-09-19T12:00:00Z", 7)).toEqual({ deger: 10, kaynak: "olcum" });
  });

  it("ölçüm yokken beyan edilen taban kapasite kullanılır", () => {
    expect(tempo([], "2026-09-19T12:00:00Z", 7, 52)).toEqual({ deger: 52, kaynak: "beyan" });
  });

  it("oturum varsa beyan devreye girmez", () => {
    const o = [{ tarih: "2026-09-18T10:00:00Z", dakika: 7 }];
    expect(tempo(o, "2026-09-19T12:00:00Z", 7, 52).kaynak).toBe("olcum");
  });

  it("üç hali ayırır", () => {
    expect(projeksiyon({ kalanDakika: 100, kalanGun: 10, tempoDakikaGun: 15 }).hal).toBe("yolunda");
    expect(projeksiyon({ kalanDakika: 100, kalanGun: 10, tempoDakikaGun: 8 }).hal).toBe("geriliyor");
    expect(projeksiyon({ kalanDakika: 100, kalanGun: 10, tempoDakikaGun: 5 }).hal).toBe("kritik");
  });

  it("iş bittiyse hal yolundadır", () => {
    expect(projeksiyon({ kalanDakika: 0, kalanGun: 1, tempoDakikaGun: 0 }).hal).toBe("yolunda");
  });

  it("geçmiş sınav tarihinde kalan gün negatife düşmez", () => {
    expect(kalanGun("2026-09-01", "2026-09-19")).toBe(0);
  });
});

describe("risk", () => {
  const units = [u("a", "UCUZ", "vize", 12, 60), u("b", "PAHALI", "vize", 12, 600)];

  it("bütçe yetmezse eşiğe en ucuz ulaşan ders kurtarılır", () => {
    const risk = riskAltindakiDersler(units, bos, { kalanGun: 1, tempoDakikaGun: 100 });
    expect(risk.map((x) => x.ders_kodu)).toEqual(["PAHALI"]);
  });

  it("bütçe bolsa risk listesi boşalır", () => {
    expect(riskAltindakiDersler(units, bos, { kalanGun: 10, tempoDakikaGun: 200 })).toEqual([]);
  });
});

describe("plan bütünü", () => {
  const units = [u("a", "X", "vize", 12, 600), u("b", "X", "final", 12, 600)];

  it("yalnız istenen dilimi hesaba katar", () => {
    const p = buildStudyPlan({ units, ilerleme: bos, oturumlar: [], sinavTarihi: "2026-11-14", simdi: "2026-09-19T00:00:00Z" });
    expect(p.kalan_dakika).toBe(600);
    expect(p.toplam_ders).toBe(1);
    expect(p.kalan_gun).toBe(56);
  });

  it("ölçüm yokken kaynağı beyan olarak işaretler", () => {
    const p = buildStudyPlan({ units, ilerleme: bos, oturumlar: [], sinavTarihi: "2026-11-14", simdi: "2026-09-19T00:00:00Z" });
    expect(p.tempo_kaynak).toBe("beyan");
    expect(p.hal).toBe("yolunda");
    expect(p.risk).toEqual([]);
  });

  it("yolunda değilken risk tablosu dolar", () => {
    const agir = Array.from({ length: 9 }, (_, i) => u(`k${i}`, `D${i}`, "vize", 12, 600));
    const p = buildStudyPlan({ units: agir, ilerleme: bos, oturumlar: [{ tarih: "2026-09-18T10:00:00Z", dakika: 10 }], sinavTarihi: "2026-11-14", simdi: "2026-09-19T00:00:00Z" });
    expect(p.hal).toBe("kritik");
    expect(p.risk.length).toBeGreaterThan(0);
  });
});
