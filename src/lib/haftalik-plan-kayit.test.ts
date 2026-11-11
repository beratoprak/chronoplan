import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {}, isSupabaseConfigured: true }));

import { enYakinSinav, etkinlikAciklamasi, etkinlikBasligi, kisalt, planEtkinlikId, planiHesapla } from "./haftalik-plan-kayit";
import type { CalendarEvent } from "@/types";
import type { PlanGunu } from "./haftalik-plan";

const ev = (title: string, date: string) => ({ id: title, title, date, tagColor: "school", isAllDay: true, recurrence: "none" }) as CalendarEvent;
const dersler = [
  { kod: "AAUF1105", ad: "Matematik I" },
  { kod: "ATDİ107", ad: "Türk Dili I" },
] as never;

describe("en yakın sınav", () => {
  const takvim = [ev("Güz ara sınav", "2026-11-14"), ev("Güz final", "2027-01-09"), ev("Kayıt", "2026-10-01")];
  it("vizeden önce ara sınav", () => {
    expect(enYakinSinav(takvim, "2026-10-05")).toEqual({ tarih: "2026-11-14", dilim: "vize" });
  });
  it("sınavın ikinci günü hâlâ ara sınav", () => {
    expect(enYakinSinav(takvim, "2026-11-15")?.dilim).toBe("vize");
  });
  it("vizeden sonra final", () => {
    expect(enYakinSinav(takvim, "2026-11-16")).toEqual({ tarih: "2027-01-09", dilim: "final" });
  });
  it("sınav yoksa null", () => {
    expect(enYakinSinav([ev("Kayıt", "2026-10-01")], "2026-10-05")).toBeNull();
  });
});

describe("takvim etkinliği", () => {
  const gun: PlanGunu = {
    tarih: "2026-10-05", tur: "calisma", dersler: [
      { ders_kodu: "AAUF1105", tur: "konu", dakika: 30, parcalar: [{ unit_id: "u3", baslik: "3-Limit", dakika: 30, devam: true, bitiyor: false }] },
      { ders_kodu: "ATDİ107", tur: "konu", dakika: 30, parcalar: [{ unit_id: "t2", baslik: "2-Dil Bilgisi", dakika: 30, devam: false, bitiyor: true }] },
    ],
  };
  it("başlıkta iki ders ve konu", () => {
    expect(etkinlikBasligi(gun, dersler)).toBe("📘 Matematik I · 3-Limit (devam)  +  Türk Dili I · 2-Dil Bilgisi");
  });
  it("açıklamada konular var, süre yok (26 Ekim)", () => {
    const a = etkinlikAciklamasi(gun, dersler);
    expect(a).toContain("Matematik I");
    expect(a).toContain("3-Limit (devam) — biraz daha ilerle, sonra bitir");
    expect(a).toContain("• 2-Dil Bilgisi\n");
    expect(a).not.toMatch(/\bdk\b|saat/);
  });
  it("uzun konu adı sözcük sınırında kısalır", () => {
    expect(kisalt("1-Temel İşletmecilik Kavram ve Tanımları, İşletmenin Özellikleri", 34)).toBe("1-Temel İşletmecilik Kavram ve…");
    expect(kisalt("3-Limit", 34)).toBe("3-Limit");
  });
  it("kimlik tarihten: yeniden planlanınca çoğalmaz", () => {
    expect(planEtkinlikId("2026-10-05")).toBe("ybs-plan-2026-10-05");
  });
  it("tekrar günü yalnız tekrarsa eskisi gibi", () => {
    const tekrar: PlanGunu = { tarih: "2026-11-13", tur: "tekrar", dersler: [{ ...gun.dersler[0], tur: "tekrar" }, { ...gun.dersler[1], tur: "tekrar" }] };
    expect(etkinlikBasligi(tekrar, dersler)).toBe("🔁 Tekrar · Matematik I + Türk Dili I");
  });
  it("sınav günü öğleden sonra: önce yeni konu, sonra tekrar (11 Kasım)", () => {
    const sinav: PlanGunu = {
      tarih: "2026-11-14", tur: "sinav", dersler: [
        { ders_kodu: "AAUF1105", tur: "konu", dakika: 50, parcalar: [{ unit_id: "u3", baslik: "3-Limit", dakika: 50, devam: false, bitiyor: true }] },
        { ders_kodu: "AAUF1105", tur: "tekrar", dakika: 0, parcalar: [] },
        { ders_kodu: "ATDİ107", tur: "tekrar", dakika: 0, parcalar: [] },
      ],
    };
    expect(etkinlikBasligi(sinav, dersler)).toBe("Öğleden sonra · 📘 Matematik I · 3-Limit  +  🔁 Tekrar · Matematik I + Türk Dili I");
    expect(etkinlikAciklamasi(sinav, dersler)).toMatch(/^Sınavdan sonra, öğleden sonra:/);
  });
});

describe("vizeden sonra finale geçiş (Faz H)", () => {
  const takvim = [ev("Güz ara sınav", "2026-11-14"), ev("Güz final", "2027-01-09")];
  const data = {
    units: [
      { id: "v1", ders_kodu: "AAUF1105", baslik: "1-Temel", tip: "konu", dilim: "vize", katman: "cekirdek", tahmini_dakika: 60, soru_degeri: 5, konu_no: 1 },
      { id: "f1", ders_kodu: "AAUF1105", baslik: "5-Türev", tip: "konu", dilim: "final", katman: "cekirdek", tahmini_dakika: 60, soru_degeri: 5, konu_no: 5 },
    ],
    modules: [], questions: [], progress: [],
  } as never;

  it("vize pazarı akşamı kurulan plan final konularıyla", () => {
    const sonuc = planiHesapla(data, takvim, new Date(2026, 10, 15, 21, 30));
    expect(sonuc?.hafta).toBe("2026-11-16");
    const konular = sonuc!.plan.gunler.flatMap((g) => g.dersler.flatMap((d) => d.parcalar.map((p) => p.unit_id)));
    expect(konular).toContain("f1");
    expect(konular).not.toContain("v1");
  });

  it("vize haftası içinde hâlâ vize konuları", () => {
    const sonuc = planiHesapla(data, takvim, new Date(2026, 10, 9, 10, 0));
    const konular = sonuc!.plan.gunler.flatMap((g) => g.dersler.flatMap((d) => d.parcalar.map((p) => p.unit_id)));
    expect(konular).not.toContain("f1");
  });
});
