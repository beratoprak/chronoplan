// Not içeriği dönüşümü.
//
// Mevcut notlar düz metin olarak yazılmış; blok editörüne geçerken onları
// kaybetmemek gerekiyor. İçerik okunurken biçim sezilir: blok JSON'ı ise
// olduğu gibi, düz metinse bloklara çevrilerek verilir. Böylece göç bir defalık
// bir toplu işlem değil, notu ilk açtığında kendiliğinden olan bir şey —
// yarıda kalan bir migration riski yok.

export interface NoteBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: NoteBlock[];
}

const BASLIK = /^(#{1,3})\s+(.*)$/;
const KUTUCUK = /^[☐☑]\s+(.*)$/;
const MADDE = /^[-*•]\s+(.*)$/;

const metinBlok = (type: string, text: string, props: Record<string, unknown> = {}): NoteBlock => ({
  type,
  props,
  content: text ? [{ type: "text", text, styles: {} }] : [],
});

/** Düz metni bloklara çevirir. Başlık, kutucuk ve madde işaretleri korunur. */
export function metindenBloklar(metin: string): NoteBlock[] {
  const bloklar: NoteBlock[] = [];
  for (const ham of metin.split("\n")) {
    const satir = ham.trimEnd();
    const baslik = satir.match(BASLIK);
    if (baslik) {
      bloklar.push(metinBlok("heading", baslik[2], { level: Math.min(3, baslik[1].length) }));
      continue;
    }
    const kutu = satir.match(KUTUCUK);
    if (kutu) {
      bloklar.push(metinBlok("checkListItem", kutu[1], { checked: satir.startsWith("☑") }));
      continue;
    }
    const madde = satir.match(MADDE);
    if (madde) {
      bloklar.push(metinBlok("bulletListItem", madde[1]));
      continue;
    }
    bloklar.push(metinBlok("paragraph", satir.trim()));
  }
  return bloklar.length ? bloklar : [metinBlok("paragraph", "")];
}

/** İçerik blok JSON'ı mı, düz metin mi? Kararı biçimin kendisi veriyor. */
export function bloklariOku(content: string): NoteBlock[] {
  const ham = (content ?? "").trim();
  if (!ham) return [metinBlok("paragraph", "")];
  if (ham.startsWith("[")) {
    try {
      const cozulen = JSON.parse(ham);
      if (Array.isArray(cozulen) && cozulen.every((b) => b && typeof b.type === "string")) return cozulen;
    } catch { /* düz metin muamelesi görür */ }
  }
  // Eski kayıtların bir kısmı JSON.stringify edilmiş düz metin ("...") olarak duruyor.
  if (ham.startsWith('"')) {
    try {
      const cozulen = JSON.parse(ham);
      if (typeof cozulen === "string") return metindenBloklar(cozulen);
    } catch { /* aşağıya düşer */ }
  }
  return metindenBloklar(ham);
}

export function bloklariYaz(bloklar: NoteBlock[]): string {
  return JSON.stringify(bloklar);
}

/** Arama ve önizleme için düz metin. Blok yapısı aramada işe yaramaz. */
export function bloklardanMetin(bloklar: NoteBlock[]): string {
  const parcalar: string[] = [];
  const gez = (liste: NoteBlock[]) => {
    for (const b of liste) {
      if (Array.isArray(b.content)) {
        for (const c of b.content as { type?: string; text?: string }[]) {
          if (c && typeof c.text === "string") parcalar.push(c.text);
        }
      }
      if (b.children?.length) gez(b.children);
    }
  };
  gez(bloklar);
  return parcalar.join(" ").replace(/\s+/g, " ").trim();
}

/** Not içeriğinin aranabilir düz metni — biçimi ne olursa olsun. */
export function aranabilirMetin(content: string): string {
  return bloklardanMetin(bloklariOku(content));
}
