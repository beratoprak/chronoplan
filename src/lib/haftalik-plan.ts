// Haftalık planlayıcı — saf hesap (Plan v3, Faz B).
//
// Ağ yok, saat okuma yok: "bugün" ve bütün veri parametreyle gelir. Bu
// sayede her kural teste bağlanabiliyor. Kaydetme ve takvime yazma ayrı
// dosyada (`haftalik-plan-kayit.ts`).
//
// KURALLAR (PLAN-SISTEM.md, Faz B)
// 1. Önce eşik: 20 soruda 12'nin altındaki dersler öne alınır.
// 2. Günde `dersPerGun` farklı ders, her biri günlük sürenin eşit payı.
//    Bir konu o paya sığmazsa sonraki günlere bölünür ("devam").
// 3. Aynı ders üst üste iki gün gelmez — başka ders kalmamışsa gelir.
// 4. Zor/uzun dersler kendiliğinden haftaya yayılır: her ders bir günde en
//    fazla bir pay alır, ihtiyacı büyük olan daha çok güne düşer.
// 5. Geçen haftadan kalan iş ayrıca taşınmaz: ilerleme neyse kalan odur.
// 6. Kapasite yetmiyorsa uyarı üretilir, gizlenmez.
// 7. Sınavdan önceki son `tekrarGunu` gün yeni konu yok, yalnız tekrar.
//
// Konular dersin kendi sırasıyla gelir (konu_no): Matematik'te Limit,
// Fonksiyonlar'dan önce çalışılmaz. Verim sıralaması dersler ARASINDA yapılır,
// ders İÇİNDE değil.

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { dersDurumlari, ESIK_SORU, type StudyUnit, type UnitProgress } from "./study-plan";
import { ADIMLAR, ilerlemeKatsayisi } from "./ilerleme";

export interface PlanGirdisi {
  units: StudyUnit[];
  ilerleme: Map<string, UnitProgress>;
  /** En yakın sınavın ilk günü (YYYY-MM-DD). */
  sinavTarihi: string;
  dilim: "vize" | "final";
  /** Planın ilk günü — çoğunlukla bugün ya da gelecek pazartesi. */
  baslangic: string;
  /** Planın son günü (pazar). */
  bitis: string;
  gunlukDakika?: number;
  dersPerGun?: number;
  /** Konu → süre çarpanı (Faz G'de Gemini tahmini). Yoksa 1. */
  zorluk?: Map<string, number>;
  /** Sınavdan önceki kaç gün yalnız tekrar. */
  tekrarGunu?: number;
  /** Sınav kaç gün sürüyor (Cmt+Paz = 2). */
  sinavGunSayisi?: number;
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
}

export interface PlanDersi {
  ders_kodu: string;
  tur: "konu" | "tekrar";
  dakika: number;
  parcalar: PlanParcasi[];
}

export type GunTuru = "calisma" | "tekrar" | "sinav" | "bos";

export interface PlanGunu {
  tarih: string;
  tur: GunTuru;
  dersler: PlanDersi[];
}

export interface HaftalikPlan {
  gunler: PlanGunu[];
  /** Sınava kadar (tekrar günleri hariç) çalışma kapasitesi. */
  sinava_kadar_kapasite_dk: number;
  /** Bütün dersleri eşiğe taşımak için gereken süre. */
  esik_icin_gereken_dk: number;
  /** Dilimin tamamını bitirmek için gereken süre. */
  tamami_icin_gereken_dk: number;
  uyarilar: string[];
}

interface Kuyruk {
  unit: StudyUnit;
  kalan: number;
  baslangic: number;
  /** Bu konu bitince derse eklenecek soru. */
  kazanc: number;
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
const KIRINTI = 10;

/** Bir dersin konu kuyruğu ve eşiğe kadar gereken süre. */
function dersHalleri(units: StudyUnit[], ilerleme: Map<string, UnitProgress>, zorluk?: Map<string, number>): DersHali[] {
  const durumlar = new Map(dersDurumlari(units, ilerleme).map((d) => [d.ders_kodu, d]));
  const dersler = new Map<string, Kuyruk[]>();
  const sirali = [...units]
    .filter((u) => u.tip === "konu")
    .sort((a, b) => a.ders_kodu.localeCompare(b.ders_kodu) || (a.konu_no ?? 0) - (b.konu_no ?? 0));
  for (const u of sirali) {
    const kayit = ilerleme.get(u.id);
    const k = ilerlemeKatsayisi(kayit, kayit?.mevcut ?? ADIMLAR);
    if (k >= 1) continue;
    const kalan = Math.round(u.tahmini_dakika * (1 - k) * (zorluk?.get(u.id) ?? 1));
    if (kalan <= 0) continue;
    const kuyruk = dersler.get(u.ders_kodu) ?? [];
    kuyruk.push({ unit: u, kalan, baslangic: kalan, kazanc: u.soru_degeri * (1 - k) });
    dersler.set(u.ders_kodu, kuyruk);
  }
  const cikti: DersHali[] = [];
  for (const [ders_kodu, kuyruk] of Array.from(dersler.entries())) {
    let esigeKalan = durumlar.get(ders_kodu)?.esige_kalan ?? ESIK_SORU;
    let esikIhtiyaci = 0;
    // Eşiğe varana kadar konular sırayla çalışılırsa ne kadar sürer.
    for (const q of kuyruk) {
      if (esigeKalan <= 0) break;
      const oran = Math.min(1, esigeKalan / q.kazanc);
      esikIhtiyaci += Math.round(q.kalan * oran);
      esigeKalan -= q.kazanc;
    }
    const toplamKalan = kuyruk.reduce((n, q) => n + q.kalan, 0);
    cikti.push({ ders_kodu, kuyruk, esikIhtiyaci, toplamKalan, ilkEsik: esikIhtiyaci, ilkToplam: toplamKalan });
  }
  return cikti;
}

/** Bir dersin kuyruğundan `pay` dakikalık iş keser. */
function payKes(ders: DersHali, pay: number): PlanParcasi[] {
  const parcalar: PlanParcasi[] = [];
  let kalanPay = pay;
  while (kalanPay > 0 && ders.kuyruk.length) {
    const q = ders.kuyruk[0];
    let alinan = Math.min(kalanPay, q.kalan);
    // Konunun ucunda 10 dakikadan az kalacaksa bugün bitir: ertesi güne
    // "1 dk devam" diye bir kırıntı bırakmak anlamsız.
    if (q.kalan - alinan > 0 && q.kalan - alinan < KIRINTI) alinan = q.kalan;
    // Sonraki konudan çok küçük bir kırıntı almak anlamsız: yarım bırak.
    if (parcalar.length > 0 && alinan < KIRINTI) break;
    parcalar.push({
      unit_id: q.unit.id,
      baslik: q.unit.baslik,
      dakika: alinan,
      devam: q.kalan < q.baslangic,
      bitiyor: alinan === q.kalan,
    });
    q.kalan -= alinan;
    kalanPay -= alinan;
    ders.toplamKalan -= alinan;
    ders.esikIhtiyaci = Math.max(0, ders.esikIhtiyaci - alinan);
    if (q.kalan <= 0) ders.kuyruk.shift();
  }
  return parcalar;
}

/**
 * Günün dersleri.
 *
 * Eşik altındaki dersler önce gelir. Aralarındaki sıra "kendi ihtiyacına
 * oranla en az ilerlemiş ders önce": ilk denemede "eşiğe en çok işi kalan
 * önce" kuralı Türk Dili ve Atatürk'ü iki hafta hiç getirmiyordu. Oranla
 * seçince ilk hafta dokuz dersin hepsi bir kez gelir, büyük dersler daha sık
 * döner ve hepsi sınava doğru birlikte ilerler. Dün çalışılan ders sona kalır.
 */
function dersSec(dersler: DersHali[], dun: Set<string>, adet: number): DersHali[] {
  const aday = dersler.filter((d) => d.toplamKalan > 0);
  const esikAltinda = (d: DersHali) => d.esikIhtiyaci > 0;
  const oran = (d: DersHali) => esikAltinda(d)
    ? 1 - d.esikIhtiyaci / Math.max(1, d.ilkEsik)
    : 1 - d.toplamKalan / Math.max(1, d.ilkToplam);
  const sirala = (liste: DersHali[]) => [...liste].sort((a, b) =>
    Number(esikAltinda(b)) - Number(esikAltinda(a))
    || oran(a) - oran(b)
    || b.esikIhtiyaci - a.esikIhtiyaci
    || a.ders_kodu.localeCompare(b.ders_kodu));
  const taze = sirala(aday.filter((d) => !dun.has(d.ders_kodu)));
  const tekrar = sirala(aday.filter((d) => dun.has(d.ders_kodu)));
  return [...taze, ...tekrar].slice(0, adet);
}

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

/** Tekrar günleri: sıradaki dersler, her gün farklı ikili. */
function tekrarDersleri(units: StudyUnit[], ilerleme: Map<string, UnitProgress>, sira: number, adet: number, pay: number, siralama?: string[]): PlanDersi[] {
  const kodlar = siralama ?? tekrarSirasi(units, ilerleme);
  const durumlar = kodlar.map((ders_kodu) => ({ ders_kodu }));
  if (!durumlar.length) return [];
  const secilen: PlanDersi[] = [];
  for (let i = 0; i < adet && i < durumlar.length; i++) {
    const d = durumlar[(sira * adet + i) % durumlar.length];
    if (secilen.some((s) => s.ders_kodu === d.ders_kodu)) continue;
    const konular = units
      .filter((u) => u.tip === "konu" && u.ders_kodu === d.ders_kodu)
      .sort((a, b) => (a.konu_no ?? 0) - (b.konu_no ?? 0))
      .map((u) => ({ unit_id: u.id, baslik: u.baslik, dakika: 0, devam: false, bitiyor: false }));
    secilen.push({ ders_kodu: d.ders_kodu, tur: "tekrar", dakika: pay, parcalar: konular });
  }
  return secilen;
}

export function haftalikPlanKur(g: PlanGirdisi): HaftalikPlan {
  const gunlukDakika = g.gunlukDakika ?? 60;
  const dersPerGun = g.dersPerGun ?? 2;
  const tekrarGunu = g.tekrarGunu ?? 4;
  const sinavGunSayisi = g.sinavGunSayisi ?? 2;
  const pay = Math.round(gunlukDakika / dersPerGun);

  const units = g.units.filter((u) => u.dilim === g.dilim);
  const dersler = dersHalleri(units, g.ilerleme, g.zorluk);
  const esikIcin = dersler.reduce((n, d) => n + d.esikIhtiyaci, 0);
  const tamamiIcin = dersler.reduce((n, d) => n + d.toplamKalan, 0);

  const sinav = parseISO(g.sinavTarihi);
  const ilk = parseISO(g.baslangic);
  const son = parseISO(g.bitis);

  // Sınava kadarki çalışma günleri (tekrar günleri hariç) — kapasite hesabı için.
  const sinavaKalan = differenceInCalendarDays(sinav, ilk);
  const calismaGunuSinavaKadar = Math.max(0, sinavaKalan - tekrarGunu);
  const kapasite = calismaGunuSinavaKadar * gunlukDakika;

  const gunler: PlanGunu[] = [];
  let dun = new Set<string>();
  let bitenTekrar = 0;
  const sinavTekrari = tekrarSirasi(units, g.ilerleme, g.oturumlar, tekrarGunu * dersPerGun);
  for (let d = ilk; d <= son; d = addDays(d, 1)) {
    const tarih = tarihStr(d);
    const sinavaGun = differenceInCalendarDays(sinav, d);
    if (sinavaGun <= 0 && sinavaGun > -sinavGunSayisi) {
      gunler.push({ tarih, tur: "sinav", dersler: [] });
      dun = new Set();
      continue;
    }
    if (sinavaGun <= 0) {
      // Sınav geçti; bu dilimin planı yok (sonraki dilim ayrı kurulur).
      gunler.push({ tarih, tur: "bos", dersler: [] });
      continue;
    }
    if (sinavaGun <= tekrarGunu) {
      // Gün sırası sınava uzaklıktan: hafta ortasında yeniden planlansa da aynı gün aynı dersler.
      gunler.push({ tarih, tur: "tekrar", dersler: tekrarDersleri(units, g.ilerleme, tekrarGunu - sinavaGun, dersPerGun, pay, sinavTekrari) });
      dun = new Set();
      continue;
    }
    const secilen = dersSec(dersler, dun, dersPerGun);
    if (!secilen.length) {
      // Bütün konular bitti: kalan günler tekrar.
      gunler.push({ tarih, tur: "tekrar", dersler: tekrarDersleri(units, g.ilerleme, bitenTekrar++, dersPerGun, pay) });
      dun = new Set();
      continue;
    }
    const gunDersleri: PlanDersi[] = secilen.map((ders) => {
      const parcalar = payKes(ders, pay);
      return { ders_kodu: ders.ders_kodu, tur: "konu", dakika: parcalar.reduce((n, p) => n + p.dakika, 0), parcalar };
    });
    gunler.push({ tarih, tur: "calisma", dersler: gunDersleri });
    dun = new Set(secilen.map((s) => s.ders_kodu));
  }

  const uyarilar: string[] = [];
  const sa = (dk: number) => `${(dk / 60).toFixed(1).replace(".", ",")} saat`;
  if (esikIcin > kapasite) {
    uyarilar.push(`Bütün dersleri eşiğe taşımak ${sa(esikIcin)} istiyor, sınava kadar ${sa(kapasite)} var — günlük süreyi artırmak gerekiyor.`);
  } else if (tamamiIcin > kapasite) {
    uyarilar.push(`Dersler eşiğe yetişir, ama konuların tamamı için ${sa(tamamiIcin - kapasite)} eksik. Sistem önce eşiği koruyor.`);
  }

  return {
    gunler,
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
