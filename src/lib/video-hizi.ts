// Video oynatıcının hız düğmesi (6 Kasım) — saf hesap, `VideoOynatici.tsx` kullanır.

export const HIZLAR = [1, 1.25, 1.5, 1.75, 2];

/** Sıradaki hız; listede olmayan bir hızdan 1×'e döner. */
export const sonrakiHiz = (hiz: number) => HIZLAR[(HIZLAR.indexOf(hiz) + 1) % HIZLAR.length];

/** Düğmenin yazısı, Türkçe ondalıkla: "1,25×". */
export const hizYazisi = (hiz: number) => `${String(hiz).replace(".", ",")}×`;
