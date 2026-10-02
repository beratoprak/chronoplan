import { afterEach, describe, expect, it, vi } from "vitest";

// Okul sekmesi takılmasının taklidi: bir tablo isteği hiç dönmüyor. Gerçek
// fetch gibi davranıyor — yalnız iptal sinyali gelince reddediliyor.
let asili = new Set<string>();
let istekSayisi = 0;

vi.mock("./supabase", () => {
  const sorgu = (tablo: string) => ({
    select: () => ({
      eq: () => ({
        abortSignal: (signal: AbortSignal) => {
          istekSayisi++;
          if (!asili.has(tablo)) return Promise.resolve({ data: [], error: null });
          return new Promise((_, reddet) => {
            signal.addEventListener("abort", () => reddet(new DOMException("Aborted", "AbortError")));
          });
        },
      }),
    }),
  });
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: sorgu,
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    },
  };
});

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://x";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x";

afterEach(() => {
  vi.useRealTimers();
  asili = new Set();
  istekSayisi = 0;
});

describe("okul verisi zaman aşımı", () => {
  it("asılı kalan istek sonsuza kadar beklemez, hata fırlatır", async () => {
    vi.useFakeTimers();
    asili = new Set(["ybs_units"]);
    const { fetchSchoolData, OkulVerisiZamanAsimi } = await import("./school-data");
    const sonuc = fetchSchoolData("u1").then(() => "bitti", (e) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const e = await sonuc;
    expect(e).toBeInstanceOf(OkulVerisiZamanAsimi);
    expect((e as Error).message).toContain("ybs_units");
  });

  it("asılı istek bir kez yeniden denenir", async () => {
    vi.useFakeTimers();
    asili = new Set(["ybs_units"]);
    const { fetchSchoolData } = await import("./school-data");
    const sonuc = fetchSchoolData("u1").catch(() => null);
    await vi.advanceTimersByTimeAsync(30_000);
    await sonuc;
    // 13 tablo + asılı tablonun ikinci denemesi
    expect(istekSayisi).toBe(14);
  });

  it("ağ sağlıklıyken veri döner", async () => {
    const { fetchSchoolData } = await import("./school-data");
    const veri = await fetchSchoolData("u1");
    expect(veri.units).toEqual([]);
    expect(veri.warnings).toEqual([]);
  });
});
