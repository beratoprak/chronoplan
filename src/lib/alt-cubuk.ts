import type { ViewType } from "@/types";

/**
 * Telefonun alt çubuğunda "+" düğmesinin yanında duran ekranlar.
 * Kullanıcı "Daha fazla" sayfasından seçer; seçim bu cihazda saklanır.
 * Çubuğun en sağında her zaman "Menü" durur (başparmağın yetiştiği yer).
 */
export const ALT_CUBUK_SAYI = 3;
export const VARSAYILAN_ALT_CUBUK: ViewType[] = ["daily", "kanban", "notes"];
const ANAHTAR = "epoche-alt-cubuk";
export const ALT_CUBUK_DEGISTI = "epoche:alt-cubuk";

export function altCubuguOku(): ViewType[] {
  try {
    const ham = JSON.parse(localStorage.getItem(ANAHTAR) ?? "null");
    if (Array.isArray(ham) && ham.length > 0) return ham.slice(0, ALT_CUBUK_SAYI) as ViewType[];
  } catch {}
  return VARSAYILAN_ALT_CUBUK;
}

export function altCubuguYaz(secim: ViewType[]): void {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(secim.slice(0, ALT_CUBUK_SAYI)));
  } catch {}
  window.dispatchEvent(new Event(ALT_CUBUK_DEGISTI));
}

/** Seçiliyse çıkarır; değilse ekler (dolduysa en eskisinin yerine). */
export function altCubukDegistir(secim: ViewType[], id: ViewType): ViewType[] {
  if (secim.includes(id)) return secim.length > 1 ? secim.filter((v) => v !== id) : secim;
  const yeni = [...secim, id];
  return yeni.length > ALT_CUBUK_SAYI ? yeni.slice(yeni.length - ALT_CUBUK_SAYI) : yeni;
}
