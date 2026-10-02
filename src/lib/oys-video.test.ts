import { describe, expect, it } from "vitest";
import { araligiSinirla, imzaGecerli, imzala, VIDEO_YOLU } from "./oys-video";

const YOL = "180223/mod_hvp/content/1143/videos/files-6343bc698037f.mp4";

describe("video yolu", () => {
  it("yalnız H5P videoları", () => {
    expect(VIDEO_YOLU.test(YOL)).toBe(true);
    expect(VIDEO_YOLU.test("180223/mod_resource/content/0/kitap.pdf")).toBe(false);
    expect(VIDEO_YOLU.test("1/mod_hvp/content/1/videos/../../x.mp4")).toBe(false);
    expect(VIDEO_YOLU.test(`${YOL}?token=x`)).toBe(false);
  });
});

describe("imzalı adres", () => {
  const simdi = 1_000_000;
  it("doğru imza ve süresi dolmamışsa geçer", () => {
    const s = imzala(YOL, simdi + 60, "g");
    expect(imzaGecerli(YOL, simdi + 60, s, "g", simdi)).toBe(true);
  });
  it("süresi dolmuş, başka yol ya da başka anahtar geçmez", () => {
    const s = imzala(YOL, simdi + 60, "g");
    expect(imzaGecerli(YOL, simdi + 60, s, "g", simdi + 61)).toBe(false);
    expect(imzaGecerli(YOL.replace("1143", "1144"), simdi + 60, s, "g", simdi)).toBe(false);
    expect(imzaGecerli(YOL, simdi + 60, s, "baska", simdi)).toBe(false);
    expect(imzaGecerli(YOL, simdi + 60, "kisa", "g", simdi)).toBe(false);
  });
});

describe("aralık", () => {
  it("sonu açık istek bir parçayla sınırlanır", () => {
    expect(araligiSinirla("bytes=0-", 100)).toBe("bytes=0-99");
    expect(araligiSinirla("bytes=500-", 100)).toBe("bytes=500-599");
  });
  it("küçük istek olduğu gibi kalır", () => {
    expect(araligiSinirla("bytes=10-19", 100)).toBe("bytes=10-19");
  });
  it("aralık yoksa baştan bir parça", () => {
    expect(araligiSinirla(null, 100)).toBe("bytes=0-99");
  });
});
