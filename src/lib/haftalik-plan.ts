// Haftalık planlayıcı — saf hesap (Plan v3 Faz B; v4 26 Ekim).
//
// Ağ yok, saat okuma yok: "bugün" ve bütün veri parametreyle gelir. Bu
// sayede her kural teste bağlanabiliyor. Kaydetme ve takvime yazma ayrı
// dosyada (`haftalik-plan-kayit.ts`).
//
// KURALLAR (PLAN-SISTEM.md, bölüm 9 — v4)
// 1. Önce eşik: 20 soruda 12'nin altındaki dersler öne alınır.
// 2. Günde 1 ya da 2 ders. Günün ana dersinden konular BÜTÜN alınır; günün
//    işi küçük kalırsa ikinci ders eklenir. Günlük yükü bütçeden çok aşan konu
//    bölünür ("devam"). Süre öğrenciye gösterilmez, yalnız dengelemek için.
// 3. Aynı ders üst üste iki gün gelmez — başka ders kalmamışsa gelir.
// 4. Günlük bütçe sabit değil: kalan iş / kalan çalışma günü (taban–tavan).
// 5. Boş gün: yük rahatsa her pazar boş, gerideyse boş gün yok.
// 6. Son düzlük (sınava ≤ 14 gün): her dersi geçme çizgisine (sığarsa
//    güvenlik payıyla) taşıyacak konular seçilir, en verimliler önce; sığmayan
//    konular bilerek bırakılır ve söylenir.
// 7. Sınavdan önceki son `tekrarGunu` gün yeni konu yok, yalnız tekrar.
// 8. Kurtarma (6 Kasım): son düzlükte 12 doğruya yetecek konular bile
//    günlere sığmıyorsa tekrar yalnız sınavdan önceki gün, en az işi kalan
//    ders önce bitirilir ve her konuya çıkmış sorulardan başlanır.
// 9. Kurtarmada ana dersler önce (9 Kasım): günün ana dersi çekirdek bir ders;
//    kısa dersler (Türk Dili, Atatürk, BİT) ikinci sırada, günde en fazla bir
//    konu. Yabancı dil kurtarmada plana hiç girmez (Berat, 9 Kasım: "İngilizcem
//    iyi"; zaten sistemde çıkmış sorusu yok).
//    Oturumlar biliniyorsa sınavdan önceki gün o günün bütün dersleri tekrar
//    edilir, ilk sınav gününün öğleden sonrası ertesi günün dersleri.
//
// Konular normalde dersin kendi sırasıyla gelir (konu_no). Son düzlükte
// sıralı olmayan derslerde kısa (soru başına ucuz) konular öne alınır;
// Matematik gibi birbirine dayanan derslerde sıra hiç bozulmaz.

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { dersDurumlari, ESIK_SORU, type StudyUnit, type UnitProgress } from "./study-plan";
import { ADIMLAR, ilerlemeKatsayisi } from "./ilerleme";

/** Sınava bu kadar gün kala son düzlük planı kurulur. */
export const SON_DUZLUK_GUNU = 14;

/** Konuları birbirine dayanan dersler: son düzlükte bile sırası bozulmaz. */
const SIRALI_DERSLER = new Set(["AAUF1105", "AYBS1201", "AAUF1201", "AAUF1101"]);
/** Kurtarmada zinciri kopmasın diye bir günde üç konuya kadar ilerleyen dersler (Matematik). */
const ZINCIRLI_DERSLER = new Set(["AAUF1105", "AYBS1201"]);

/** Günlük iç bütçe sınırları (dakika). Öğrenciye gösterilmez. */
const TABAN_DK = 45;
const TAVAN_DK = 150;
/** Kalan iş günde bundan azını istiyorsa pazarlar boş bırakılır. */
const RAHAT_DK = 90;
/** Son düzlükte güvenlik payı adayları: 16 sorudan geriye, en az 12. */
const HEDEF_ADAYLARI = [16, 15, 14, 13, ESIK_SORU];
/** Kurtarma modunda yalnız sınavdan önceki gün tekrar. */
export const KURTARMA_TEKRAR_GUNU = 1;
/** Kurtarmada plana hiç girmeyen dersler: yabancı dil. */
export const kurtarmadaDisarida = (kod: string) => kod.startsWith("AYDİ");
/** Kurtarmada kısa derse günde en az bu kadar yer (konu uzunsa bölünür). */
const KISA_DERS_DK = 45;
/** Günün ana dersinden en fazla bu kadar konu; kalan yer ikinci derse. */
const GUNLUK_KONU = 2;

export interface PlanGirdisi {
  units: StudyUnit[];
  ilerleme: Map<string, UnitProgress>;
  /** En yakın sınavın ilk günü (YYYY-MM-DD). */
  sinavTarihi: string;
  dilim: "vize" | "final";
  /** Planın ilk günü — çoğunlukla bugün ya da gelecek pazartesi. */
  baslangic: string;
  /** Planın son günü. */
  bitis: string;
  /** Günlük bütçeyi sabitlemek için (test). Yoksa kalan işe göre hesaplanır. */
  gunlukDakika?: number;
  /** Konu → süre çarpanı (Faz G'de Gemini tahmini). Yoksa 1. */
  zorluk?: Map<string, number>;
  /** Sınavdan önceki kaç gün yalnız tekrar. */
  tekrarGunu?: number;
  /** Sınav kaç gün sürüyor (Cmt+Paz = 2). */
  sinavGunSayisi?: number;
  /** Boş gün kararı: "otomatik" (varsayılan) ya da hiç. */
  bosGun?: "otomatik" | "yok";
  /**
   * Ders → sınav anı (Faz H, oturum dağılımı ilan edilince). Varsa tekrar
   * günlerinde aynı oturumdaki dersler aynı güne konur ve sınavı en erken
   * olan oturum en son (sınava en yakın) tekrar edilir.
   */
  oturumlar?: Map<string, { tarih: string; oturum: number }>;
}

export interface PlanParcasi {
  unit_id: string;
  baslik: string;
  dakika: number;
  /** Konu daha önceki bir güne başlanmış. */
  devam: boolean;
  /** Bu parça konuyu bitiriyor. */
  bitiyor: boolean;
  /** Kurtarma modu: konuya çıkmış sorulardan başlanır. */
  kurtarma?: boolean;
}

export interface PlanDersi {
  ders_kodu: string;
  tur: "konu" | "tekrar";
  dakika: number;
  parcalar: PlanParcasi[];
}

/** "bos": sınavdan önce dinlenme günü, sınavdan sonra planı olmayan gün. */
export type GunTuru = "calisma" | "tekrar" | "sinav" | "bos";

export interface PlanGunu {
  tarih: string;
  tur: GunTuru;
  dersler: PlanDersi[];
}

export interface HaftalikPlan {
  gunler: PlanGunu[];
  /** "son-duzluk": sınava ≤ 14 gün, seçici plan. "kurtarma": seçilenler de sığmıyor. */
  mod: "normal" | "son-duzluk" | "kurtarma";
  /** Son düzlükte her dersin taşınacağı soru sayısı; normalde null (hepsi). */
  hedef_soru: number | null;
  /** Son düzlükte bilerek bırakılan konular. */
  birakilan: string[];
  /** Pazarlar boş bırakıldı mı. */
  bos_gun: boolean;
  /** Sınava kadar (tekrar günleri hariç) çalışma günü. */
  calisma_gunu: number;
  /** İç hesaplar — öğrenciye gösterilmez. */
  sinava_kadar_kapasite_dk: number;
  esik_icin_gereken_dk: number;
  tamami_icin_gereken_dk: number;
  uyarilar: string[];
}

interface Kuyruk {
  unit: StudyUnit;
  kalan: number;
  baslangic: number;
  /** Bu konu bitince derse eklenecek soru. */
  kazanc: number;
  /** Konuya başlanmış (en az bir adım işaretli). */
  basladi: boolean;
}

interface DersHali {
  ders_kodu: string;
  kuyruk: Kuyruk[];
  /** Eşiğe varmak için gereken dakika (planlama ilerledikçe azalır). */
  esikIhtiyaci: number;
  toplamKalan: number;
  /** Planlama başındaki değerler — ilerleme oranı bunlara göre ölçülür. */
  ilkEsik: number;
  ilkToplam: number;
}

const tarihStr = (d: Date) => format(d, "yyyy-MM-dd");

/** Bundan kısa konu parçası ayrı bir güne bırakılmaz. */
const KIRINTI = 15;

/** Başlanmış konu önce, sonra soru başına en ucuz konu. */
function verimSirasi(a: Kuyruk, b: Kuyruk): number {
  return Number(b.basladi) - Number(a.basladi)
    || a.kalan / Math.max(0.1, a.kazanc) - b.kalan / Math.max(0.1, b.kazanc)
    || (a.unit.konu_no ?? 0) - (b.unit.konu_no ?? 0);
}

/**
 * Bir dersin konu kuyruğu ve eşiğe kadar gereken süre.
 * `hedef` verilirse kuyruk o soru sayısına ulaşınca kesilir (son düzlük).
 */
function dersHalleri(
  units: StudyUnit[], ilerleme: Map<string, UnitProgress>,
  { zorluk, hedef, secici }: { zorluk?: Map<string, number>; hedef?: number | null; secici?: boolean } = {},
): { dersler: DersHali[]; birakilan: string[] } {
  const durumlar = new Map(dersDurumlari(units, ilerleme).map((d) => [d.ders_kodu, d]));
  const kuyruklar = new Map<string, Kuyruk[]>();
  const sirali = [...units]
    .filter((u) => u.tip === "konu")
    .sort((a, b) => a.ders_kodu.localeCompare(b.ders_kodu) || (a.konu_no ?? 0) - (b.konu_no ?? 0));
  for (const u of sirali) {
    const kayit = ilerleme.get(u.id);
    const k = ilerlemeKatsayisi(kayit, kayit?.mevcut ?? ADIMLAR);
    if (k >= 1) continue;
    const kalan = Math.round(u.tahmini_dakika * (1 - k) * (zorluk?.get(u.id) ?? 1));
    if (kalan <= 0) continue;
    const kuyruk = kuyruklar.get(u.ders_kodu) ?? [];
    kuyruk.push({ unit: u, kalan, baslangic: kalan, kazanc: u.soru_degeri * (1 - k), basladi: k > 0 });
    kuyruklar.set(u.ders_kodu, kuyruk);
  }
  const dersler: DersHali[] = [];
  const birakilan: string[] = [];
  for (const [ders_kodu, ham] of Array.from(kuyruklar.entries())) {
    const kuyruk = secici && !SIRALI_DERSLER.has(ders_kodu) ? [...ham].sort(verimSirasi) : ham;
    const kapsanan = durumlar.get(ders_kodu)?.kapsanan ?? 0;
    let esigeKalan = durumlar.get(ders_kodu)?.esige_kalan ?? ESIK_SORU;
    let esikIhtiyaci = 0;
    // Eşiğe varana kadar konular sırayla çalışılırsa ne kadar sürer.
    for (const q of kuyruk) {
      if (esigeKalan <= 0) break;
      const oran = Math.min(1, esigeKalan / q.kazanc);
      esikIhtiyaci += Math.round(q.kalan * oran);
      esigeKalan -= q.kazanc;
    }
    // Son düzlük: hedefe ulaşınca kuyruğu kes. Konu bütün alınır.
    let tutulan = kuyruk;
    if (hedef != null) {
      let birikim = kapsanan;
      tutulan = [];
      for (const q of kuyruk) {
        if (birikim >= hedef - 0.01) { birakilan.push(q.unit.id); continue; }
        tutulan.push(q);
        birikim += q.kazanc;
      }
      // Seçim verimle yapıldı; çalışma sırası yine konunun kendi sırası.
      tutulan.sort((a, b) => Number(b.basladi) - Number(a.basladi) || (a.unit.konu_no ?? 0) - (b.unit.konu_no ?? 0));
    }
    if (!tutulan.length) continue;
    const toplamKalan = tutulan.reduce((n, q) => n + q.kalan, 0);
    dersler.push({ ders_kodu, kuyruk: tutulan, esikIhtiyaci, toplamKalan, ilkEsik: esikIhtiyaci, ilkToplam: toplamKalan });
  }
  return { dersler, birakilan };
}

/**
 * Bir dersin kuyruğundan bütçe kadar konu alır. Konular bütün alınır; ilk
 * konu bütçeyi çok aşıyorsa bölünür. İkinci ve sonraki konular ancak bütçeye
 * (küçük bir payla) sığarsa eklenir.
 */
function konuAl(ders: DersHali, butce: number, bolunebilir = true, enFazla = GUNLUK_KONU): PlanParcasi[] {
  const parcalar: PlanParcasi[] = [];
  let kalanButce = butce;
  const pay = Math.max(15, Math.round(butce * 0.25));
  while (ders.kuyruk.length) {
    const q = ders.kuyruk[0];
    const ilk = parcalar.length === 0;
    let alinan: number;
    if (q.kalan <= kalanButce + (ilk ? pay : 10)) {
      alinan = q.kalan;
    } else if (ilk && bolunebilir) {
      // Konu tek güne sığmıyor: bütçe kadarını al, ucunda kırıntı bırakma.
      alinan = Math.min(q.kalan, Math.max(KIRINTI, kalanButce));
      if (q.kalan - alinan < KIRINTI) alinan = q.kalan;
    } else {
      break;
    }
    parcalar.push({
      unit_id: q.unit.id,
      baslik: q.unit.baslik,
      dakika: alinan,
      devam: q.kalan < q.baslangic,
      bitiyor: alinan === q.kalan,
    });
    q.kalan -= alinan;
    kalanButce -= alinan;
    ders.toplamKalan -= alinan;
    ders.esikIhtiyaci = Math.max(0, ders.esikIhtiyaci - alinan);
    if (q.kalan <= 0) ders.kuyruk.shift();
    if (kalanButce < KIRINTI || parcalar.length >= enFazla) break;
  }
  return parcalar;
}

/**
 * Sıradaki ders.
 *
 * Eşik altındaki dersler önce gelir. Aralarındaki sıra "kendi ihtiyacına
 * oranla en az ilerlemiş ders önce": ilk denemede "eşiğe en çok işi kalan
 * önce" kuralı Türk Dili ve Atatürk'ü iki hafta hiç getirmiyordu. Oranla
 * seçince dokuz dersin hepsi döner, büyük dersler daha sık gelir ve hepsi
 * sınava doğru birlikte ilerler. Dün çalışılan ders sona kalır.
 */
function dersSirasi(dersler: DersHali[], dun: Set<string>, haric: Set<string>, kurtarma = false): DersHali[] {
  const aday = dersler.filter((d) => d.toplamKalan > 0 && !haric.has(d.ders_kodu));
  const esikAltinda = (d: DersHali) => d.esikIhtiyaci > 0;
  const oran = (d: DersHali) => esikAltinda(d)
    ? 1 - d.esikIhtiyaci / Math.max(1, d.ilkEsik)
    : 1 - d.toplamKalan / Math.max(1, d.ilkToplam);
  // Kurtarma: eşiğe en az işi kalan ders önce — hızlı dersler önce güvenceye alınır.
  const sirala = (liste: DersHali[]) => [...liste].sort((a, b) =>
    Number(esikAltinda(b)) - Number(esikAltinda(a))
    || (kurtarma ? a.esikIhtiyaci - b.esikIhtiyaci : 0)
    || oran(a) - oran(b)
    || b.esikIhtiyaci - a.esikIhtiyaci
    || a.ders_kodu.localeCompare(b.ders_kodu));
  const taze = sirala(aday.filter((d) => !dun.has(d.ders_kodu)));
  const tekrar = sirala(aday.filter((d) => dun.has(d.ders_kodu)));
  return [...taze, ...tekrar];
}

const dersSec = (dersler: DersHali[], dun: Set<string>, haric: Set<string>, kurtarma = false) => dersSirasi(dersler, dun, haric, kurtarma)[0] ?? null;

/**
 * Tekrar sırası: en az kapsanan dersler önce. Oturumlar biliniyorsa (Faz H)
 * tekrar günlerine sığan dersler sınav anına göre dizilir: en geç sınav ilk
 * tekrar gününe, en erken sınav son güne; aynı oturum yan yana, yani aynı gün.
 */
export function tekrarSirasi(
  units: StudyUnit[], ilerleme: Map<string, UnitProgress>,
  oturumlar?: Map<string, { tarih: string; oturum: number }>, sigan = Infinity,
): string[] {
  const durumlar = dersDurumlari(units, ilerleme)
    .sort((a, b) => a.kapsanan / ESIK_SORU - b.kapsanan / ESIK_SORU || a.ders_kodu.localeCompare(b.ders_kodu))
    .map((d) => d.ders_kodu);
  if (!oturumlar?.size) return durumlar;
  const an = (kod: string) => {
    const o = oturumlar.get(kod);
    return o ? `${o.tarih}#${String(o.oturum).padStart(2, "0")}` : "";
  };
  const secilen = durumlar.slice(0, sigan);
  const disarda = durumlar.slice(sigan);
  // Oturumu bilinmeyen ders en başa (sınavı en uzak sayılır); stabil sıralama kapsanmayı korur.
  return [...secilen].sort((a, b) => (an(b) || "~").localeCompare(an(a) || "~")).concat(disarda);
}

/** Tekrar günleri: sıradaki dersler, her gün farklı grup. */
function tekrarDersleri(units: StudyUnit[], ilerleme: Map<string, UnitProgress>, sira: number, adet: number, siralama?: string[]): PlanDersi[] {
  const kodlar = siralama ?? tekrarSirasi(units, ilerleme);
  if (!kodlar.length) return [];
  const secilen: PlanDersi[] = [];
  for (let i = 0; i < adet && i < kodlar.length; i++) {
    const kod = kodlar[(sira * adet + i) % kodlar.length];
    if (secilen.some((s) => s.ders_kodu === kod)) continue;
    const konular = units
      .filter((u) => u.tip === "konu" && u.ders_kodu === kod)
      .sort((a, b) => (a.konu_no ?? 0) - (b.konu_no ?? 0))
      .map((u) => ({ unit_id: u.id, baslik: u.baslik, dakika: 0, devam: false, bitiyor: false }));
    secilen.push({ ders_kodu: kod, tur: "tekrar", dakika: 0, parcalar: konular });
  }
  return secilen;
}

const sinirla = (dk: number) => Math.min(TAVAN_DK, Math.max(TABAN_DK, Math.round(dk)));

export function haftalikPlanKur(g: PlanGirdisi): HaftalikPlan {
  let tekrarGunu = g.tekrarGunu ?? 4;
  const sinavGunSayisi = g.sinavGunSayisi ?? 2;

  const units = g.units.filter((u) => u.dilim === g.dilim);
  const sinav = parseISO(g.sinavTarihi);
  const ilk = parseISO(g.baslangic);
  const son = parseISO(g.bitis);
  const sinavaKalan = differenceInCalendarDays(sinav, ilk);
  const sonDuzluk = sinavaKalan <= SON_DUZLUK_GUNU;

  // Sınava kadarki çalışma günleri (tekrar günleri hariç) ve aralarındaki pazarlar.
  const calismaGunleri = (tekrar: number) => {
    const l: Date[] = [];
    for (let d = ilk; differenceInCalendarDays(sinav, d) > tekrar; d = addDays(d, 1)) l.push(d);
    return l;
  };
  let W = calismaGunleri(tekrarGunu).length;

  // Hedef: normalde konuların tamamı; son düzlükte günlük yükün sığdığı en
  // yüksek güvenlik payı (16 → 14 → 12 soru).
  const tam = dersHalleri(units, g.ilerleme, { zorluk: g.zorluk });
  const tamamiIcin = tam.dersler.reduce((n, d) => n + d.toplamKalan, 0);
  const esikIcin = tam.dersler.reduce((n, d) => n + d.esikIhtiyaci, 0);
  let hedef: number | null = null;
  let secim = tam;
  let kurtarma = false;
  if (sonDuzluk) {
    for (const aday of [null, ...HEDEF_ADAYLARI]) {
      const deneme = dersHalleri(units, g.ilerleme, { zorluk: g.zorluk, hedef: aday, secici: aday != null });
      const is = deneme.dersler.reduce((n, d) => n + d.toplamKalan, 0);
      hedef = aday;
      secim = deneme;
      if (is === 0 || (W > 0 && is / W <= TAVAN_DK * 0.8)) break;
      // 12 doğruya yetecek konular bile sığmıyor: kurtarma (tekrar günü dışarıdan sabitlenmediyse).
      if (aday === ESIK_SORU && g.tekrarGunu == null) kurtarma = true;
    }
  }
  if (kurtarma) {
    tekrarGunu = KURTARMA_TEKRAR_GUNU;
    W = calismaGunleri(tekrarGunu).length;
  }
  const pazarlar = calismaGunleri(tekrarGunu).filter((d) => d.getDay() === 0).length;
  // Kurtarma: yabancı dil plana girmez.
  const dersler = kurtarma ? secim.dersler.filter((d) => !kurtarmadaDisarida(d.ders_kodu)) : secim.dersler;
  const cekirdek = new Set(units.filter((u) => u.katman === "cekirdek").map((u) => u.ders_kodu));
  /** Ders listesi tekrar satırı olarak. */
  const tekrarSatirlari = (kodlar: string[]) => tekrarDersleri(units, g.ilerleme, 0, kodlar.length, kodlar);
  /** Oturumu o gün olan dersler, oturum sırasıyla (kurtarmada yabancı dil hariç). */
  const oturumDersleri = (tarih: string) => Array.from(g.oturumlar?.entries() ?? [])
    .filter(([kod, o]) => o.tarih === tarih && units.some((u) => u.ders_kodu === kod) && !(kurtarma && kurtarmadaDisarida(kod)))
    .sort((a, b) => a[1].oturum - b[1].oturum || a[0].localeCompare(b[0]))
    .map(([kod]) => kod);
  const kalanIs = dersler.reduce((n, d) => n + d.toplamKalan, 0);

  // Boş gün: pazarlar çıkınca da yük rahatsa pazarlar boş.
  const bosGun = (g.bosGun ?? "otomatik") === "otomatik" && W - pazarlar > 0
    && kalanIs / (W - pazarlar) <= RAHAT_DK;
  const etkinGun = Math.max(1, W - (bosGun ? pazarlar : 0));
  // Konular bütün alındığı için günler bütçeyi tam dolduramıyor: %15 pay.
  const butce = g.gunlukDakika ?? sinirla((kalanIs / etkinGun) * 1.15);

  const dersSayisi = new Set(units.filter((u) => u.tip === "konu").map((u) => u.ders_kodu)).size;
  const tekrarAdedi = Math.min(3, Math.max(2, Math.ceil(dersSayisi / Math.max(1, tekrarGunu))));

  const gunler: PlanGunu[] = [];
  let dun = new Set<string>();
  let bitenTekrar = 0;
  const sinavTekrari = tekrarSirasi(units, g.ilerleme, g.oturumlar, tekrarGunu * tekrarAdedi)
    .filter((kod) => !(kurtarma && kurtarmadaDisarida(kod)));
  for (let d = ilk; d <= son; d = addDays(d, 1)) {
    const tarih = tarihStr(d);
    const sinavaGun = differenceInCalendarDays(sinav, d);
    if (sinavaGun <= 0 && sinavaGun > -sinavGunSayisi) {
      // Kurtarma: ilk sınav günü öğleden sonra ertesi günün dersleri.
      const yarin = kurtarma && sinavaGun > 1 - sinavGunSayisi ? oturumDersleri(tarihStr(addDays(d, 1))) : [];
      gunler.push({ tarih, tur: "sinav", dersler: tekrarSatirlari(yarin) });
      dun = new Set();
      continue;
    }
    if (sinavaGun <= 0) {
      // Sınav geçti; bu dilimin planı yok (sonraki dilim ayrı kurulur).
      gunler.push({ tarih, tur: "bos", dersler: [] });
      continue;
    }
    const sinavGunuDersleri = kurtarma && sinavaGun === 1 ? oturumDersleri(g.sinavTarihi) : [];
    if (sinavGunuDersleri.length) {
      // Kurtarma, oturumlar biliniyor: sınavdan önceki gün o sabahın bütün dersleri.
      gunler.push({ tarih, tur: "tekrar", dersler: tekrarSatirlari(sinavGunuDersleri) });
      dun = new Set();
      continue;
    }
    if (sinavaGun <= tekrarGunu) {
      // Gün sırası sınava uzaklıktan: hafta ortasında yeniden planlansa da aynı gün aynı dersler.
      // Kurtarma: önce çalışma günlerine sığmayan dersler — onlara çıkmış sorulardan dokunulur.
      const sigmayanDers = kurtarma
        ? dersler.filter((d) => d.kuyruk.length).sort((a, b) => b.esikIhtiyaci - a.esikIhtiyaci).map((d) => d.ders_kodu)
        : [];
      const siralama = sigmayanDers.length ? [...sigmayanDers, ...sinavTekrari.filter((k) => !sigmayanDers.includes(k))] : sinavTekrari;
      gunler.push({ tarih, tur: "tekrar", dersler: tekrarDersleri(units, g.ilerleme, tekrarGunu - sinavaGun, tekrarAdedi, siralama) });
      dun = new Set();
      continue;
    }
    if (bosGun && d.getDay() === 0) {
      gunler.push({ tarih, tur: "bos", dersler: [] });
      dun = new Set();
      continue;
    }
    // Kurtarma: günün ana dersi çekirdek bir ders (kalmadıysa herhangi biri).
    // Çekirdekler "kendi ihtiyacına oranla en az ilerlemiş önce" döner ki beşi de gelsin.
    const anaAdaylari = kurtarma ? dersler.filter((x) => cekirdek.has(x.ders_kodu)) : dersler;
    const ana = dersSec(anaAdaylari, dun, new Set()) ?? dersSec(dersler, dun, new Set(), kurtarma);
    if (!ana) {
      // Seçilen konular bitti: kalan günler tekrar.
      gunler.push({ tarih, tur: "tekrar", dersler: tekrarDersleri(units, g.ilerleme, bitenTekrar++, 2) });
      dun = new Set();
      continue;
    }
    const gunDersleri: PlanDersi[] = [];
    const ekle = (ders: DersHali, parcalar: PlanParcasi[]) =>
      gunDersleri.push({ ders_kodu: ders.ders_kodu, tur: "konu", dakika: parcalar.reduce((n, p) => n + p.dakika, 0), parcalar });
    // Kurtarmada ana ders bütçenin yarısını alır; kalanı ikinci ana derse ve kısa derse.
    // Zincirli derste (Matematik) konu zinciri kopmasın: o gün üç konuya kadar, ders tek başına.
    const zincir = kurtarma && ZINCIRLI_DERSLER.has(ana.ders_kodu);
    ekle(ana, zincir ? konuAl(ana, Math.round(butce * 1.25), true, 3) : konuAl(ana, kurtarma ? Math.round(butce * 0.5) : butce));
    let kalan = butce - gunDersleri[0].dakika;
    // Günün işi küçük kaldıysa ikinci ders: ilk konusu kalan yere bütün
    // sığan, sırası en önde olan ders. Yarım konu ikinci derse bölünmez.
    // Kurtarma: önce ikinci bir çekirdek ders (bir konu), sonra kısa derslerden
    // bir konu. Kısa dersler de dönüşümlü gelir; uzun konusu (BİT) bölünebilir.
    const kisalar = dersler.filter((x) => !cekirdek.has(x.ders_kodu));
    const gruplar: [DersHali[], boolean][] = kurtarma
      ? [[dersSirasi(anaAdaylari, dun, new Set([ana.ders_kodu])), false], [dersSirasi(kisalar, dun, new Set()), true]]
      : [[dersSirasi(dersler, dun, new Set([ana.ders_kodu])), false]];
    for (const [grup, kisa] of gruplar) {
      // Kurtarma: kısa dersin parçası gün dolu olsa da gelir (her gün bir kısa ders).
      const yer = kurtarma && kisa ? Math.max(kalan, KISA_DERS_DK) : kalan;
      if (yer < 20) continue;
      for (const ikinci of grup) {
        const p = konuAl(ikinci, yer, kisa, kurtarma ? 1 : GUNLUK_KONU);
        if (!p.length) continue;
        ekle(ikinci, p);
        kalan -= gunDersleri[gunDersleri.length - 1].dakika;
        break;
      }
    }
    if (kurtarma) for (const gd of gunDersleri) for (const p of gd.parcalar) p.kurtarma = true;
    gunler.push({ tarih, tur: "calisma", dersler: gunDersleri });
    dun = new Set(gunDersleri.map((s) => s.ders_kodu));
  }

  const uyarilar: string[] = [];
  const kapasite = etkinGun * TAVAN_DK;
  const sigmayan = dersler.reduce((n, d) => n + d.kuyruk.length, 0);
  if (sonDuzluk && !kurtarma && sigmayan > 0 && differenceInCalendarDays(sinav, son) <= tekrarGunu) {
    uyarilar.push(`Seçtiğim konuların ${sigmayan} tanesi tekrar günlerinden önce sığmadı; birkaç gün biraz fazla çalışırsan yetişir.`);
  }
  if (kurtarma) {
    uyarilar.push("Kalan günlere geçmeye yetecek konuların hepsi bile sığmıyor: kurtarma planı kurdum. Ana dersler önce, her konuda önce çıkmış sorular; tekrar sınavdan önceki gün.");
  } else if (secim.birakilan.length) {
    uyarilar.push(`Sınava kadar her konu sığmıyor: ${secim.birakilan.length} konuyu bilerek bıraktım, her dersi geçme çizgisine taşıyacak konular plana girdi.`);
  } else if (!sonDuzluk && tamamiIcin > kapasite) {
    uyarilar.push("Bu tempoyla bütün konular sığmayabilir. Sınava iki hafta kala, geçmeye yetecek konuları seçen son düzlük planı kurulacak.");
  }

  return {
    gunler,
    mod: kurtarma ? "kurtarma" : sonDuzluk ? "son-duzluk" : "normal",
    hedef_soru: hedef,
    birakilan: secim.birakilan,
    bos_gun: bosGun,
    calisma_gunu: W,
    sinava_kadar_kapasite_dk: kapasite,
    esik_icin_gereken_dk: esikIcin,
    tamami_icin_gereken_dk: tamamiIcin,
    uyarilar,
  };
}

/**
 * Hangi hafta planlanmalı.
 *
 * Pazar 21:00'den sonra gelecek hafta (pazartesi-pazar) planlanır; öncesinde
 * bu haftanın bugünden pazara kalan günleri. Haftanın anahtarı pazartesidir.
 */
export function hedefHafta(simdi: Date): { hafta: string; baslangic: string; bitis: string } {
  const gun = simdi.getDay(); // 0 pazar
  const pazartesiyeGeri = gun === 0 ? 6 : gun - 1;
  const buPazartesi = addDays(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()), -pazartesiyeGeri);
  const pazarAksami = gun === 0 && simdi.getHours() >= 21;
  if (pazarAksami) {
    const gelecek = addDays(buPazartesi, 7);
    return { hafta: tarihStr(gelecek), baslangic: tarihStr(gelecek), bitis: tarihStr(addDays(gelecek, 6)) };
  }
  return { hafta: tarihStr(buPazartesi), baslangic: tarihStr(simdi), bitis: tarihStr(addDays(buPazartesi, 6)) };
}

/**
 * Planlanacak aralık (v4). Sınava 14 gün ya da daha az kaldıysa son düzlük:
 * aralık sınavın son gününe kadar uzar, sınava kadarki her gün bir kerede
 * kurulur. Değilse `hedefHafta`.
 */
export function hedefAralik(simdi: Date, sinavTarihi: string | null, sinavGunSayisi = 2): { hafta: string; baslangic: string; bitis: string; sonDuzluk: boolean } {
  const h = hedefHafta(simdi);
  if (!sinavTarihi || sinavTarihi < h.baslangic) return { ...h, sonDuzluk: false };
  if (differenceInCalendarDays(parseISO(sinavTarihi), parseISO(h.baslangic)) > SON_DUZLUK_GUNU) return { ...h, sonDuzluk: false };
  const sinavSonu = tarihStr(addDays(parseISO(sinavTarihi), sinavGunSayisi - 1));
  return { ...h, bitis: sinavSonu > h.bitis ? sinavSonu : h.bitis, sonDuzluk: true };
}

/** Bir günün haftası (pazartesi). Son düzlükte satırlar birden çok haftaya yayılır. */
export function haftaAnahtari(tarih: string): string {
  const d = parseISO(tarih);
  return tarihStr(addDays(d, -(d.getDay() === 0 ? 6 : d.getDay() - 1)));
}

/**
 * Planlayıcının kuralları değişince (v4: 26 Ekim, saat ve "her gün 2 ders"
 * kalktı; 6 Kasım: kurtarma modu; 9 Kasım: ana dersler önce) bu andan önce kurulan planlar bir kez kendiliğinden yeniden kurulur.
 */
export const PLAN_SURUM_ANI = "2026-11-09T13:39:00Z";

export type YenidenKurNedeni = "yeni-hafta" | "son-duzluk" | "gunluk" | "geri-donus";

/** Uzun ara: plan bu kadar gün önce kurulduysa ve o günden beri hiç işaret yoksa. */
export const GERI_DONUS_GUNU = 3;

/**
 * Plan yeniden kurulmalı mı (saf).
 * - Hedef haftanın planı yok → yeni hafta.
 * - Son düzlük başladı ama plan sınava kadar uzanmıyor → son düzlük.
 * - Son düzlükte plan bugün kurulmadıysa → günlük tazeleme (ilerlemeye göre).
 * - Normalde plan 3+ gün önce kurulmuş ve o günden beri hiç işaret yoksa →
 *   geri dönüş: kalan iş kalan günlere sessizce yeniden dağıtılır.
 */
export function yenidenKurulmali(o: {
  bugun: string;
  sonDuzluk: boolean;
  haftaVar: boolean;
  /** Son düzlükte: sınav gününe plan satırı var mı. */
  sinavaUzaniyor: boolean;
  /** Bugünden sonraki plan satırlarının en yeni kurulma anı (ISO). */
  sonKurulum: string | null;
  /** En son işaretlenen adımın anı (ISO). */
  sonIlerleme: string | null;
  /** Bundan önce kurulan plan eski kurallarla kurulmuş sayılır, bir kez yenilenir. */
  surumAni?: string;
}): YenidenKurNedeni | null {
  if (!o.haftaVar) return o.sonDuzluk ? "son-duzluk" : "yeni-hafta";
  if (o.sonDuzluk && !o.sinavaUzaniyor) return "son-duzluk";
  if (!o.sonKurulum) return o.sonDuzluk ? "son-duzluk" : "yeni-hafta";
  if (o.surumAni && Date.parse(o.sonKurulum) < Date.parse(o.surumAni)) return o.sonDuzluk ? "son-duzluk" : "yeni-hafta";
  const kurulumGunu = tarihStr(parseISO(o.sonKurulum));
  if (o.sonDuzluk) return kurulumGunu < o.bugun ? "gunluk" : null;
  const gecen = differenceInCalendarDays(parseISO(o.bugun), parseISO(kurulumGunu));
  if (gecen >= GERI_DONUS_GUNU && (!o.sonIlerleme || o.sonIlerleme < o.sonKurulum)) return "geri-donus";
  return null;
}

