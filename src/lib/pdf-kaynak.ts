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

export async function imzaliBaglanti(yol: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(KOVA).createSignedUrl(yol, SURE_SN);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
