import { describe, expect, it } from "vitest";
import { cevaplananSorular, ezberKartlari, isaretliKazanimlar } from "./note-blocks";
import { bloklariYaz } from "./note-content";

const notFrom = (bloklar: unknown[]) => ({ content: bloklariYaz(bloklar as never) });

const kazanim = (id: string, checked: boolean) =>
  ({ type: "kazanim", props: { outcomeId: id, unitId: "u1", metin: "x", checked } });
const soru = (id: string, verilen: string) =>
  ({ type: "soru", props: { questionId: id, govde: "s", secenekler: "[]", dogru: "A", verilen } });

describe("işaretli kazanımlar", () => {
  it("yalnız işaretlenenleri toplar", () => {
    const n = notFrom([kazanim("o1", true), kazanim("o2", false), kazanim("o3", true)]);
    expect(Array.from(isaretliKazanimlar([n])).sort()).toEqual(["o1", "o3"]);
  });

  it("birden çok nottan toplar", () => {
    const a = notFrom([kazanim("o1", true)]);
    const b = notFrom([kazanim("o2", true)]);
    expect(isaretliKazanimlar([a, b]).size).toBe(2);
  });

  it("kimliksiz kazanım sayılmaz", () => {
    expect(isaretliKazanimlar([notFrom([kazanim("", true)])]).size).toBe(0);
  });

  it("iç içe bloklardaki kazanımı da bulur", () => {
    const ic = { type: "paragraph", content: [], children: [kazanim("derin", true)] };
    expect(isaretliKazanimlar([notFrom([ic])]).has("derin")).toBe(true);
  });

  it("düz metin not çökmeye yol açmaz", () => {
    expect(isaretliKazanimlar([{ content: "sadece düz metin" }]).size).toBe(0);
  });
});

describe("cevaplanan sorular", () => {
  it("verilen şıkkı kimliğe eşler", () => {
    const n = notFrom([soru("q1", "B"), soru("q2", "")]);
    const m = cevaplananSorular([n]);
    expect(m.get("q1")).toBe("B");
    expect(m.has("q2")).toBe(false);
  });

  it("boş içerik boş harita verir", () => {
    expect(cevaplananSorular([{ content: "" }]).size).toBe(0);
  });
});

describe("ezber kartları", () => {
  const kart = (id: string, on = "soru", arka = "cevap") =>
    ({ type: "ezberKarti", props: { cardId: id, on, arka, unitId: "u1", dersKodu: "AAUF1101" } });

  it("kart bloklarını toplar", () => {
    const n = notFrom([kart("k1"), kart("k2")]);
    expect(ezberKartlari([n]).map((k) => k.cardId)).toEqual(["k1", "k2"]);
  });

  it("aynı kart iki notta geçse bir kez sayılır", () => {
    const a = notFrom([kart("k1")]);
    const b = notFrom([kart("k1")]);
    expect(ezberKartlari([a, b])).toHaveLength(1);
  });

  it("kimliksiz kart atlanır", () => {
    expect(ezberKartlari([notFrom([kart("")])])).toHaveLength(0);
  });

  it("ön ve arka yüz taşınır", () => {
    const [k] = ezberKartlari([notFrom([kart("k1", "Limit nedir?", "Yaklaşma değeri")])]);
    expect(k.on).toBe("Limit nedir?");
    expect(k.arka).toBe("Yaklaşma değeri");
  });
});
