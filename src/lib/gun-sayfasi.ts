// Gün sayfası (Plan v3, Faz C) — saf hesaplar.
//
// Takvimdeki çalışma etkinliğine tıklayınca o günün iki dersi tek ekranda
// açılıyor. Ekran `GunSayfasi.tsx`'te; burada yalnız neyin, hangi sırayla
// gösterileceği var. Saf tutuldu ki teste bağlanabilsin.

import type { QuestionAttempt, StudyModule, StudyQuestion } from "./school-data";
import type { UnitProgress } from "./study-plan";
import type { PlanParcasi } from "./haftalik-plan";
import { materyalEtiketi } from "./materyal";

export type SoruDurumu = "cozulmedi" | "yanlis" | "dogru";

/** Sorunun son denemesine göre durumu: önemli olan en son ne yaptığın. */
export function soruDurumlari(denemeler: QuestionAttempt[]): Map<string, SoruDurumu> {
  const son = new Map<string, QuestionAttempt>();
  for (const d of denemeler) {
    const onceki = son.get(d.question_id);
    if (!onceki || d.cozuldu_at > onceki.cozuldu_at) son.set(d.question_id, d);
  }
  return new Map(Array.from(son.entries()).map(([id, d]) => [id, d.dogru_mu ? "dogru" : "yanlis"]));
}

/**
 * Soruların gösterilme sırası: önce hiç çözmediklerin, sonra yanlış
 * yaptıkların, en son doğru bildiklerin. Grup içinde kitaptaki sıra.
 */
export function soruSirasi(sorular: StudyQuestion[], denemeler: QuestionAttempt[]): StudyQuestion[] {
  const durum = soruDurumlari(denemeler);
  const agirlik: Record<SoruDurumu, number> = { cozulmedi: 0, yanlis: 1, dogru: 2 };
  return [...sorular].sort((a, b) =>
    agirlik[durum.get(a.id) ?? "cozulmedi"] - agirlik[durum.get(b.id) ?? "cozulmedi"]
    || (a.bolum_no ?? 0) - (b.bolum_no ?? 0)
    || a.soru_no - b.soru_no);
}

/**
 * Tekrar günü: dersin "Hakimim" denmemiş konuları. Hakim olduğun konuyu
 * sınavdan önceki son günlerde yeniden önüne koymak vakit kaybı.
 */
export function eksikKonular(parcalar: PlanParcasi[], ilerleme: Map<string, UnitProgress>): PlanParcasi[] {
  return parcalar.filter((p) => ilerleme.get(p.unit_id)?.durum !== "hakim");
}

/** Tekrar gününde sorular dersin tamamından; doğru bilinenler sıraya hiç girmez. */
export function tekrarSorulari(sorular: StudyQuestion[], denemeler: QuestionAttempt[]): StudyQuestion[] {
  const durum = soruDurumlari(denemeler);
  return soruSirasi(sorular.filter((s) => durum.get(s.id) !== "dogru"), denemeler);
}

export interface GunMateryali {
  modul: StudyModule;
  etiket: string;
  /** Uygulamanın içindeki PDF okuyucuda açılabiliyorsa depo kimliği. */
  cmid: string | null;
}

/**
 * Konunun materyali gün sayfasındaki sırasıyla: kitap, ses, video, sonra
 * diğerleri. E-Pub (kitabın kopyası) ve çıkmış soru dosyası düşüyor —
 * sorular sayfada ayrıca çözülüyor.
 */
export function gunMateryali(moduller: StudyModule[]): GunMateryali[] {
  const sira = ["Kitap", "Ses", "Video", "Sayfa", "Test", "Dosya", "Klasör"];
  return moduller
    .map((modul) => ({ modul, etiket: materyalEtiketi(modul.ad, modul.tip) }))
    .filter((m) => m.etiket !== "E-Pub" && m.etiket !== "Çıkmış soru")
    .map((m) => ({
      ...m,
      // Depoya yalnız kitap bölümleri yüklendi (<ders>/<cmid>.pdf).
      cmid: m.etiket === "Kitap" ? String(m.modul.id).replace(/^ybs:mod:/, "") : null,
    }))
    .sort((a, b) => {
      const fark = (sira.indexOf(a.etiket) + 1 || 99) - (sira.indexOf(b.etiket) + 1 || 99);
      return fark !== 0 ? fark : a.modul.ad.localeCompare(b.modul.ad, "tr");
    });
}
