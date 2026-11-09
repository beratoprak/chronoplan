import { describe, expect, it } from "vitest";
import { akisMetni } from "./pdf-metni";

describe("pdf metni", () => {
  it("akışı async yineleme olmadan okur, satır sonlarını korur", async () => {
    const parcalar = [
      { items: [{ str: "PAZAR", hasEOL: false }, { str: "OTURUMU", hasEOL: true }] },
      { items: [{ str: "1. (AAUF1105) Matematik I", hasEOL: true }] },
    ];
    const akis = new ReadableStream({ start(c) { for (const p of parcalar) c.enqueue(p); c.close(); } });
    // Safari'yi taklit et: akış async yinelenemez.
    Object.defineProperty(akis, Symbol.asyncIterator, { value: undefined });
    expect(await akisMetni(akis)).toBe("PAZAR OTURUMU\n1. (AAUF1105) Matematik I\n");
  });
});
