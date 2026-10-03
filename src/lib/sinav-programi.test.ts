import { describe, expect, it } from "vitest";
import { oturumGruplari } from "./sinav-programi";

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
