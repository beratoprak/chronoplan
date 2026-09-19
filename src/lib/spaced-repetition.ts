// Aralıklı tekrar zamanlaması — SM-2'nin sadeleştirilmiş hali.
//
// Saf hesap: tarih okumaz, veri tabanına bakmaz. "Şimdi" hep parametreyle
// gelir; böylece zamanlama davranışı deterministik olarak test edilebiliyor.
//
// Neden SM-2: kartın zorluğunu kullanıcının kendi değerlendirmesinden öğrenip
// aralığı ona göre açıyor. Sabit aralıklı bir tekrar listesi, kolay kartları
// gereksiz sıklıkta sorup zor kartları seyrek sorardı — yani emeği yanlış yere
// harcardı. Sınava 8 hafta kalan birinde bu fark pahalı.

export type Deger = "tekrar" | "zor" | "iyi" | "kolay";

export interface KartDurumu {
  /** Kolaylık katsayısı; düştükçe aralıklar daralır. */
  ease: number;
  /** Gün cinsinden bir sonraki aralık. */
  interval: number;
  /** Kaç kez arka arkaya hatırlandı. */
  reps: number;
  /** Kaç kez unutuldu. */
  lapses: number;
  /** Bir sonraki gösterim zamanı (ISO). */
  dueAt: string;
  lastReviewedAt?: string | null;
}

export const YENI_KART: Omit<KartDurumu, "dueAt"> = { ease: 2.5, interval: 0, reps: 0, lapses: 0 };

const EN_DUSUK_EASE = 1.3;
const GUN = 86_400_000;

/** Değerlendirmenin kolaylık katsayısına etkisi. */
const EASE_DELTA: Record<Deger, number> = { tekrar: -0.2, zor: -0.15, iyi: 0, kolay: 0.15 };

/** Yeni kart için ilk aralıklar (gün). Unutulan kart hep başa döner. */
const ILK_ARALIK: Record<Deger, number> = { tekrar: 0, zor: 1, iyi: 1, kolay: 3 };

export function yeniKart(simdi: Date | string): KartDurumu {
  return { ...YENI_KART, dueAt: new Date(simdi).toISOString() };
}

/**
 * Kartı değerlendirip yeni zamanlamayı döndürür.
 * "tekrar" aralığı sıfırlar ama kolaylık katsayısını dibe vurdurmaz;
 * tek bir kötü gün kartı kalıcı olarak cezalandırmamalı.
 */
export function degerlendir(kart: KartDurumu, deger: Deger, simdi: Date | string): KartDurumu {
  const an = new Date(simdi);
  const ease = Math.max(EN_DUSUK_EASE, Number((kart.ease + EASE_DELTA[deger]).toFixed(2)));

  let interval: number;
  let reps: number;
  let lapses = kart.lapses;

  if (deger === "tekrar") {
    interval = 0;          // aynı oturumda tekrar sorulur
    reps = 0;
    lapses += 1;
  } else if (kart.reps === 0 || kart.interval === 0) {
    interval = ILK_ARALIK[deger];
    reps = 1;
  } else {
    const carpan = deger === "zor" ? 1.2 : deger === "kolay" ? ease * 1.3 : ease;
    interval = Math.max(1, Math.round(kart.interval * carpan));
    reps = kart.reps + 1;
  }

  return {
    ease,
    interval,
    reps,
    lapses,
    dueAt: new Date(an.getTime() + interval * GUN).toISOString(),
    lastReviewedAt: an.toISOString(),
  };
}

/** Zamanı gelmiş kartlar; en çok geciken önce. */
export function zamaniGelenler<T extends { dueAt: string }>(kartlar: T[], simdi: Date | string): T[] {
  const an = new Date(simdi).getTime();
  return kartlar
    .filter((k) => new Date(k.dueAt).getTime() <= an)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/**
 * Sınava kalan günde bir kartın kaç kez daha gösterileceği.
 * Panelin "bu kart sınavdan önce oturur mu" sorusunu yanıtlaması için.
 */
export function sinavaKadarTekrar(kart: KartDurumu, sinavTarihi: string, simdi: Date | string): number {
  const son = new Date(sinavTarihi).getTime();
  let an = new Date(kart.dueAt).getTime();
  let gecici = { ...kart };
  let sayi = 0;
  while (an <= son && sayi < 20) {
    sayi += 1;
    gecici = degerlendir(gecici, "iyi", new Date(an));
    an = new Date(gecici.dueAt).getTime();
  }
  return sayi;
}
