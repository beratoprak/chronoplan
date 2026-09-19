// Notlar arası bağlantı: [[başlık]] yazımı.
//
// Bağlantılar ayrı bir tabloda tutulmuyor; notun metni tek gerçek.
// Her hesaplama içerikten türediği için bağlantılar bayatlayamaz.

import { aranabilirMetin } from "./note-content";

export interface NoteRef {
  id: string;
  title: string;
  content: string;
}

export interface ResolvedLink {
  /** [[...]] içindeki ham metin. */
  text: string;
  /** Aynı başlıklı not varsa kimliği; yoksa null (henüz yazılmamış not). */
  targetId: string | null;
}

const BAGLANTI = /\[\[([^\]\n]+)\]\]/g;

/** Türkçe'ye duyarlı normalleştirme: "İKTİSAT" ile "iktisat" aynı nota gitmeli. */
const anahtar = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");

/** İçerikteki bağlantı metinlerini sırayla, tekrarsız döndürür. */
export function baglantiMetinleri(content: string): string[] {
  const duz = aranabilirMetin(content);
  const gorulen = new Set<string>();
  const cikti: string[] = [];
  // matchAll yineleyicisi derleme hedefiyle uyuşmuyor; exec döngüsü kullanılıyor.
  BAGLANTI.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BAGLANTI.exec(duz)) !== null) {
    const ham = m[1].trim();
    if (!ham) continue;
    const k = anahtar(ham);
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    cikti.push(ham);
  }
  return cikti;
}

/** Bağlantıları mevcut notlarla eşleştirir. Eşleşmeyen bağlantı silinmez, boş hedefle durur. */
export function baglantilariCozumle(content: string, notlar: NoteRef[]): ResolvedLink[] {
  const baslikIndeksi = new Map<string, string>();
  for (const n of notlar) {
    const k = anahtar(n.title);
    // İlk eşleşme kazanır: aynı başlıkta iki not varsa en eskisine gitmek,
    // her kaydetmede hedef değiştirmekten öngörülebilir.
    if (k && !baslikIndeksi.has(k)) baslikIndeksi.set(k, n.id);
  }
  return baglantiMetinleri(content).map((text) => ({
    text,
    targetId: baslikIndeksi.get(anahtar(text)) ?? null,
  }));
}

/** Bu nota bağlanan notlar. Kendine bağlanan not listeye girmez. */
export function geriBaglantilar(noteId: string, notlar: NoteRef[]): NoteRef[] {
  const hedef = notlar.find((n) => n.id === noteId);
  if (!hedef) return [];
  const k = anahtar(hedef.title);
  if (!k) return [];
  return notlar.filter((n) => n.id !== noteId && baglantiMetinleri(n.content).some((t) => anahtar(t) === k));
}
