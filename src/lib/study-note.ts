// Konu notu şablonu — blok tabanlı.
//
// Boş bir not kutusu öğrenme platformu değil. Bir konuya oturduğunda neyi
// bilmen gerektiği (kazanımlar), neyi okuyacağın (materyal) ve nereye
// yazacağın hazır olmalı. Kazanımlar kutucuk olarak geliyor ki tek tek
// işaretlenebilsin; materyal bağlantılı satır olarak geliyor ki tıklanabilsin.

import { bloklariYaz, type NoteBlock } from "./note-content";
import type { StudyModule, StudyQuestion } from "./school-data";
import type { StudyUnit } from "./study-plan";

/** Kazanım bloğu — outcomeId ile bağlı, metni de taşıyor ki not tek başına okunabilsin. */
const kazanimBlok = (outcomeId: string, unitId: string, metin: string): NoteBlock =>
  ({ type: "kazanim", props: { outcomeId, unitId, metin, checked: false }, content: undefined });

const materyalBlok = (m: StudyModule, etiket: string): NoteBlock =>
  ({ type: "materyal", props: { moduleId: m.id, ad: m.ad, etiket, url: m.oys_url ?? "", dakika: m.tahmini_dakika }, content: undefined });

const soruBlok = (q: StudyQuestion): NoteBlock =>
  ({ type: "soru", props: {
      questionId: q.id, govde: q.govde,
      secenekler: JSON.stringify(q.secenekler ?? []),
      dogru: q.dogru ?? "", verilen: "",
    }, content: undefined });

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
  outcomes: { id?: string; metin: string }[],
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
    for (const o of outcomes) bloklar.push(kazanimBlok(o.id ?? "", unit.id, o.metin));
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
    for (const { m, etiket } of okunacak) bloklar.push(materyalBlok(m, etiket));
  }

  bloklar.push(baslik("Özet"), paragraf(), baslik("Anlamadıklarım"), paragraf());

  if (questions.length) {
    bloklar.push(baslik(`Çıkmış sorular (${questions.length})`));
    for (const q of questions) bloklar.push(soruBlok(q));
  }

  return bloklar;
}

export function buildUnitNote(
  unit: StudyUnit,
  outcomes: { id?: string; metin: string }[],
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
