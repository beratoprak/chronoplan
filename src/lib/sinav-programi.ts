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

export interface BelgeSonucu {
  /** Belgede bulunan ve kullanıcının dersleriyle eşleşen oturumlar. */
  satirlar: { ders_kodu: string; tarih: string; oturum: number }[];
  /** Belgede geçen ama kullanıcının ders listesinde olmayan kodlar. */
  bilinmeyen: string[];
}

/**
 * Sınav giriş belgesinin metninden (9 Kasım; ANKUZEF/OYS biçimi) oturumları
 * çıkarır. Her "… OTURUMU" başlığından sonraki bölümde dersler "(KOD) Ad",
 * tarih "GG.AA.YYYY" ve saat "SS:DD" olarak yazıyor. Oturum numarası aynı
 * günün oturumları saate göre sıralanarak verilir. Kimlik bilgisine bakılmaz.
 */
export function girisBelgesiCoz(metin: string, dersKodlari: string[]): BelgeSonucu {
  const temiz = metin.normalize("NFC");
  const govde = temiz.split(/ÖNEMLİ UYARILAR/)[0];
  const bolumler = govde.split(/OTURUMU/).slice(1);
  const bilinen = new Set(dersKodlari.map((k) => k.normalize("NFC")));
  const oturumlar: { tarih: string; saat: string; kodlar: string[] }[] = [];
  for (const b of bolumler) {
    const tarih = b.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    if (!tarih) continue;
    const saat = b.slice(tarih.index).match(/\b(\d{2}):(\d{2})\b/)?.[0] ?? "00:00";
    const kodlar = Array.from(b.matchAll(/\(([A-ZÇĞİÖŞÜ]{2,6}\d{2,4})\)/g), (m) => m[1]);
    if (kodlar.length) oturumlar.push({ tarih: `${tarih[3]}-${tarih[2]}-${tarih[1]}`, saat, kodlar });
  }
  const satirlar: BelgeSonucu["satirlar"] = [];
  const bilinmeyen: string[] = [];
  for (const o of oturumlar) {
    const ayniGun = oturumlar.filter((x) => x.tarih === o.tarih).sort((a, b) => a.saat.localeCompare(b.saat));
    const oturum = ayniGun.indexOf(o) + 1;
    for (const kod of o.kodlar) {
      if (bilinen.has(kod)) satirlar.push({ ders_kodu: kod, tarih: o.tarih, oturum });
      else if (!bilinmeyen.includes(kod)) bilinmeyen.push(kod);
    }
  }
  return { satirlar, bilinmeyen };
}
