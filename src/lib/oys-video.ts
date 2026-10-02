// OYS video aracısı (Plan v3, Faz F) — sunucu tarafı saf yardımcılar.
//
// OYS videoları mobil anahtarla, parça parça (Range) indirilebiliyor. Anahtar
// tarayıcıya hiç gitmez: tarayıcı Epoche'ye kısa ömürlü, imzalı bir adres
// sorar; Epoche videoyu OYS'den alıp parça parça iletir. Kopya saklanmaz.
//
// Bu dosya yalnız sunucuda kullanılır (node:crypto).

import { createHmac, timingSafeEqual } from "node:crypto";

/** Motorun yazdığı biçim; ikisi aynı kalmalı (ybs-panel/src/oys/mobil.js → VIDEO_YOLU). */
export const VIDEO_YOLU = /^\d+\/mod_hvp\/content\/\d+\/videos\/[A-Za-z0-9._-]+\.(mp4|webm|m4v)$/;

/** Bir yanıtta en fazla bu kadar bayt: Vercel işlevi kısa sürede bitsin, oynatıcı sıradakini ister. */
export const PARCA = 8 * 1024 * 1024;

/** İmzalı adres ömrü: bir çalışma oturumu boyunca yeter. */
export const OMUR_SN = 6 * 60 * 60;

export function imzala(yol: string, bitis: number, gizli: string): string {
  return createHmac("sha256", `epoche-oys-video:${gizli}`).update(`${yol}|${bitis}`).digest("base64url");
}

export function imzaGecerli(yol: string, bitis: number, imza: string, gizli: string, simdi = Date.now() / 1000): boolean {
  if (!VIDEO_YOLU.test(yol) || !Number.isFinite(bitis) || bitis < simdi) return false;
  const beklenen = Buffer.from(imzala(yol, bitis, gizli));
  const gelen = Buffer.from(imza);
  return beklenen.length === gelen.length && timingSafeEqual(beklenen, gelen);
}

/**
 * Tarayıcının istediği aralığı bir parçayla sınırlar. Oynatıcılar genelde
 * "bytes=0-" (sonuna kadar) ister; yanıt kısa tutulur, 206 + Content-Range ile
 * oynatıcı kalanını kendisi ister. İleri sarma da böyle çalışır.
 */
export function araligiSinirla(baslik: string | null, parca = PARCA): string {
  const m = baslik?.match(/^bytes=(\d+)-(\d*)$/);
  const bas = m ? Number(m[1]) : 0;
  const istenenSon = m?.[2] ? Number(m[2]) : Infinity;
  const son = Math.min(istenenSon, bas + parca - 1);
  return `bytes=${bas}-${son}`;
}
