import { describe, expect, it } from "vitest";
import { baglantiMetinleri, baglantilariCozumle, geriBaglantilar } from "./note-links";
import { bloklariYaz, metindenBloklar } from "./note-content";

const not = (id: string, title: string, content: string) => ({ id, title, content });

describe("bağlantı çıkarma", () => {
  it("düz metinden bağlantıları alır", () => {
    expect(baglantiMetinleri("bkz [[Limit]] ve [[Süreklilik]]")).toEqual(["Limit", "Süreklilik"]);
  });

  it("blok JSON'ından da alır", () => {
    const içerik = bloklariYaz(metindenBloklar("# Türev\n\nÖnce [[Limit]] oku."));
    expect(baglantiMetinleri(içerik)).toEqual(["Limit"]);
  });

  it("tekrarlananları bir kez sayar", () => {
    expect(baglantiMetinleri("[[Limit]] sonra yine [[limit]]")).toEqual(["Limit"]);
  });

  it("boş bağlantıyı atar", () => {
    expect(baglantiMetinleri("[[ ]] ve [[Limit]]")).toEqual(["Limit"]);
  });

  // Metin satır sonunda sarıldığında bağlantı bölünmüş görünür ama tek bir
  // metindir; boşluk normalleştirilip bağlantı korunur.
  it("satır sonuyla bölünen bağlantı tek parça sayılır", () => {
    expect(baglantiMetinleri("[[iki\nsatır]]")).toEqual(["iki satır"]);
  });

  it("araya giren fazla boşluk hedefi değiştirmez", () => {
    const notlar = [{ id: "n", title: "iki satır", content: "" }];
    expect(baglantilariCozumle("[[iki   satır]]", notlar)[0].targetId).toBe("n");
  });
});

describe("bağlantı çözümleme", () => {
  const notlar = [not("n1", "Limit", ""), not("n2", "Süreklilik", "")];

  it("başlığa göre eşleştirir", () => {
    expect(baglantilariCozumle("[[Limit]]", notlar)[0].targetId).toBe("n1");
  });

  it("Türkçe büyük/küçük harf farkı engel değil", () => {
    expect(baglantilariCozumle("[[LİMİT]]", [not("n1", "limit", "")])[0].targetId).toBe("n1");
  });

  it("karşılığı olmayan bağlantı boş hedefle durur", () => {
    const [b] = baglantilariCozumle("[[Henüz Yok]]", notlar);
    expect(b.text).toBe("Henüz Yok");
    expect(b.targetId).toBeNull();
  });

  it("aynı başlıkta iki not varsa ilki kazanır", () => {
    const ikili = [not("a", "Limit", ""), not("b", "Limit", "")];
    expect(baglantilariCozumle("[[Limit]]", ikili)[0].targetId).toBe("a");
  });
});

describe("geri bağlantılar", () => {
  const notlar = [
    not("n1", "Limit", "temel konu"),
    not("n2", "Türev", "önce [[Limit]] gerekir"),
    not("n3", "İntegral", "[[limit]] ve [[Türev]]"),
  ];

  it("bu nota bağlanan notları bulur", () => {
    expect(geriBaglantilar("n1", notlar).map((n) => n.id)).toEqual(["n2", "n3"]);
  });

  it("kendine bağlanan not listeye girmez", () => {
    const kendine = [not("x", "Kendi", "[[Kendi]]")];
    expect(geriBaglantilar("x", kendine)).toEqual([]);
  });

  it("bilinmeyen not için boş döner", () => {
    expect(geriBaglantilar("yok", notlar)).toEqual([]);
  });
});
