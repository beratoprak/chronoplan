import { describe, expect, it } from "vitest";
import { hizYazisi, sonrakiHiz } from "./video-hizi";

describe("video hızı", () => {
  it("1× → 1,25× → … → 2× → 1× döner", () => {
    const sira = [1];
    for (let i = 0; i < 5; i++) sira.push(sonrakiHiz(sira[sira.length - 1]));
    expect(sira).toEqual([1, 1.25, 1.5, 1.75, 2, 1]);
  });
  it("listede olmayan hızdan 1×'e", () => {
    expect(sonrakiHiz(3)).toBe(1);
  });
  it("Türkçe ondalıkla yazılır", () => {
    expect(hizYazisi(1.25)).toBe("1,25×");
    expect(hizYazisi(2)).toBe("2×");
  });
});
