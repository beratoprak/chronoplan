// Figürlerim: takvimin köşesinde sallanan resimler.
//
// Kullanıcı kendi resimlerini yükler; resim tarayıcıda küçültülüp (en fazla
// 256 px, şeffaflık korunur) `epoche_figurler` tablosuna veri adresi olarak
// yazılır — yalnız sahibi görür, kodda durmaz. Hiç resim yoksa ücretsiz hazır
// figürler (public/figurler, MIT lisanslı) sallanır.

import { supabase } from "./supabase";

export interface Figur { id: string; ad: string | null; resim: string; sira: number }

export const HAZIR_FIGURLER: Figur[] = [
  { id: "hazir:robot", ad: "Robot", resim: "/figurler/robot.png", sira: 0 },
  { id: "hazir:uzayli", ad: "Uzaylı", resim: "/figurler/uzayli.png", sira: 1 },
  { id: "hazir:ejderha", ad: "Ejderha", resim: "/figurler/ejderha.png", sira: 2 },
];

/** Köşede aynı anda en fazla bu kadar figür; daha fazlası ekranı kalabalıklaştırır. */
export const EN_FAZLA = 4;
const ONBELLEK = "epoche-figurler-onbellek";
export const GORUNUR = "epoche-figurler-gorunur";
/** Figürler değişince (ekle/sil/gizle) köşedeki bileşen tazelensin. */
export const DEGISTI = "epoche:figurler";
/** Konu bitince ("Hakimim") figürler sevinir. */
export const KUTLAMA = "epoche:kutlama";

export function onbellektenFigurler(): Figur[] | null {
  try { const x = localStorage.getItem(ONBELLEK); return x ? JSON.parse(x) : null; } catch { return null; }
}

export async function figurleriGetir(userId: string): Promise<Figur[]> {
  const { data, error } = await supabase.from("epoche_figurler").select("id,ad,resim,sira").eq("user_id", userId).order("sira");
  if (error) throw new Error(/epoche_figurler/.test(error.message) ? "Veritabanı güncellemesi bekleniyor (migration-epoche-v15-figurler.sql)" : error.message);
  const liste = (data ?? []) as Figur[];
  try { localStorage.setItem(ONBELLEK, JSON.stringify(liste)); } catch { /* sığmazsa önbelleksiz */ }
  return liste;
}

export async function figurEkle(userId: string, dosya: File, sira: number): Promise<void> {
  const resim = await kucult(dosya);
  const { error } = await supabase.from("epoche_figurler").insert({
    id: `${userId}:${Date.now().toString(36)}`, user_id: userId, ad: dosya.name.replace(/\.[^.]+$/, "").slice(0, 40), resim, sira,
  });
  if (error) throw new Error(/epoche_figurler/.test(error.message) ? "Veritabanı güncellemesi bekleniyor (migration-epoche-v15-figurler.sql)" : error.message);
  window.dispatchEvent(new Event(DEGISTI));
}

export async function figurSil(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("epoche_figurler").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  window.dispatchEvent(new Event(DEGISTI));
}

/** Resmi en uzun kenarı 256 px olacak şekilde küçültür; şeffaflık için WebP (yoksa PNG). */
async function kucult(dosya: File, kenar = 256): Promise<string> {
  if (!dosya.type.startsWith("image/")) throw new Error("Yalnız resim dosyası yüklenebilir");
  const bitmap = await createImageBitmap(dosya);
  const oran = Math.min(1, kenar / Math.max(bitmap.width, bitmap.height));
  const tuval = document.createElement("canvas");
  tuval.width = Math.max(1, Math.round(bitmap.width * oran));
  tuval.height = Math.max(1, Math.round(bitmap.height * oran));
  tuval.getContext("2d")!.drawImage(bitmap, 0, 0, tuval.width, tuval.height);
  let adres = tuval.toDataURL("image/webp", 0.85);
  if (!adres.startsWith("data:image/webp")) adres = tuval.toDataURL("image/png");
  if (adres.length > 390000) throw new Error("Resim küçültüldükten sonra da çok büyük");
  return adres;
}
