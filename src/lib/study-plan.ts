// Çalışma planı hesabı — saf fonksiyonlar, yan etkisiz.
//
// NOT: Bu modül YBS motorundaki `src/lib/plan.js` dosyasının TypeScript ikizidir.
// Kopyalamak bilinçli bir karar: plan, kullanıcı bir konuyu işaretler işaretlemez
// yeniden hesaplanmalı. Motorun saatlik yazdığı bir anlık görüntüyü okusaydık
// ekran her tıklamadan sonra bayat kalırdı. İki kopya aynı test durumlarıyla
// korunuyor; birini değiştiren diğerini de değiştirmeli.
//
// TEMEL MODEL: Dersler bağımsız geçilir. Hedef toplam puanı büyütmek değil,
// 60'ın altında kalan ders sayısını sıfırlamak. Bu yüzden her ders 12/20
// eşiğine taşınmaya çalışılır; eşiği geçen derste marjinal değer kırpılır.

export type UnitProgressState = "dokunulmadi" | "calisildi" | "test_edildi" | "hakim";
export type PlanState = "yolunda" | "geriliyor" | "kritik";

export interface StudyUnit {
  id: string;
  ders_kodu: string;
  baslik: string;
  tip: "konu" | "materyal";
  dilim: "vize" | "final" | null;
  katman: "cekirdek" | "kultur";
  tahmini_dakika: number;
  soru_degeri: number;
  konu_no: number | null;
}

export interface UnitProgress {
  unit_id: string;
  durum: UnitProgressState;
  son_temas_at?: string | null;
  gercek_dakika: number;
  /** Konuya bağlı not; Faz F köprüsü. */
  not_id?: string | null;
}

export interface StudyOutcome {
  id: string;
  unit_id: string;
  sira: number;
  metin: string;
}

export interface CourseStatus {
  ders_kodu: string;
  katman: "cekirdek" | "kultur";
  kapsanan: number;
  toplam: number;
  kalan_dakika: number;
  birim: number;
  dokunulmamis: number;
  esikte: boolean;
  esige_kalan: number;
}

export interface Suggestion {
  unit_id: string;
  ders_kodu: string;
  baslik: string;
  dakika: number;
  kazanc: number;
  verim: number;
  esik_isi: boolean;
}

export const DURUM_KATSAYISI: Record<UnitProgressState, number> = {
  dokunulmadi: 0,
  calisildi: 0.7,
  test_edildi: 0.85,
  hakim: 1,
};

export const ESIK_SORU = 12;
export const TOPLAM_SORU = 20;
/** Kullanıcının beyan ettiği taban kapasite (dk/gün); ölçüm gelene kadar kullanılır. */
export const TABAN_TEMPO = 52;
const FAZLALIK_KATSAYISI = 0.25;

const katsayi = (durum?: UnitProgressState) => (durum ? DURUM_KATSAYISI[durum] ?? 0 : 0);

export function dersDurumlari(units: StudyUnit[], ilerleme: Map<string, UnitProgress>): CourseStatus[] {
  const harita = new Map<string, CourseStatus>();
  for (const u of units) {
    if (u.tip !== "konu") continue;
    const d = harita.get(u.ders_kodu) ?? {
      ders_kodu: u.ders_kodu, katman: u.katman, kapsanan: 0, toplam: 0,
      kalan_dakika: 0, birim: 0, dokunulmamis: 0, esikte: false, esige_kalan: ESIK_SORU,
    };
    const k = katsayi(ilerleme.get(u.id)?.durum);
    d.kapsanan += u.soru_degeri * k;
    d.toplam += u.soru_degeri;
    d.birim += 1;
    if (k < 1) {
      d.kalan_dakika += Math.round(u.tahmini_dakika * (1 - k));
      if (k === 0) d.dokunulmamis += 1;
    }
    harita.set(u.ders_kodu, d);
  }
  const cikti = Array.from(harita.values());
  for (const d of cikti) {
    d.kapsanan = Number(d.kapsanan.toFixed(2));
    d.esikte = d.kapsanan >= ESIK_SORU;
    d.esige_kalan = Number(Math.max(0, ESIK_SORU - d.kapsanan).toFixed(2));
  }
  return cikti;
}

export function birimDegeri(unit: StudyUnit, durum: CourseStatus, ilerleme: Map<string, UnitProgress>): Suggestion | null {
  const k = katsayi(ilerleme.get(unit.id)?.durum);
  if (k >= 1) return null;
  const kazanc = unit.soru_degeri * (1 - k);
  const dakika = Math.max(1, Math.round(unit.tahmini_dakika * (1 - k)));
  const esigeKadar = Math.max(0, Math.min(kazanc, durum.esige_kalan));
  const agirlikli = esigeKadar + (kazanc - esigeKadar) * FAZLALIK_KATSAYISI;
  return {
    unit_id: unit.id,
    ders_kodu: unit.ders_kodu,
    baslik: unit.baslik,
    dakika,
    kazanc: Number(kazanc.toFixed(2)),
    verim: Number(((agirlikli / dakika) * 60).toFixed(3)),
    esik_isi: esigeKadar > 0,
  };
}

export function oner(units: StudyUnit[], ilerleme: Map<string, UnitProgress>, adet = 3): Suggestion[] {
  const durumlar = new Map(dersDurumlari(units, ilerleme).map((d) => [d.ders_kodu, d]));
  const adaylar = units
    .filter((u) => u.tip === "konu")
    .map((u) => birimDegeri(u, durumlar.get(u.ders_kodu)!, ilerleme))
    .filter((x): x is Suggestion => x !== null)
    .sort((a, b) => b.verim - a.verim || a.dakika - b.dakika);

  // Aynı dersten arka arkaya üç konu önermek tempoyu kırıyor: önce her dersten bir tane.
  const secilen: Suggestion[] = [];
  const gorulen = new Set<string>();
  for (const a of adaylar) {
    if (secilen.length >= adet) break;
    if (gorulen.has(a.ders_kodu)) continue;
    gorulen.add(a.ders_kodu);
    secilen.push(a);
  }
  for (const a of adaylar) {
    if (secilen.length >= adet) break;
    if (!secilen.includes(a)) secilen.push(a);
  }
  return secilen;
}

export function tempo(
  oturumlar: { tarih: string; dakika: number }[],
  simdi: Date | string,
  gun = 7,
  tabanTempo: number | null = null,
): { deger: number; kaynak: "olcum" | "beyan" } {
  // "Hiç çalışmadı" ile "henüz ölçmedik" aynı şey değil: ölçüm yokken sıfır saymak
  // ilk günden bütün dersleri riskli gösterip paneli gürültüye çeviriyor.
  if (!oturumlar.length && tabanTempo != null) return { deger: tabanTempo, kaynak: "beyan" };
  const esik = new Date(simdi).getTime() - gun * 86_400_000;
  const toplam = oturumlar
    .filter((o) => new Date(o.tarih).getTime() >= esik)
    .reduce((n, o) => n + (o.dakika ?? 0), 0);
  return { deger: Number((toplam / gun).toFixed(1)), kaynak: "olcum" };
}

export function kalanGun(sinavTarihi: string, simdi: Date | string): number {
  return Math.max(0, Math.ceil((new Date(sinavTarihi).getTime() - new Date(simdi).getTime()) / 86_400_000));
}

export function projeksiyon(args: { kalanDakika: number; kalanGun: number; tempoDakikaGun: number }): {
  oran: number; hal: PlanState; gereken_tempo: number;
} {
  const { kalanDakika, kalanGun: gun, tempoDakikaGun } = args;
  if (kalanDakika <= 0) return { oran: Infinity, hal: "yolunda", gereken_tempo: 0 };
  const oran = gun === 0 ? 0 : (tempoDakikaGun * gun) / kalanDakika;
  return {
    oran: Number(oran.toFixed(2)),
    hal: oran >= 1 ? "yolunda" : oran >= 0.7 ? "geriliyor" : "kritik",
    gereken_tempo: gun === 0 ? Infinity : Math.ceil(kalanDakika / gun),
  };
}

function esikMaliyeti(d: CourseStatus): number {
  if (d.esikte) return 0;
  const oran = d.toplam > 0 ? d.esige_kalan / d.toplam : 0;
  return Math.ceil(d.kalan_dakika * oran);
}

/** Bütçe yetmediğinde eşiğe ulaşamayacak dersler. Ders bırakmayı ÖNERMEZ, gerçeği gösterir. */
export function riskAltindakiDersler(
  units: StudyUnit[], ilerleme: Map<string, UnitProgress>,
  args: { kalanGun: number; tempoDakikaGun: number },
): { ders_kodu: string; esige_kalan: number; gereken_dakika: number }[] {
  let butce = args.tempoDakikaGun * args.kalanGun;
  const sirali = dersDurumlari(units, ilerleme).filter((d) => !d.esikte).sort((a, b) => esikMaliyeti(a) - esikMaliyeti(b));
  const risk = [];
  for (const d of sirali) {
    const maliyet = esikMaliyeti(d);
    if (butce >= maliyet) butce -= maliyet;
    else risk.push({ ders_kodu: d.ders_kodu, esige_kalan: d.esige_kalan, gereken_dakika: maliyet });
  }
  return risk;
}

export interface StudyPlan {
  dilim: "vize" | "final";
  sinav_tarihi: string;
  kalan_gun: number;
  kalan_dakika: number;
  tempo_7g: number;
  tempo_kaynak: "olcum" | "beyan";
  oran: number;
  hal: PlanState;
  gereken_tempo: number;
  dersler: CourseStatus[];
  esikteki_ders: number;
  toplam_ders: number;
  risk: { ders_kodu: string; esige_kalan: number; gereken_dakika: number }[];
  oneriler: Suggestion[];
}

export function buildStudyPlan(args: {
  units: StudyUnit[];
  ilerleme: Map<string, UnitProgress>;
  oturumlar: { tarih: string; dakika: number }[];
  sinavTarihi: string;
  simdi?: Date | string;
  dilim?: "vize" | "final";
  oneriAdedi?: number;
}): StudyPlan {
  const { units, ilerleme, oturumlar, sinavTarihi } = args;
  const simdi = args.simdi ?? new Date();
  const dilim = args.dilim ?? "vize";
  const dilimUnits = units.filter((u) => u.tip === "konu" && u.dilim === dilim);
  const durumlar = dersDurumlari(dilimUnits, ilerleme);
  const kalanDakika = durumlar.reduce((n, d) => n + d.kalan_dakika, 0);
  const gun = kalanGun(sinavTarihi, simdi);
  const t7 = tempo(oturumlar, simdi, 7, TABAN_TEMPO);
  const p = projeksiyon({ kalanDakika, kalanGun: gun, tempoDakikaGun: t7.deger });
  return {
    dilim,
    sinav_tarihi: sinavTarihi,
    kalan_gun: gun,
    kalan_dakika: kalanDakika,
    tempo_7g: t7.deger,
    tempo_kaynak: t7.kaynak,
    ...p,
    dersler: durumlar.sort((a, b) => b.esige_kalan - a.esige_kalan),
    esikteki_ders: durumlar.filter((d) => d.esikte).length,
    toplam_ders: durumlar.length,
    risk: p.hal === "yolunda" ? [] : riskAltindakiDersler(dilimUnits, ilerleme, { kalanGun: gun, tempoDakikaGun: t7.deger }),
    oneriler: oner(dilimUnits, ilerleme, args.oneriAdedi ?? 3),
  };
}
