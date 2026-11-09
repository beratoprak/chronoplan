import { describe, expect, it } from "vitest";
import { haftaAnahtari, haftalikPlanKur, hedefAralik, hedefHafta, yenidenKurulmali, type PlanGirdisi } from "./haftalik-plan";
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

describe("haftalık planlayıcı — kurallar (v4)", () => {
  const dort = ["A", "B", "C", "D"].flatMap((d) => [u(`${d}1`, d, 1, 40), u(`${d}2`, d, 2, 40), u(`${d}3`, d, 3, 40)]);

  it("günde 1 ya da 2 farklı ders; ikisi de olabiliyor", () => {
    const p = haftalikPlanKur(temel(dort, { gunlukDakika: 100, bosGun: "yok" }));
    expect(p.gunler).toHaveLength(7);
    const sayilar = new Set<number>();
    for (const g of p.gunler.filter((x) => x.tur === "calisma")) {
      expect(g.dersler.length).toBeGreaterThanOrEqual(1);
      expect(g.dersler.length).toBeLessThanOrEqual(2);
      expect(new Set(g.dersler.map((d) => d.ders_kodu)).size).toBe(g.dersler.length);
      sayilar.add(g.dersler.length);
    }
    expect(sayilar.has(2)).toBe(true);
  });

  it("büyük konular olan günde tek ders", () => {
    const p = haftalikPlanKur(temel([u("M1", "M", 1, 90), u("T1", "T", 1, 90)], { gunlukDakika: 90, bitis: "2026-10-05" }));
    expect(p.gunler[0].dersler).toHaveLength(1);
  });

  it("bir derse günde en fazla 2 konu", () => {
    const p = haftalikPlanKur(temel([1, 2, 3, 4].map((n) => u(`K${n}`, "K", n, 20)), { gunlukDakika: 120, bitis: "2026-10-05" }));
    expect(p.gunler[0].dersler[0].parcalar).toHaveLength(2);
  });

  it("aynı ders üst üste iki gün gelmez (başka ders varken)", () => {
    const p = haftalikPlanKur(temel(dort, { gunlukDakika: 60, bosGun: "yok" }));
    for (let i = 1; i < p.gunler.length; i++) {
      const dun = new Set(p.gunler[i - 1].dersler.map((d) => d.ders_kodu));
      expect(dun.has(p.gunler[i].dersler[0]?.ders_kodu)).toBe(false);
    }
  });

  it("konular dersin kendi sırasıyla gelir, bütçeyi çok aşan konu bölünür", () => {
    const p = haftalikPlanKur(temel([u("M1", "M", 1, 100), u("M2", "M", 2, 60), u("T1", "T", 1, 60)], { gunlukDakika: 60, bosGun: "yok" }));
    const m = p.gunler.flatMap((g) => g.dersler.filter((d) => d.ders_kodu === "M").flatMap((d) => d.parcalar));
    expect(m[0]).toMatchObject({ unit_id: "M1", dakika: 60, devam: false, bitiyor: false });
    expect(m[1]).toMatchObject({ unit_id: "M1", dakika: 40, devam: true, bitiyor: true });
    expect(m[2].unit_id).toBe("M2");
  });

  it("ikinci derse yarım konu konmaz", () => {
    const p = haftalikPlanKur(temel(dort, { gunlukDakika: 70, bosGun: "yok" }));
    for (const g of p.gunler) for (const d of g.dersler.slice(1).filter((x) => x.tur === "konu")) expect(d.parcalar.every((x) => x.bitiyor)).toBe(true);
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
    const p = haftalikPlanKur(temel(units, { ilerleme, baslangic: "2026-10-05", bitis: "2026-10-06", gunlukDakika: 60 }));
    expect(p.gunler.map((g) => g.dersler[0].ders_kodu).sort()).toEqual(["B", "C"]);
  });

  it("yük rahatsa pazarlar boş, gerideyse boş gün yok", () => {
    const az = haftalikPlanKur(temel(dort));
    expect(az.bos_gun).toBe(true);
    expect(az.gunler.find((g) => g.tarih === "2026-10-11")?.tur).toBe("bos");
    const cok = Array.from({ length: 9 }, (_, i) => [1, 2, 3, 4, 5].map((n) => u(`D${i}-${n}`, `D${i}`, n, 120, 4))).flat();
    const p = haftalikPlanKur(temel(cok));
    expect(p.bos_gun).toBe(false);
    expect(p.gunler.every((g) => g.tur === "calisma")).toBe(true);
  });

  it("sınavdan önceki son 4 gün yalnız tekrar, sınav günleri boş", () => {
    // Tekrar günü sabit: kurtarma kapalı (12 konu bir güne sığmazdı; kurtarma ayrı denenir).
    const p = haftalikPlanKur(temel(dort, { baslangic: "2026-11-09", bitis: "2026-11-15", tekrarGunu: 4 }));
    const turler = Object.fromEntries(p.gunler.map((g) => [g.tarih, g.tur]));
    expect(turler["2026-11-09"]).toBe("calisma");
    for (const t of ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]) expect(turler[t]).toBe("tekrar");
    expect(turler["2026-11-14"]).toBe("sinav");
    expect(turler["2026-11-15"]).toBe("sinav");
    const tekrarGunu = p.gunler.find((g) => g.tarih === "2026-11-10")!;
    expect(tekrarGunu.dersler.every((d) => d.tur === "tekrar")).toBe(true);
  });
});

describe("son düzlük (sınava ≤ 14 gün)", () => {
  const cok = Array.from({ length: 9 }, (_, i) => [1, 2, 3, 4, 5].map((n) => u(`D${i}-${n}`, `D${i}`, n, 30 + n * 5, 4))).flat();

  it("14 günden uzakta normal plan, bütün konular", () => {
    const p = haftalikPlanKur(temel(cok, { baslangic: "2026-10-26", bitis: "2026-11-01" }));
    expect(p.mod).toBe("normal");
    expect(p.hedef_soru).toBeNull();
    expect(p.birakilan).toHaveLength(0);
  });

  it("iş sığmıyorsa konu seçer, bıraktığını söyler; her ders en az 12 soruya taşınır", () => {
    const p = haftalikPlanKur(temel(cok, { baslangic: "2026-10-31", bitis: "2026-11-15" }));
    expect(p.mod).toBe("son-duzluk");
    expect(p.hedef_soru).toBeGreaterThanOrEqual(12);
    expect(p.birakilan.length).toBeGreaterThan(0);
    expect(p.uyarilar.join(" ")).toMatch(/bilerek bıraktım/);
    const planlanan = new Set(p.gunler.flatMap((g) => g.dersler.filter((d) => d.tur === "konu").flatMap((d) => d.parcalar.map((x) => x.unit_id))));
    for (let i = 0; i < 9; i++) {
      const soru = [1, 2, 3, 4, 5].filter((n) => planlanan.has(`D${i}-${n}`)).length * 4;
      expect(soru).toBeGreaterThanOrEqual(12);
    }
  });

  it("sıralı olmayan derste kısa konular seçilir, ama sırayla çalışılır", () => {
    const units = [u("X1", "X", 1, 600, 5), u("X2", "X", 2, 30, 5), u("X3", "X", 3, 30, 5), u("X4", "X", 4, 30, 5), u("X5", "X", 5, 600, 5)];
    const p = haftalikPlanKur(temel(units, { baslangic: "2026-11-05", bitis: "2026-11-09", gunlukDakika: 40 }));
    const sira = p.gunler.flatMap((g) => g.dersler.flatMap((d) => d.tur === "konu" ? d.parcalar.map((x) => x.unit_id) : []));
    expect(sira).toEqual(["X2", "X3", "X4"]);
  });

  it("Matematik'in sırası bozulmaz", () => {
    const units = [u("M1", "AAUF1105", 1, 120, 4), u("M2", "AAUF1105", 2, 30, 4), u("M3", "AAUF1105", 3, 30, 4), u("M4", "AAUF1105", 4, 30, 4)];
    const p = haftalikPlanKur(temel(units, { baslangic: "2026-11-05", bitis: "2026-11-09", gunlukDakika: 60 }));
    const sira = p.gunler.flatMap((g) => g.dersler.flatMap((d) => d.tur === "konu" ? d.parcalar.map((x) => x.unit_id) : []));
    expect(sira[0]).toBe("M1");
  });
});

describe("kurtarma (12 doğruya yetecek konular da sığmıyor)", () => {
  // 9 ders × 5 uzun konu, 8 gün kala hiç başlanmamış.
  const agir = Array.from({ length: 9 }, (_, i) => [1, 2, 3, 4, 5].map((n) => u(`D${i}-${n}`, `D${i}`, n, 120 + i * 20, 4))).flat();
  const p = haftalikPlanKur(temel(agir, { baslangic: "2026-11-06", bitis: "2026-11-15" }));

  it("kurtarma moduna girer ve söyler", () => {
    expect(p.mod).toBe("kurtarma");
    expect(p.hedef_soru).toBe(12);
    expect(p.uyarilar.join(" ")).toMatch(/kurtarma planı/);
  });

  it("tekrar yalnız sınavdan önceki gün; öncesi çalışma", () => {
    expect(p.gunler.map((g) => g.tur)).toEqual(["calisma", "calisma", "calisma", "calisma", "calisma", "calisma", "calisma", "tekrar", "sinav", "sinav"]);
  });

  it("ana dersler dönüşümlü gelir (9 Kasım); her konu parçası kurtarma işaretli", () => {
    const anaDersler = new Set(p.gunler.filter((g) => g.tur === "calisma").map((g) => g.dersler[0].ders_kodu));
    expect(anaDersler.size).toBe(7);
    const parcalar = p.gunler.filter((g) => g.tur === "calisma").flatMap((g) => g.dersler.flatMap((d) => d.parcalar));
    expect(parcalar.length).toBeGreaterThan(0);
    expect(parcalar.every((x) => x.kurtarma)).toBe(true);
  });

  it("çalışma günlerine sığmayan dersler tekrar gününe önce girer", () => {
    const planlanan = new Set(p.gunler.filter((g) => g.tur === "calisma").flatMap((g) => g.dersler.flatMap((d) => d.parcalar.map((x) => x.unit_id))));
    const ilk = p.gunler.find((g) => g.tur === "tekrar")!.dersler[0].ders_kodu;
    expect([1, 2, 3, 4, 5].some((n) => !planlanan.has(`${ilk}-${n}`))).toBe(true);
  });

  it("sınava 4 gün kala (tekrar günlerinden sonra) da kurtarma sürer", () => {
    const gec = haftalikPlanKur(temel(agir, { baslangic: "2026-11-10", bitis: "2026-11-15" }));
    expect(gec.mod).toBe("kurtarma");
    expect(gec.gunler.map((g) => g.tur)).toEqual(["calisma", "calisma", "calisma", "tekrar", "sinav", "sinav"]);
  });

  it("iş sığıyorsa kurtarma yok", () => {
    const hafif = haftalikPlanKur(temel(agir.map((x) => ({ ...x, tahmini_dakika: 10 })), { baslangic: "2026-11-06", bitis: "2026-11-15" }));
    expect(hafif.mod).toBe("son-duzluk");
    expect(hafif.gunler.filter((g) => g.tur === "tekrar")).toHaveLength(4);
  });
});

describe("kurtarma: ana dersler önce, yabancı dil yalnız soru (9 Kasım)", () => {
  const k = (id: string, ders: string, no: number, dakika: number, katman: "cekirdek" | "kultur") => ({ ...u(id, ders, no, dakika, 4), katman });
  const units: StudyUnit[] = [
    ...["C1", "C2", "C3"].flatMap((d) => [1, 2, 3, 4, 5].map((n) => k(`${d}-${n}`, d, n, 150, "cekirdek"))),
    ...["K1", "K2"].flatMap((d) => [1, 2, 3, 4, 5].map((n) => k(`${d}-${n}`, d, n, 20, "kultur"))),
    ...[1, 2, 3, 4, 5].map((n) => k(`AYDİ111-${n}`, "AYDİ111", n, 60, "kultur")),
  ];
  const oturumlar = new Map([
    ["K1", { tarih: "2026-11-14", oturum: 1 }], ["K2", { tarih: "2026-11-14", oturum: 1 }], ["AYDİ111", { tarih: "2026-11-14", oturum: 1 }],
    ["C1", { tarih: "2026-11-15", oturum: 1 }], ["C2", { tarih: "2026-11-15", oturum: 1 }], ["C3", { tarih: "2026-11-15", oturum: 1 }],
  ]);
  const p = haftalikPlanKur(temel(units, { baslangic: "2026-11-09", bitis: "2026-11-15", oturumlar }));
  const calisma = p.gunler.filter((g) => g.tur === "calisma");

  it("günün ana dersi çekirdek; kısa dersten günde en fazla bir konu", () => {
    expect(p.mod).toBe("kurtarma");
    for (const g of calisma) {
      expect(g.dersler[0].ders_kodu).toMatch(/^C/);
      for (const d of g.dersler.filter((x) => x.ders_kodu.startsWith("K"))) expect(d.parcalar).toHaveLength(1);
    }
  });

  it("yabancı dil plana hiç girmez", () => {
    expect(p.gunler.flatMap((g) => g.dersler.map((d) => d.ders_kodu))).not.toContain("AYDİ111");
  });

  it("sınavdan önceki gün o sabahın bütün dersleri; ilk sınav günü öğleden sonra ertesi günün dersleri", () => {
    const gun = (t: string) => p.gunler.find((g) => g.tarih === t)!;
    expect(gun("2026-11-13").tur).toBe("tekrar");
    expect(gun("2026-11-13").dersler.map((d) => d.ders_kodu).sort()).toEqual(["K1", "K2"]);
    expect(gun("2026-11-14").tur).toBe("sinav");
    expect(gun("2026-11-14").dersler.map((d) => d.ders_kodu)).toEqual(["C1", "C2", "C3"]);
    expect(gun("2026-11-15").dersler).toHaveLength(0);
  });
});

describe("haftalık planlayıcı — gerçek 9 ders", () => {
  const units = gercekBirimler as StudyUnit[];

  it("5 Ekim'den sınava kadar 9 dersin hepsi plana giriyor, kırıntı yok", () => {
    const p = haftalikPlanKur({ units, ilerleme: bos, sinavTarihi: "2026-11-14", dilim: "vize", baslangic: "2026-10-05", bitis: "2026-11-13" });
    const calisma = p.gunler.filter((g) => g.tur === "calisma");
    expect(calisma.length).toBeGreaterThanOrEqual(30);
    const dersler = new Set(calisma.flatMap((g) => g.dersler.map((d) => d.ders_kodu)));
    expect(dersler.size).toBe(9);
    // İlk iki hafta dokuz dersin hepsi en az bir kez geliyor.
    const ilk = new Set(calisma.slice(0, 12).flatMap((g) => g.dersler.map((d) => d.ders_kodu)));
    expect(ilk.size).toBe(9);
    for (const g of calisma) for (const d of g.dersler) for (const x of d.parcalar) expect(x.dakika).toBeGreaterThanOrEqual(10);
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

describe("sınav haftası ve oturumlar (Faz H)", () => {
  const sekiz = ["A", "B", "C", "D", "E", "F", "G", "H"].flatMap((d) => [u(`${d}1`, d, 1, 60)]);
  // Tekrar günü sabit: kurtarma modu kapalı (bu iş bir güne sığmazdı).
  const haftasi = (ek: Partial<PlanGirdisi> = {}) => haftalikPlanKur(temel(sekiz, { baslangic: "2026-11-09", bitis: "2026-11-15", tekrarGunu: 4, ...ek }));

  it("son 4 gün tekrar, sınav günleri boş", () => {
    const p = haftasi();
    expect(p.gunler.map((g) => g.tur)).toEqual(["calisma", "tekrar", "tekrar", "tekrar", "tekrar", "sinav", "sinav"]);
  });

  it("aynı oturumdaki dersler aynı tekrar gününde; en erken oturum en son gün", () => {
    const oturumlar = new Map([
      ["A", { tarih: "2026-11-14", oturum: 1 }], ["E", { tarih: "2026-11-14", oturum: 1 }],
      ["B", { tarih: "2026-11-14", oturum: 2 }], ["F", { tarih: "2026-11-14", oturum: 2 }],
      ["C", { tarih: "2026-11-15", oturum: 1 }], ["G", { tarih: "2026-11-15", oturum: 1 }],
      ["D", { tarih: "2026-11-15", oturum: 2 }], ["H", { tarih: "2026-11-15", oturum: 2 }],
    ]);
    const tekrar = haftasi({ oturumlar }).gunler.filter((g) => g.tur === "tekrar").map((g) => g.dersler.map((d) => d.ders_kodu).sort().join(""));
    expect(tekrar).toEqual(["DH", "CG", "BF", "AE"]);
  });

  it("hafta ortasında yeniden planlansa da tekrar günleri aynı dersleri alır", () => {
    const tam = haftasi().gunler.filter((g) => g.tarih >= "2026-11-12");
    const yarim = haftasi({ baslangic: "2026-11-12" }).gunler;
    expect(yarim.map((g) => g.dersler.map((d) => d.ders_kodu))).toEqual(tam.map((g) => g.dersler.map((d) => d.ders_kodu)));
  });
});

describe("son düzlük aralığı ve yeniden kurma (v4)", () => {
  it("sınava 14 günden fazla varken normal hafta", () => {
    expect(hedefAralik(new Date(2026, 9, 26, 10), "2026-11-14")).toMatchObject({ sonDuzluk: false, bitis: "2026-11-01" });
  });
  it("sınava 14 gün kala aralık sınavın son gününe uzar", () => {
    expect(hedefAralik(new Date(2026, 9, 31, 10), "2026-11-14")).toEqual({ hafta: "2026-10-26", baslangic: "2026-10-31", bitis: "2026-11-15", sonDuzluk: true });
  });
  it("satır haftası günün pazartesisi", () => {
    expect(haftaAnahtari("2026-11-08")).toBe("2026-11-02");
    expect(haftaAnahtari("2026-11-09")).toBe("2026-11-09");
  });
  const temelK = { bugun: "2026-10-28", sonDuzluk: false, haftaVar: true, sinavaUzaniyor: false, sonKurulum: "2026-10-26T08:00:00Z", sonIlerleme: null };
  it("plan yoksa kurulur", () => {
    expect(yenidenKurulmali({ ...temelK, haftaVar: false })).toBe("yeni-hafta");
  });
  it("son düzlük başladı, plan sınava uzanmıyor → son düzlük planı", () => {
    expect(yenidenKurulmali({ ...temelK, sonDuzluk: true })).toBe("son-duzluk");
  });
  it("son düzlükte her gün bir kez tazelenir", () => {
    const k = { ...temelK, sonDuzluk: true, sinavaUzaniyor: true };
    expect(yenidenKurulmali(k)).toBe("gunluk");
    expect(yenidenKurulmali({ ...k, sonKurulum: "2026-10-28T06:00:00" })).toBeNull();
  });
  it("eski kurallarla kurulmuş plan bir kez yenilenir", () => {
    expect(yenidenKurulmali({ ...temelK, surumAni: "2026-10-27T00:00:00Z" })).toBe("yeni-hafta");
    expect(yenidenKurulmali({ ...temelK, surumAni: "2026-10-25T00:00:00Z" })).toBeNull();
  });
  it("3 gündür işaret yoksa geri dönüş; işaret varsa dokunulmaz", () => {
    expect(yenidenKurulmali({ ...temelK, bugun: "2026-10-28" })).toBeNull();
    expect(yenidenKurulmali({ ...temelK, bugun: "2026-10-29" })).toBe("geri-donus");
    expect(yenidenKurulmali({ ...temelK, bugun: "2026-10-29", sonIlerleme: "2026-10-27T12:00:00Z" })).toBeNull();
  });
});
