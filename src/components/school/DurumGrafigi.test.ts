import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DurumGrafigi } from "./DurumGrafigi";
import type { DersDurumu } from "@/lib/ders-paneli";

const ders: DersDurumu = {
  kod: "MAT", toplam: 20, kapsanan: 8, esikte: false, esige_kalan: 4, esikYeri: 60, planlaEsikte: true,
  sayac: { bitti: 2, planda: 1, basladin: 0, dokunulmadi: 2 },
  konular: [
    { id: "a", baslik: "1-Kümeler", konu_no: 1, soru: 4, hal: "bitti" },
    { id: "b", baslik: "2-Fonksiyonlar", konu_no: 2, soru: 4, hal: "bitti" },
    { id: "c", baslik: "3-Limit", konu_no: 3, soru: 4, hal: "planda", planTarihi: "2026-11-12" },
    { id: "d", baslik: "4-Süreklilik", konu_no: 4, soru: 4, hal: "dokunulmadi" },
    { id: "e", baslik: "5-Türev", konu_no: 5, soru: 4, hal: "dokunulmadi" },
  ],
};

describe("durum grafiği", () => {
  it("özet sayılar, ders çubuğu ve eşik yazısı çizilir", () => {
    const html = renderToStaticMarkup(createElement(DurumGrafigi, { durumlar: [ders], dersAdi: () => "Matematik I", dilimAdi: "Vize", onDers: () => {} }));
    expect(html).toContain("Vizedeki durumun");
    expect(html).toContain("2/5 konu bitti");
    expect(html).toContain("Matematik I");
    expect(html).toContain("plan bitince eşikte");
    expect(html).toContain("Planda olmayan 2 konu");
  });
  it("veri yoksa hiçbir şey çizmez", () => {
    expect(renderToStaticMarkup(createElement(DurumGrafigi, { durumlar: [], dersAdi: (k) => k, dilimAdi: "Vize", onDers: () => {} }))).toBe("");
  });
});
