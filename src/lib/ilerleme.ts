// Konu ilerlemesi — dört adımlı checklist (Plan v3, Faz A).
//
// Saf hesap. YBS motorundaki `src/lib/ilerleme.js` dosyasının TypeScript ikizi.
// İkisi aynı test vakalarıyla korunuyor (`__fixtures__/ilerleme-vakalari.json`,
// motorda aynısı); motorun testi iki kopyanın eşit olduğunu da denetliyor.
// Birini değiştiren diğerini de değiştirmeli — yoksa panel ile `npm run plan`
// farklı rakam söyler.
//
// MODEL
// "Hakimim" işaretliyse konu tamamdır. Değilse Oku · İzle · Soru adımları
// konuyu en fazla %75'e taşır: geri kalanı ancak "biliyorum" demek kapatır.
// Konunun videosu ya da çıkmış sorusu yoksa o adım düşer, kalanlar oranlanır.

export type Adim = "oku" | "izle" | "soru" | "hakim";
export type Adimlar = Partial<Record<Adim, string | null>>;
export type IlerlemeDurumu = "dokunulmadi" | "calisildi" | "test_edildi" | "hakim";

export const ADIMLAR: Adim[] = ["oku", "izle", "soru", "hakim"];

export const ADIM_ETIKETI: Record<Adim, string> = {
  oku: "Oku", izle: "İzle", soru: "Soru çöz", hakim: "Hakimim",
};

/** Hakimim olmadan varılabilecek en yüksek kapsama. */
export const ADIM_TAVANI = 0.75;

/** Hakimim dışındaki adımların göreli ağırlıkları. */
export const ADIM_AGIRLIGI: Record<Exclude<Adim, "hakim">, number> = { oku: 35, izle: 25, soru: 15 };

/** Adımlar gelmeden önceki tek-durumlu model; eski kayıtlar bununla okunur. */
export const DURUM_KATSAYISI: Record<IlerlemeDurumu, number> = {
  dokunulmadi: 0,
  calisildi: 0.7,
  test_edildi: 0.85,
  hakim: 1,
};

export interface IlerlemeKaydi {
  durum?: IlerlemeDurumu | string;
  adimlar?: Adimlar | null;
  /** Konuda var olan adımlar — panel doldurur; yoksa dördü de var sayılır. */
  mevcut?: Adim[];
}

export function mevcutAdimlar({ videolu = true, sorulu = true }: { videolu?: boolean; sorulu?: boolean } = {}): Adim[] {
  return ADIMLAR.filter((a) => (a !== "izle" || videolu) && (a !== "soru" || sorulu));
}

export function isaretliAdimlar(kayit: IlerlemeKaydi | undefined | null, mevcut: Adim[] = ADIMLAR): Adim[] {
  const adimlar = kayit?.adimlar ?? {};
  return mevcut.filter((a) => Boolean(adimlar[a]));
}

/** Konunun ne kadarı sınavda karşılık buluyor (0-1). */
export function ilerlemeKatsayisi(kayit: IlerlemeKaydi | undefined | null, mevcut: Adim[] = ADIMLAR): number {
  if (!kayit) return 0;
  const isaretli = isaretliAdimlar(kayit, mevcut);
  if (isaretli.length === 0) return DURUM_KATSAYISI[kayit.durum as IlerlemeDurumu] ?? 0;
  if (isaretli.includes("hakim")) return 1;
  const toplam = mevcut.filter((a) => a !== "hakim").reduce((n, a) => n + ADIM_AGIRLIGI[a as Exclude<Adim, "hakim">], 0);
  if (toplam === 0) return 0;
  const yapilan = isaretli.reduce((n, a) => n + (a === "hakim" ? 0 : ADIM_AGIRLIGI[a]), 0);
  return Number(((yapilan / toplam) * ADIM_TAVANI).toFixed(4));
}

/** Adımlardan eski `durum` alanını türetir (geriye uyumluluk). */
export function durumuTuret(adimlar: Adimlar = {}): IlerlemeDurumu {
  if (adimlar.hakim) return "hakim";
  if (adimlar.soru) return "test_edildi";
  if (adimlar.oku || adimlar.izle) return "calisildi";
  return "dokunulmadi";
}

/** Konu → var olan adımlar (videosuz konuda İzle, sorusuz konuda Soru düşer). */
export function mevcutAdimHaritasi(
  units: { id: string }[],
  modules: { unit_id: string; tip: string }[],
  questions: { unit_id: string | null }[],
): Map<string, Adim[]> {
  const videolu = new Set(modules.filter((m) => m.tip === "hvp").map((m) => m.unit_id));
  const sorulu = new Set(questions.map((q) => q.unit_id).filter(Boolean) as string[]);
  return new Map(units.map((u) => [u.id, mevcutAdimlar({ videolu: videolu.has(u.id), sorulu: sorulu.has(u.id) })]));
}
