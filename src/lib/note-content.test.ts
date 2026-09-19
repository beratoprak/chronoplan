import { describe, expect, it } from "vitest";
import { aranabilirMetin, bloklardanMetin, bloklariOku, bloklariYaz, metindenBloklar } from "./note-content";

describe("düz metinden bloklara", () => {
  it("başlık seviyesi korunur", () => {
    const [b] = metindenBloklar("## Kazanımlar");
    expect(b.type).toBe("heading");
    expect(b.props?.level).toBe(2);
    expect(bloklardanMetin([b])).toBe("Kazanımlar");
  });

  it("başlık seviyesi üçte sınırlanır", () => {
    expect(metindenBloklar("### Alt")[0].props?.level).toBe(3);
  });

  it("kutucuk işaretli ve işaretsiz ayrılır", () => {
    const [bos, dolu] = metindenBloklar("☐ yapılmadı\n☑ yapıldı");
    expect(bos.type).toBe("checkListItem");
    expect(bos.props?.checked).toBe(false);
    expect(dolu.props?.checked).toBe(true);
  });

  it("madde işaretleri listeye döner", () => {
    expect(metindenBloklar("- bir\n* iki\n• üç").every((b) => b.type === "bulletListItem")).toBe(true);
  });

  it("boş metin en az bir paragraf üretir", () => {
    expect(metindenBloklar("")).toHaveLength(1);
  });
});

describe("içerik biçimi sezme", () => {
  it("blok JSON'ı olduğu gibi döner", () => {
    const bloklar = metindenBloklar("# Başlık");
    expect(bloklariOku(bloklariYaz(bloklar))).toEqual(bloklar);
  });

  it("düz metin bloklara çevrilir", () => {
    expect(bloklariOku("## Özet")[0].type).toBe("heading");
  });

  it("JSON.stringify edilmiş düz metin de çözülür", () => {
    // Gün notu editörü içeriği bu biçimde yazıyordu; eski kayıtlar böyle duruyor.
    expect(bloklariOku(JSON.stringify("# Eski not"))[0].type).toBe("heading");
  });

  it("bozuk JSON düz metin sayılır, çökmez", () => {
    expect(bloklariOku("[bozuk")[0].type).toBe("paragraph");
  });

  it("boş içerik tek boş paragraf verir", () => {
    expect(bloklariOku("")).toHaveLength(1);
  });
});

describe("aranabilir metin", () => {
  it("iç içe blokların metnini toplar", () => {
    const bloklar = [
      { type: "heading", content: [{ type: "text", text: "Başlık" }], children: [
        { type: "paragraph", content: [{ type: "text", text: "iç metin" }] },
      ] },
    ];
    expect(bloklardanMetin(bloklar)).toBe("Başlık iç metin");
  });

  it("biçimden bağımsız çalışır", () => {
    expect(aranabilirMetin("# Limit\n\nSüreklilik")).toContain("Süreklilik");
    expect(aranabilirMetin(bloklariYaz(metindenBloklar("# Limit")))).toBe("Limit");
  });
});
