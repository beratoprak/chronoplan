import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {}, isSupabaseConfigured: true }));

import { tahminleriUygula, type StudyModule } from "./school-data";
import { foyMalzemesi } from "./gun-sayfasi";

describe("Gemini tahmini (Faz G)", () => {
  it("süre ve zorluk birime uygulanır; tahmini olmayan aynen kalır", () => {
    const u = tahminleriUygula([{ id: "a", tahmini_dakika: 60 }, { id: "b", tahmini_dakika: 30 }], [{ unit_id: "a", dakika: 90, zorluk: 4, gerekce: null }]);
    expect(u).toEqual([{ id: "a", tahmini_dakika: 90, zorluk: 4 }, { id: "b", tahmini_dakika: 30 }]);
  });

  it("kodun tanımadığı malzeme Gemini'nin tür tahminiyle föye girer", () => {
    const m = (ad: string, tip: string, tur_tahmini: StudyModule["tur_tahmini"] = null): StudyModule =>
      ({ id: `ybs:mod:${ad}`, unit_id: "u", ad, tip, oys_url: "https://oys", tahmini_dakika: 5, yerel_dosya: null, tur_tahmini });
    const sonuc = foyMalzemesi([m("Not alıştırması", "pdfannotator", "alistirma"), m("Bilinmeyen", "yenitur")]);
    expect(sonuc.map((x) => x.tur)).toEqual(["test"]);
  });
});
