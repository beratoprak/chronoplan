import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {}, isSupabaseConfigured: true }));

import { enYakinSinav, etkinlikAciklamasi, etkinlikBasligi, kisalt, planEtkinlikId } from "./haftalik-plan-kayit";
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
  it("açıklamada süreler ve bitiş", () => {
    const a = etkinlikAciklamasi(gun, dersler);
    expect(a).toContain("Matematik I — 30 dk");
    expect(a).toContain("2-Dil Bilgisi — bugün biter · 30 dk");
  });
  it("uzun konu adı sözcük sınırında kısalır", () => {
    expect(kisalt("1-Temel İşletmecilik Kavram ve Tanımları, İşletmenin Özellikleri", 34)).toBe("1-Temel İşletmecilik Kavram ve…");
    expect(kisalt("3-Limit", 34)).toBe("3-Limit");
  });
  it("kimlik tarihten: yeniden planlanınca çoğalmaz", () => {
    expect(planEtkinlikId("2026-10-05")).toBe("ybs-plan-2026-10-05");
  });
});
