// Not içindeki okul bloklarından durum çıkarma.
//
// İşaretlenen kazanım ayrı bir tabloya yazılmıyor: blok zaten notun içinde
// duruyor ve not senkronize oluyor. İkinci bir kayıt tutmak, notu düzenlerken
// bozulabilecek bir kopya yaratırdı. Panel de bu okuyucuyu kullanıyor, böylece
// notta işaretlediğin kazanım panelde aynı anda görünüyor.

import { bloklariOku, type NoteBlock } from "./note-content";

interface BlokTasiyan {
  content: string;
}

function tumBloklar(notlar: BlokTasiyan[]): NoteBlock[] {
  const cikti: NoteBlock[] = [];
  const gez = (liste: NoteBlock[]) => {
    for (const b of liste) {
      cikti.push(b);
      if (b.children?.length) gez(b.children);
    }
  };
  for (const n of notlar) gez(bloklariOku(n.content));
  return cikti;
}

const prop = (b: NoteBlock, ad: string) => (b.props as Record<string, unknown> | undefined)?.[ad];

/** Notlarda işaretlenmiş kazanımların kimlikleri. */
export function isaretliKazanimlar(notlar: BlokTasiyan[]): Set<string> {
  const cikti = new Set<string>();
  for (const b of tumBloklar(notlar)) {
    if (b.type !== "kazanim") continue;
    const id = prop(b, "outcomeId");
    if (typeof id === "string" && id && prop(b, "checked") === true) cikti.add(id);
  }
  return cikti;
}

/** Notlarda cevaplanmış sorular: soru kimliği → verilen şık. */
export function cevaplananSorular(notlar: BlokTasiyan[]): Map<string, string> {
  const cikti = new Map<string, string>();
  for (const b of tumBloklar(notlar)) {
    if (b.type !== "soru") continue;
    const id = prop(b, "questionId");
    const verilen = prop(b, "verilen");
    if (typeof id === "string" && id && typeof verilen === "string" && verilen) cikti.set(id, verilen);
  }
  return cikti;
}
