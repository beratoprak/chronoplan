// Ders PDF'lerine erişim.
//
// Dosyalar Supabase Storage'da özel bir kovada; tarayıcı doğrudan açamıyor,
// kısa ömürlü imzalı bağlantı gerekiyor. Depolama yolu kimlikten türetiliyor
// (<ders>/<cmid>.pdf), bu yüzden yolu saklayacak bir kolon yok — bir kimlik
// iki yerde tutulursa er geç ayrışır.

import { supabase } from "./supabase";

const KOVA = "ders-materyali";
/** Bir saat: okuma oturumu için fazlasıyla yeterli, sızsa bile kısa ömürlü. */
const SURE_SN = 3600;

export function depoYolu(dersKodu: string, cmid: number | string): string {
  // Depoda ASCII ders kodu kullanıldı; Türkçe harfli kodlar yol olarak sorunlu.
  const ascii = dersKodu
    .replace(/İ/g, "I").replace(/ı/g, "i").replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g").replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ö/g, "O").replace(/ö/g, "o").replace(/Ç/g, "C").replace(/ç/g, "c");
  return `${ascii}/${cmid}.pdf`;
}

/** Neden açılamadı — okuyucu doğru cümleyi kurabilsin diye ayırt ediliyor. */
export type KaynakHatasi = "izin" | "yok" | "ag";

export interface KaynakSonucu {
  url: string | null;
  hata?: KaynakHatasi;
}

/**
 * İmzalı bağlantı üretir; başarısızsa sebebini söyler.
 *
 * RLS, olmayan dosya ile görme hakkı olmayan dosyayı aynı şekilde saklıyor:
 * ikisine de "NoSuchKey" diyor. Kovada okuma politikası yoksa bütün dosyalar
 * böyle görünür — ve okuyucu "dosya yüklenmemiş olabilir" diye yanlış teşhis
 * koyuyordu; dosya oradaydı, görme hakkı yoktu. Klasörü listeleyerek ayırt
 * ediyoruz: liste de boşsa sorun tek dosyada değil, izinde.
 */
export async function imzaliBaglantiDetayli(yol: string): Promise<KaynakSonucu> {
  const { data, error } = await supabase.storage.from(KOVA).createSignedUrl(yol, SURE_SN);
  if (data?.signedUrl) return { url: data.signedUrl };

  const mesaj = (error as { message?: string } | null)?.message ?? "";
  if (/failed to fetch|network/i.test(mesaj)) return { url: null, hata: "ag" };

  const klasor = yol.split("/")[0];
  const { data: liste } = await supabase.storage.from(KOVA).list(klasor, { limit: 1 });
  return { url: null, hata: liste && liste.length > 0 ? "yok" : "izin" };
}

export async function imzaliBaglanti(yol: string): Promise<string | null> {
  return (await imzaliBaglantiDetayli(yol)).url;
}
