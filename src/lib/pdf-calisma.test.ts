import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));

import { kutulariHesapla } from "./pdf-calisma";

const sayfa = { left: 100, top: 50, width: 1000, height: 2000 };

describe("seçim kutuları", () => {
  it("sayfaya oranla çevrilir", () => {
    expect(kutulariHesapla([{ left: 200, top: 250, width: 300, height: 20 }], sayfa)).toEqual([{ x: 0.1, y: 0.1, w: 0.3, h: 0.01 }]);
  });
  it("aynı satırın parçaları birleşir, alt satır ayrı kalır", () => {
    const k = kutulariHesapla([
      { left: 200, top: 250, width: 100, height: 20 },
      { left: 300, top: 251, width: 150, height: 20 },
      { left: 200, top: 280, width: 400, height: 20 },
    ], sayfa);
    expect(k).toHaveLength(2);
    expect(k[0].x).toBe(0.1);
    expect(k[0].w).toBeCloseTo(0.25, 3);
  });
  it("sayfa dışı ve görünmez parçalar atılır", () => {
    expect(kutulariHesapla([{ left: 0, top: 0, width: 50, height: 10 }, { left: 200, top: 250, width: 0.5, height: 20 }], sayfa)).toEqual([]);
  });
});
