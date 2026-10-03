// PDF çalışma alanı: vurgular ve PDF'in yanındaki notlar.
//
// Vurgu kutuları sayfaya oranla (0-1) tutulur: yakınlaştırma ya da ekran
// değişse de vurgu metnin üstünde kalır. Notlar PDF başına tek bir metin;
// yazdıkça kendiliğinden kaydedilir. Tablolar: migration v16.

import { supabase } from "./supabase";

export interface Kutu { x: number; y: number; w: number; h: number }
export type IsaretTuru = "vurgu" | "alti";
export interface Isaret {
  id: string;
  belge: string;
  sayfa: number;
  tur: IsaretTuru;
  renk: string;
  kutular: Kutu[];
  metin: string | null;
}

export const RENKLER: Record<string, string> = {
  sari: "rgba(255, 214, 10, 0.42)",
  yesil: "rgba(52, 199, 89, 0.32)",
  pembe: "rgba(255, 55, 140, 0.28)",
};

const tabloHatasi = (m: string) =>
  /epoche_pdf_/.test(m) ? "Veritabanı güncellemesi bekleniyor (migration-epoche-v16-pdf-calisma.sql)" : m;

/**
 * Seçimin ekran dikdörtgenlerini sayfaya oranla kutulara çevirir. Aynı satırdaki
 * parçalar birleştirilir; sayfa dışına taşan ve çok küçük parçalar atılır.
 */
export function kutulariHesapla(dikdortgenler: { left: number; top: number; width: number; height: number }[], sayfa: { left: number; top: number; width: number; height: number }): Kutu[] {
  const kutular = dikdortgenler
    .filter((r) => r.width > 1 && r.height > 1)
    .map((r) => ({
      x: (r.left - sayfa.left) / sayfa.width,
      y: (r.top - sayfa.top) / sayfa.height,
      w: r.width / sayfa.width,
      h: r.height / sayfa.height,
    }))
    .filter((k) => k.x > -0.01 && k.y > -0.01 && k.x + k.w < 1.01 && k.y + k.h < 1.01)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const birlesik: Kutu[] = [];
  for (const k of kutular) {
    const son = birlesik[birlesik.length - 1];
    // Aynı satır: dikeyde büyük ölçüde örtüşüyor ve yatayda bitişik.
    if (son && Math.abs(son.y - k.y) < son.h * 0.5 && k.x <= son.x + son.w + 0.01) {
      const sag = Math.max(son.x + son.w, k.x + k.w);
      const alt = Math.max(son.y + son.h, k.y + k.h);
      son.x = Math.min(son.x, k.x); son.y = Math.min(son.y, k.y);
      son.w = sag - son.x; son.h = alt - son.y;
    } else {
      birlesik.push({ ...k });
    }
  }
  return birlesik.map((k) => ({ x: +k.x.toFixed(4), y: +k.y.toFixed(4), w: +k.w.toFixed(4), h: +k.h.toFixed(4) }));
}

export async function isaretleriGetir(userId: string, belge: string): Promise<Isaret[]> {
  const { data, error } = await supabase.from("epoche_pdf_isaret")
    .select("id,belge,sayfa,tur,renk,kutular,metin").eq("user_id", userId).eq("belge", belge).order("sayfa").order("olusturma");
  if (error) throw new Error(tabloHatasi(error.message));
  return (data ?? []) as Isaret[];
}

export async function isaretEkle(userId: string, isaret: Omit<Isaret, "id">): Promise<Isaret> {
  const satir = { ...isaret, id: `${userId}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, user_id: userId };
  const { error } = await supabase.from("epoche_pdf_isaret").insert(satir);
  if (error) throw new Error(tabloHatasi(error.message));
  return { id: satir.id, belge: satir.belge, sayfa: satir.sayfa, tur: satir.tur, renk: satir.renk, kutular: satir.kutular, metin: satir.metin };
}

export async function isaretSil(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("epoche_pdf_isaret").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(tabloHatasi(error.message));
}

export async function notuGetir(userId: string, belge: string): Promise<string> {
  const { data, error } = await supabase.from("epoche_pdf_not").select("metin").eq("id", `${userId}:${belge}`).maybeSingle();
  if (error) throw new Error(tabloHatasi(error.message));
  return (data?.metin as string | undefined) ?? "";
}

export async function notuKaydet(userId: string, belge: string, metin: string): Promise<void> {
  const { error } = await supabase.from("epoche_pdf_not").upsert(
    { id: `${userId}:${belge}`, user_id: userId, belge, metin, guncelleme: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(tabloHatasi(error.message));
}
