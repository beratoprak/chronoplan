// Sınav programı (Plan v3, Faz H) — saf yardımcılar.

import type { SinavOturumu } from "./school-data";

/** Oturumları gün ve oturuma göre grupla: [[tarih, [[oturum, dersler]]]]. */
export function oturumGruplari(liste: SinavOturumu[]): [string, [number, string[]][]][] {
  const gunler = new Map<string, Map<number, string[]>>();
  for (const o of liste) {
    const gun = gunler.get(o.tarih) ?? new Map<number, string[]>();
    gun.set(o.oturum, [...(gun.get(o.oturum) ?? []), o.ders_kodu]);
    gunler.set(o.tarih, gun);
  }
  return Array.from(gunler.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([tarih, oturumlar]) => [tarih, Array.from(oturumlar.entries()).sort(([a], [b]) => a - b)]);
}
