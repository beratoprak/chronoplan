// Konu notu şablonu — blok tabanlı.
//
// Boş bir not kutusu öğrenme platformu değil. Bir konuya oturduğunda neyi
// bilmen gerektiği (kazanımlar), neyi okuyacağın (materyal) ve nereye
// yazacağın hazır olmalı. Kazanımlar kutucuk olarak geliyor ki tek tek
// işaretlenebilsin; materyal bağlantılı satır olarak geliyor ki tıklanabilsin.

import { bloklariYaz, type NoteBlock } from "./note-content";
import type { StudyModule, StudyQuestion } from "./school-data";
import type { StudyUnit } from "./study-plan";

export interface SeededNote {
  title: string;
  content: string;
  tags: string[];
  unitId: string;
  dersKodu: string;
  kind: "konu";
}

const OKUMA_SIRASI = ["Kitap", "Ses", "Video"];

function materyalEtiketi(ad: string, tip: string): string | null {
  if (/e-?pub/i.test(ad)) return null;                    // PDF'in kopyası
  if (/podcast|ses metni/i.test(ad)) return "Ses";
  if (/çıkmış|örnek soru/i.test(ad)) return null;         // ayrı bölümde
  if (/kitap|ders notu/i.test(ad)) return "Kitap";
  if (tip === "hvp") return "Video";
  return null;
}

const metin = (text: string, styles: Record<string, boolean> = {}) => ({ type: "text", text, styles });

const blok = (type: string, icerik: unknown[], props: Record<string, unknown> = {}): NoteBlock =>
  ({ type, props, content: icerik });

const paragraf = (text = "") => blok("paragraph", text ? [metin(text)] : []);
const baslik = (text: string, level = 2) => blok("heading", [metin(text)], { level });

export function buildUnitNoteBlocks(
  unit: StudyUnit,
  outcomes: { metin: string }[],
  modules: StudyModule[],
  questions: StudyQuestion[] = [],
): NoteBlock[] {
  const bloklar: NoteBlock[] = [];

  const kunye = [unit.ders_kodu];
  if (unit.dilim) kunye.push(unit.dilim === "vize" ? "Vize kapsamı" : "Final kapsamı");
  if (unit.soru_degeri) kunye.push(`${unit.soru_degeri} soru`);
  if (unit.tahmini_dakika) kunye.push(`~${unit.tahmini_dakika} dk`);
  bloklar.push(blok("paragraph", [metin(kunye.join(" · "), { italic: true })]));

  bloklar.push(baslik("Kazanımlar"));
  if (outcomes.length) {
    for (const o of outcomes) bloklar.push(blok("checkListItem", [metin(o.metin)], { checked: false }));
  } else {
    // Eksikliği sessizce geçmek yerine söylüyoruz: bilginin yokluğu da bilgi.
    bloklar.push(blok("paragraph", [metin("Bu ders için OYS'de ve kitapta kazanım metni yok.", { italic: true })]));
  }

  const okunacak = modules
    .map((m) => ({ m, etiket: materyalEtiketi(m.ad, m.tip) }))
    .filter((x): x is { m: StudyModule; etiket: string } => x.etiket !== null)
    .sort((a, b) => OKUMA_SIRASI.indexOf(a.etiket) - OKUMA_SIRASI.indexOf(b.etiket));
  if (okunacak.length) {
    bloklar.push(baslik("Materyal"));
    for (const { m, etiket } of okunacak) {
      const parcalar: unknown[] = [metin(`${etiket}: `, { bold: true })];
      if (m.oys_url) parcalar.push({ type: "link", href: m.oys_url, content: [metin(m.ad)] });
      else parcalar.push(metin(m.ad));
      bloklar.push(blok("bulletListItem", parcalar));
    }
  }

  bloklar.push(baslik("Özet"), paragraf(), baslik("Anlamadıklarım"), paragraf());

  if (questions.length) {
    bloklar.push(baslik(`Çıkmış sorular (${questions.length})`));
    for (const q of questions) {
      bloklar.push(blok("checkListItem", [metin(`${q.soru_no}. ${q.govde}`)], { checked: false }));
    }
  }

  return bloklar;
}

export function buildUnitNote(
  unit: StudyUnit,
  outcomes: { metin: string }[],
  modules: StudyModule[],
  questions: StudyQuestion[] = [],
): SeededNote {
  return {
    title: `${unit.ders_kodu} · ${unit.baslik}`,
    content: bloklariYaz(buildUnitNoteBlocks(unit, outcomes, modules, questions)),
    tags: ["okul", unit.ders_kodu],
    unitId: unit.id,
    dersKodu: unit.ders_kodu,
    kind: "konu",
  };
}
