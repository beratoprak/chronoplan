// Ders modüllerinin (OYS etkinlikleri) etiketi ve çalışma sırası.
// Okul sekmesi ve gün sayfası aynı etiketi göstersin diye tek yerde.

/** Modül etiketi: tipten çok adı belirleyici — aynı "resource" hem kitap hem ses olabiliyor. */
export function materyalEtiketi(ad: string, tip: string) {
  if (/e-?pub/i.test(ad)) return "E-Pub";
  if (/podcast|ses metni/i.test(ad)) return "Ses";
  if (/çıkmış|örnek soru/i.test(ad)) return "Çıkmış soru";
  if (/kitap|ders notu/i.test(ad)) return "Kitap";
  if (tip === "hvp") return "Video";
  if (tip === "quiz") return "Test";
  if (tip === "page") return "Sayfa";
  if (tip === "folder") return "Klasör";
  if (tip === "resource") return "Dosya";
  return tip;
}

/** Çalışma sırası: önce oku, sonra izle, sonra kendini dene. */
export const MATERYAL_SIRASI = ["Kitap", "Ses", "Video", "Sayfa", "Test", "Çıkmış soru", "Dosya", "Klasör", "E-Pub"];
