// Konu notu şablonu.
//
// Boş bir not kutusu öğrenme platformu değil. Bir konuya not almaya oturduğunda
// neyi bilmen gerektiği (kazanımlar), neyi okuyacağın (materyal) ve nereye
// yazacağın (özet / anlamadıklarım) hazır olmalı. Şablon bunu kuruyor;
// kazanımlar kutucuk olarak geliyor ki tek tek işaretlenebilsin.

import type { StudyModule, StudyQuestion } from "./school-data";
import type { StudyUnit } from "./study-plan";

export interface SeededNote {
  title: string;
  content: string;
  tags: string[];
}

const OKUMA_SIRASI = ["Kitap", "Ses", "Video"];

function materyalEtiketi(ad: string, tip: string) {
  if (/e-?pub/i.test(ad)) return "E-Pub";
  if (/podcast|ses metni/i.test(ad)) return "Ses";
  if (/çıkmış|örnek soru/i.test(ad)) return "Çıkmış soru";
  if (/kitap|ders notu/i.test(ad)) return "Kitap";
  if (tip === "hvp") return "Video";
  if (tip === "quiz") return "Test";
  return null;
}

export function buildUnitNote(
  unit: StudyUnit,
  outcomes: { metin: string }[],
  modules: StudyModule[],
  questions: StudyQuestion[] = [],
): SeededNote {
  const satirlar: string[] = [];
  satirlar.push(`# ${unit.baslik}`);

  const kunye = [unit.ders_kodu];
  if (unit.dilim) kunye.push(unit.dilim === "vize" ? "Vize kapsamı" : "Final kapsamı");
  if (unit.soru_degeri) kunye.push(`${unit.soru_degeri} soru`);
  if (unit.tahmini_dakika) kunye.push(`~${unit.tahmini_dakika} dk`);
  satirlar.push(kunye.join(" · "), "");

  if (outcomes.length) {
    satirlar.push("## Kazanımlar", "");
    for (const o of outcomes) satirlar.push(`☐ ${o.metin}`);
    satirlar.push("");
  } else {
    // Kazanım yoksa sessizce atlamak yerine söylüyoruz: eksikliğin kendisi bilgi.
    satirlar.push("## Kazanımlar", "", "Bu ders için OYS'de ve kitapta kazanım metni yok.", "");
  }

  const okunacak = modules
    .map((m) => ({ m, etiket: materyalEtiketi(m.ad, m.tip) }))
    .filter((x) => x.etiket && OKUMA_SIRASI.includes(x.etiket))
    .sort((a, b) => OKUMA_SIRASI.indexOf(a.etiket!) - OKUMA_SIRASI.indexOf(b.etiket!));
  if (okunacak.length) {
    satirlar.push("## Materyal", "");
    for (const { m, etiket } of okunacak) {
      satirlar.push(m.oys_url ? `- ${etiket}: ${m.ad} — ${m.oys_url}` : `- ${etiket}: ${m.ad}`);
    }
    satirlar.push("");
  }

  satirlar.push("## Özet", "", "", "## Anlamadıklarım", "", "");

  if (questions.length) {
    satirlar.push(`## Çıkmış sorular (${questions.length})`, "");
    for (const q of questions) satirlar.push(`☐ ${q.soru_no}. ${q.govde}`);
    satirlar.push("");
  }

  return {
    title: `${unit.ders_kodu} · ${unit.baslik}`,
    content: satirlar.join("\n"),
    tags: ["okul", unit.ders_kodu, unit.dilim ?? "konu"],
  };
}
