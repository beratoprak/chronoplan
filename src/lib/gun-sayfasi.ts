// Gün sayfası (Plan v3, Faz C) — saf hesaplar.
//
// Takvimdeki çalışma etkinliğine tıklayınca o günün iki dersi tek ekranda
// açılıyor. Ekran `GunSayfasi.tsx`'te; burada yalnız neyin, hangi sırayla
// gösterileceği var. Saf tutuldu ki teste bağlanabilsin.

import type { QuestionAttempt, StudyModule, StudyQuestion } from "./school-data";
import type { UnitProgress } from "./study-plan";
import type { PlanParcasi } from "./haftalik-plan";
import { materyalEtiketi } from "./materyal";
import type { Adim } from "./ilerleme";

export type SoruDurumu = "cozulmedi" | "yanlis" | "dogru";

/** Sorunun son denemesine göre durumu: önemli olan en son ne yaptığın. */
export function soruDurumlari(denemeler: QuestionAttempt[]): Map<string, SoruDurumu> {
  const son = new Map<string, QuestionAttempt>();
  for (const d of denemeler) {
    const onceki = son.get(d.question_id);
    if (!onceki || d.cozuldu_at > onceki.cozuldu_at) son.set(d.question_id, d);
  }
  return new Map(Array.from(son.entries()).map(([id, d]) => [id, d.dogru_mu ? "dogru" : "yanlis"]));
}

/**
 * Soruların gösterilme sırası: önce hiç çözmediklerin, sonra yanlış
 * yaptıkların, en son doğru bildiklerin. Grup içinde kitaptaki sıra.
 */
export function soruSirasi(sorular: StudyQuestion[], denemeler: QuestionAttempt[]): StudyQuestion[] {
  const durum = soruDurumlari(denemeler);
  const agirlik: Record<SoruDurumu, number> = { cozulmedi: 0, yanlis: 1, dogru: 2 };
  return [...sorular].sort((a, b) =>
    agirlik[durum.get(a.id) ?? "cozulmedi"] - agirlik[durum.get(b.id) ?? "cozulmedi"]
    || (a.bolum_no ?? 0) - (b.bolum_no ?? 0)
    || a.soru_no - b.soru_no);
}

/**
 * Tekrar günü: dersin "Hakimim" denmemiş konuları. Hakim olduğun konuyu
 * sınavdan önceki son günlerde yeniden önüne koymak vakit kaybı.
 */
export function eksikKonular(parcalar: PlanParcasi[], ilerleme: Map<string, UnitProgress>): PlanParcasi[] {
  return parcalar.filter((p) => ilerleme.get(p.unit_id)?.durum !== "hakim");
}

/** Tekrar gününde sorular dersin tamamından; doğru bilinenler sıraya hiç girmez. */
export function tekrarSorulari(sorular: StudyQuestion[], denemeler: QuestionAttempt[]): StudyQuestion[] {
  const durum = soruDurumlari(denemeler);
  return soruSirasi(sorular.filter((s) => durum.get(s.id) !== "dogru"), denemeler);
}

// ── Konu föyü ────────────────────────────────────────────────────
//
// 3 Ekim: gün sayfası bir veri dökümü gibi duruyordu; checklist malzemeden
// kopuktu, PDF'i olmayan konuda "Oku" kutusu okunacak bir şey göstermiyordu.
// Föy her konuyu aynı sırayla anlatır: öğreneceklerin → malzemen → nasıl
// çalışacaksın. Her adım kendi malzemesini taşır ve checklist'in bir adımına
// bağlanır; ilerleme modeli (ilerleme.ts) değişmez, yalnız sunuş değişir.

export type MalzemeTuru = "kitap" | "dosya" | "ses" | "video" | "hedef" | "test" | "diger";

export interface FoyMalzemesi {
  tur: MalzemeTuru;
  ad: string;
  dakika: number;
  /** Uygulama içi PDF okuyucunun depo kimliği; yalnız kitap bölümlerinde. */
  cmid: string | null;
  oys_url: string | null;
  /** ybs_modules kimliği: video aracısı bununla imzalı adres verir. */
  modulId: string;
  /** Uygulamanın içinde oynatılabilir video (Faz F): motor dosya yolunu bulmuş. */
  oynatilir: boolean;
}

export interface FoyAdimi {
  /** Checklist'te karşılığı olan adım; isteğe bağlı adımlarda (podcast, OYS testi) yok. */
  adim: Adim | null;
  metin: string;
  dakika: number;
  malzeme: FoyMalzemesi[];
  /** Soru adımı: çıkmış sorular bu adımın altında çözülür. */
  soru: boolean;
  /** İşaretlenmiş — ya da isteğe bağlıysa, ondan sonraki bir adım işaretlenmiş. */
  yapildi: boolean;
  /** Bugünün kısmında mı (konu birden fazla güne bölündüğünde). */
  bugun: boolean;
}

export interface KonuFoyu {
  pdfVar: boolean;
  malzeme: FoyMalzemesi[];
  /** PDF'i olmayan konuda "nasıl çalışacaksın"ın başındaki açıklama. */
  aciklama: string | null;
  adimlar: FoyAdimi[];
  /** Bugünün kısmının dakikası (bugün yapılacak, henüz yapılmamış adımlar). */
  bugunDakika: number;
}

export const ADIM_ISARETI: Record<Adim, string> = {
  oku: "Okudum", izle: "İzledim", soru: "Çözdüm", hakim: "Hakimim",
};

function malzemeTuru(etiket: string, ad: string): MalzemeTuru | null {
  if (etiket === "E-Pub" || etiket === "Çıkmış soru") return null;
  if (etiket === "Kitap") return "kitap";
  if (etiket === "Ses") return "ses";
  if (etiket === "Video") return "video";
  if (etiket === "Test") return "test";
  if (etiket === "Sayfa" && /öğrenme hedef/i.test(ad)) return "hedef";
  // İngilizce'nin Student/Work Book'u, BİT'in Word/Excel dosyaları: okunur ama yalnız OYS'de.
  if (etiket === "Dosya") return "dosya";
  if (["Sayfa", "Klasör", "url"].includes(etiket)) return "diger";
  return null; // geri bildirim formu, yoklama, forum: çalışma malzemesi değil
}

const GEMINI_TURU: Record<NonNullable<StudyModule["tur_tahmini"]>, MalzemeTuru> = {
  kitap: "dosya", okuma: "dosya", video: "video", ses: "ses", alistirma: "test", diger: "diger",
};

/** Konunun malzemesi tür türüne, OYS'deki sırayla (modül sırası zaten konu sırası). */
export function foyMalzemesi(moduller: StudyModule[]): FoyMalzemesi[] {
  const out: FoyMalzemesi[] = [];
  for (const m of moduller) {
    // Kod tanımıyorsa Gemini'nin tür tahminine bak (Faz G); uygulama içinde açılamaz, OYS'de açılır.
    const tur = malzemeTuru(materyalEtiketi(m.ad, m.tip), m.ad) ?? (m.tur_tahmini ? GEMINI_TURU[m.tur_tahmini] : null);
    if (!tur) continue;
    out.push({
      tur,
      ad: m.ad.replace(/^#\s*\d*\s*-?\s*/, "").trim() || m.ad,
      dakika: m.tahmini_dakika ?? 0,
      // Depoya yalnız kitap bölümleri yüklendi (<ders>/<cmid>.pdf).
      cmid: tur === "kitap" ? String(m.id).replace(/^ybs:mod:/, "") : null,
      oys_url: m.oys_url,
      modulId: m.id,
      oynatilir: tur === "video" && Boolean(m.yerel_dosya),
    });
  }
  return out;
}

const topla = (l: FoyMalzemesi[]) => l.reduce((t, m) => t + m.dakika, 0);
const tirnakla = (l: FoyMalzemesi[]) => l.map((m) => `"${m.ad}"`).join(", sonra ");

/**
 * Konunun föyü. `mevcut` checklist'te var olan adımlar (videosuz konuda İzle,
 * sorusuz konuda Soru yok); `butce` bugün bu konuya ayrılan dakika, `bitiyor`
 * bugünün parçası konuyu bitiriyorsa — o zaman kalan her şey bugündür.
 */
export function konuFoyu({ moduller, soruSayisi, kazanimSayisi, mevcut, kayit, butce, bitiyor, kurtarma = false }: {
  moduller: StudyModule[];
  soruSayisi: number;
  kazanimSayisi: number;
  mevcut: Adim[];
  kayit?: { adimlar?: Partial<Record<Adim, string | null>> | null } | null;
  butce: number;
  bitiyor: boolean;
  /** Kurtarma modu (6 Kasım): çıkmış sorular ilk adım. */
  kurtarma?: boolean;
}): KonuFoyu {
  const malzeme = foyMalzemesi(moduller);
  const tur = (t: MalzemeTuru) => malzeme.filter((m) => m.tur === t);
  const kitap = tur("kitap"), dosya = tur("dosya"), ses = tur("ses"), video = tur("video");
  const hedef = tur("hedef"), test = tur("test");
  const pdfVar = kitap.length > 0;
  const isaretli = new Set(mevcut.filter((a) => Boolean(kayit?.adimlar?.[a])));
  const kazanimaBak = kazanimSayisi > 0 ? `"Öğreneceklerin"deki ${kazanimSayisi} maddeyi` : "Ana kavramları";

  type Taslak = Omit<FoyAdimi, "yapildi" | "bugun">;
  const taslak: Taslak[] = [];
  if (mevcut.includes("oku")) {
    if (pdfVar) {
      taslak.push({ adim: "oku", dakika: topla(kitap), malzeme: kitap, soru: false,
        metin: `${kitap.length > 1 ? "Ders notlarını sırayla" : "Kitap bölümünü baştan sona"} oku. Ana başlıkları ve kalın yazılmış kavramları not al.` });
    } else if (dosya.length) {
      taslak.push({ adim: "oku", dakika: topla(dosya), malzeme: dosya, soru: false,
        metin: `OYS'de ${tirnakla(dosya)} dosyasını aç ve sırayla çalış.` });
    } else if (hedef.length) {
      taslak.push({ adim: "oku", dakika: topla(hedef), malzeme: hedef, soru: false,
        metin: `Öğrenme hedeflerini aç ve oku.${kazanimSayisi ? " Yukarıdaki maddeleri aklında tut." : ""}` });
    } else {
      taslak.push({ adim: "oku", dakika: 0, malzeme: [], soru: false,
        metin: kazanimSayisi ? `Okunacak metin yok; "Öğreneceklerin"i oku.` : "Okunacak metin yok; bu adımı geçebilirsin." });
    }
  }
  if (ses.length) {
    taslak.push({ adim: null, dakika: topla(ses), malzeme: ses, soru: false,
      metin: pdfVar ? "İstersen bölüm özetini (podcast) dinle: okuduğunun kısa tekrarı." : "İstersen sesli özeti dinle." });
  }
  if (mevcut.includes("izle") && video.length) {
    taslak.push({ adim: "izle", dakika: topla(video), malzeme: video, soru: false,
      metin: `${video.length > 1 ? `Videoları sırayla izle: ${tirnakla(video)}.` : `${tirnakla(video)} videosunu izle.`}${pdfVar ? "" : " İzlerken öğreneceğin kavramları not al."}` });
  }
  if (test.length) {
    taslak.push({ adim: null, dakika: topla(test), malzeme: test, soru: false,
      metin: `Kendini dene: OYS'de ${tirnakla(test)} ${test.length > 1 ? "testlerini" : "testini"} çöz. Yanlış yaptığın yere geri dön.` });
  }
  if (mevcut.includes("soru") && soruSayisi > 0) {
    taslak.push({ adim: "soru", dakika: Math.max(2, soruSayisi * 2), malzeme: [], soru: true,
      metin: soruSayisi > 1 ? `${soruSayisi} çıkmış soruyu çöz (sorular burada açılır).` : "Çıkmış soruyu çöz (soru burada açılır)." });
  }
  if (mevcut.includes("hakim")) {
    taslak.push({ adim: "hakim", dakika: 0, malzeme: [], soru: false,
      metin: `${kazanimaBak} kitaba bakmadan anlatabiliyorsan işaretle.` });
  }

  // Kurtarma: önce çıkmış sorular; bilinmeyen yerler sonra kitaptan/videodan.
  const soruAdimi = taslak.findIndex((a) => a.soru);
  if (kurtarma && soruAdimi > 0) {
    const [s] = taslak.splice(soruAdimi, 1);
    taslak.unshift({ ...s, metin: `Önce ${s.metin.charAt(0).toLocaleLowerCase("tr")}${s.metin.slice(1)} Bilemediklerini aşağıdaki adımlarda ara.` });
  }

  // İsteğe bağlı adım, kendinden sonraki bir adım işaretlendiyse geçilmiş sayılır.
  const yapildi = taslak.map((a, i) =>
    a.adim ? isaretli.has(a.adim) : taslak.slice(i + 1).some((s) => s.adim && isaretli.has(s.adim)));

  // Bugünün kısmı: yapılmamış adımlar sırayla, yarısından fazlası bütçeye
  // sığdıkça. İlk adım hep girer — 35 dakikalık bir okuma 30 dakikalık güne
  // bölünmez, "bugün oku" denir.
  const bugun = new Array<boolean>(taslak.length).fill(false);
  let harcanan = 0, durdu = false, ilk = true;
  taslak.forEach((a, i) => {
    if (yapildi[i] || durdu) return;
    if (bitiyor || ilk || harcanan + a.dakika / 2 <= butce) {
      bugun[i] = true;
      harcanan += a.dakika;
      ilk = false;
    } else {
      durdu = true;
    }
  });

  let aciklama: string | null = null;
  if (!pdfVar) {
    if (dosya.length) aciklama = "Bu konunun okuma dosyaları uygulamaya yüklenmedi; OYS'de açılır.";
    else if (video.length) {
      aciklama = "Bu konunun okunacak metni (PDF) yok; konuyu videolardan öğreneceksin."
        + (hedef.length ? " Öğrenme hedefleri neye dikkat edeceğini söyler" : "")
        + (hedef.length && test.length ? ", test de anlayıp anlamadığını gösterir." : hedef.length ? "." : "")
        + (!hedef.length && test.length ? " OYS'deki test anlayıp anlamadığını gösterir." : "");
    } else if (malzeme.length) aciklama = "Bu konunun okunacak metni (PDF) yok; aşağıdaki malzemeyle çalışılıyor.";
    else aciklama = "Bu konuya OYS'de henüz malzeme konmamış.";
  }

  if (kurtarma && soruAdimi >= 0) {
    aciklama = "Kurtarma planı: konuyu baştan sona okuman şart değil. Önce çıkmış soruları çöz, bilemediğin sorunun cevabını kitapta ya da videoda bul."
      + (aciklama ? ` ${aciklama}` : "");
  }

  const adimlar = taslak.map((a, i) => ({ ...a, yapildi: yapildi[i], bugun: bugun[i] }));
  return {
    pdfVar, malzeme, aciklama, adimlar,
    bugunDakika: adimlar.filter((a) => a.bugun).reduce((t, a) => t + a.dakika, 0),
  };
}

/** "1-Temel Kavramlar" → "Temel Kavramlar": konu numarası başlıkta ayrıca yazılıyor. */
export function konuAdi(baslik: string): string {
  return baslik.replace(/^\s*\d+\s*[-–.]\s*/, "").trim() || baslik;
}
