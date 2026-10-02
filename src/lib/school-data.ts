import { supabase, isSupabaseConfigured } from "./supabase";
import type { StudyUnit, UnitProgress, UnitProgressState, StudyOutcome } from "./study-plan";
import { durumuTuret, type Adim, type Adimlar } from "./ilerleme";

export interface SchoolSource {
  id: string;
  ad: string;
  url?: string | null;
  content_hash?: string | null;
  last_ok_at?: string | null;
  last_try_at?: string | null;
  last_error?: string | null;
  max_age_hours: number;
  durum: "taze" | "degisti" | "gecici-hata" | "BAYAT" | "bilinmiyor";
}

export interface SchoolCourse {
  kod: string;
  ad: string;
  yariyil: number;
  akts: number;
  zorunlu: boolean;
  muafiyet_hakki: boolean;
  ortalamaya_etki: boolean;
}

export interface SchoolGrade {
  id: string;
  ders_kodu: string;
  donem: string;
  vize?: number | null;
  final?: number | null;
  butunleme?: number | null;
  harf?: string | null;
  statu?: "normal" | "M1" | "M2" | "BŞR" | "BŞZ" | null;
  kaynak: "manuel" | "obs";
  updated_at: string;
}

export interface SchoolAnnouncement {
  id: string;
  baslik: string;
  ozet?: string | null;
  url: string;
  published_at?: string | null;
  source: string;
  action_required: boolean;
  last_verified_at: string;
}

export interface SchoolProfile {
  program?: string | null;
  sinav_merkezi?: string | null;
  obs_session_valid: boolean;
  obs_last_sync_at?: string | null;
}

export interface StudyModule {
  id: string;
  unit_id: string;
  ad: string;
  tip: string;
  oys_url: string | null;
  tahmini_dakika: number;
  yerel_dosya: string | null;
}

export interface StudyQuestion {
  id: string;
  ders_kodu: string;
  unit_id: string | null;
  soru_no: number;
  bolum_no: number | null;
  govde: string;
  secenekler: { harf: string; metin: string }[];
  dogru: "A" | "B" | "C" | "D" | "E" | null;
}

export interface QuestionAttempt {
  id: string;
  question_id: string;
  verilen: string | null;
  dogru_mu: boolean;
  cozuldu_at: string;
}

export interface FlashcardRow {
  id: string;
  unit_id: string | null;
  ders_kodu: string | null;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string;
  last_reviewed_at: string | null;
}

/** Pomodoro oturumu — çalışma temposunun tek ölçüm kaynağı. */
export interface StudySession {
  tarih: string;
  dakika: number;
}

export interface SchoolData {
  sources: SchoolSource[];
  courses: SchoolCourse[];
  grades: SchoolGrade[];
  announcements: SchoolAnnouncement[];
  profile: SchoolProfile | null;
  units: StudyUnit[];
  progress: UnitProgress[];
  outcomes: StudyOutcome[];
  modules: StudyModule[];
  questions: StudyQuestion[];
  attempts: QuestionAttempt[];
  flashcards: FlashcardRow[];
  sessions: StudySession[];
  warnings: string[];
}

const PASSING = new Set(["A", "B1", "B2", "B3", "C1", "C2", "C3", "M1", "M2", "BŞR"]);
const COEFFICIENTS: Record<string, number> = { A: 4, B1: 3.5, B2: 3.25, B3: 3, C1: 2.75, C2: 2.5, C3: 2, F1: 1.5, F2: 0 };
const LETTER_THRESHOLDS = [
  { min: 90, letter: "A", coefficient: 4 }, { min: 85, letter: "B1", coefficient: 3.5 },
  { min: 80, letter: "B2", coefficient: 3.25 }, { min: 75, letter: "B3", coefficient: 3 },
  { min: 70, letter: "C1", coefficient: 2.75 }, { min: 65, letter: "C2", coefficient: 2.5 },
  { min: 60, letter: "C3", coefficient: 2 }, { min: 50, letter: "F1", coefficient: 1.5 },
  { min: 0, letter: "F2", coefficient: 0 },
] as const;

export interface SchoolStrategy {
  gabno: number | null;
  evaluatedAkts: number;
  riskCourses: { code: string; name: string; requiredFinal: number; impossible: boolean }[];
  thresholdOpportunities: { code: string; name: string; current: string; target: string; points: number }[];
  nextActions: string[];
}

export function requiredFinal(midterm?: number | null): number | null {
  if (midterm == null) return null;
  if (!Number.isFinite(midterm) || midterm < 0 || midterm > 100) throw new RangeError("Vize 0 ile 100 arasında olmalı.");
  return Math.max(50, Math.ceil((60 - 0.4 * midterm) / 0.6));
}

export function completedCredits(courses: SchoolCourse[], grades: SchoolGrade[]): number {
  const byCourse = new Map(grades.map((grade) => [grade.ders_kodu, grade]));
  return courses.reduce((sum, course) => {
    const grade = byCourse.get(course.kod);
    const result = grade?.statu && grade.statu !== "normal" ? grade.statu : grade?.harf;
    return result && PASSING.has(result) ? sum + course.akts : sum;
  }, 0);
}

export function buildSchoolStrategy(courses: SchoolCourse[], grades: SchoolGrade[]): SchoolStrategy {
  const byCourse = new Map(grades.map((grade) => [grade.ders_kodu, grade]));
  let weighted = 0;
  let evaluatedAkts = 0;
  const riskCourses: SchoolStrategy["riskCourses"] = [];
  const thresholdOpportunities: SchoolStrategy["thresholdOpportunities"] = [];

  for (const course of courses) {
    const grade = byCourse.get(course.kod);
    if (!grade) continue;
    const required = requiredFinal(grade.vize);
    if (required != null && grade.final == null && grade.butunleme == null && required >= 65) {
      riskCourses.push({ code: course.kod, name: course.ad, requiredFinal: required, impossible: required > 100 });
    }
    if (course.ortalamaya_etki && grade.harf && COEFFICIENTS[grade.harf] !== undefined) {
      weighted += COEFFICIENTS[grade.harf] * course.akts;
      evaluatedAkts += course.akts;
    }
    const exam = grade.butunleme ?? grade.final;
    if (grade.vize != null && exam != null) {
      const score = Math.round(grade.vize * 0.4 + exam * 0.6);
      const currentIndex = LETTER_THRESHOLDS.findIndex((threshold) => score >= threshold.min);
      if (currentIndex > 0) {
        const target = LETTER_THRESHOLDS[currentIndex - 1];
        const points = Math.ceil((target.min - score) / 0.6);
        if (points <= 5) thresholdOpportunities.push({ code: course.kod, name: course.ad, current: LETTER_THRESHOLDS[currentIndex].letter, target: target.letter, points });
      }
    }
  }

  riskCourses.sort((a, b) => b.requiredFinal - a.requiredFinal);
  thresholdOpportunities.sort((a, b) => a.points - b.points);
  const nextActions: string[] = [];
  if (riskCourses[0]) nextActions.push(`${riskCourses[0].name}: final hedefini ${riskCourses[0].requiredFinal} olarak çalışma planına ekle.`);
  if (thresholdOpportunities[0]) nextActions.push(`${thresholdOpportunities[0].name}: ${thresholdOpportunities[0].points} sınav puanı ile ${thresholdOpportunities[0].target} eşiği mümkün.`);
  if (!nextActions.length && !grades.length) nextActions.push("Vize notlarını girdikten sonra final hedefleri ve risk sırası oluşacak.");
  if (!nextActions.length) nextActions.push("Bu hafta kritik not riski görünmüyor; yaklaşan sınav tarihlerini doğrula.");
  return { gabno: evaluatedAkts ? Number((weighted / evaluatedAkts).toFixed(2)) : null, evaluatedAkts, riskCourses, thresholdOpportunities, nextActions };
}

export function isSchoolSourceStale(source: SchoolSource, now = Date.now()): boolean {
  if (source.durum === "BAYAT" || source.durum === "gecici-hata" || Boolean(source.last_error)) return true;
  if (!source.last_ok_at) return true;
  return now - Date.parse(source.last_ok_at) > source.max_age_hours * 60 * 60 * 1000;
}

const EMPTY: SchoolData = { sources: [], courses: [], grades: [], announcements: [], profile: null, units: [], progress: [], outcomes: [], modules: [], questions: [], attempts: [], flashcards: [], sessions: [], warnings: [] };

function missingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "")));
}

/** Tek bir tablo isteğinin bekleyebileceği en uzun süre. */
const ISTEK_SURESI_MS = 12_000;

/** Ağdan gelmeyen yanıt: tabloyu okuyamadık, elimizdekiyle devam ediyoruz. */
export class OkulVerisiZamanAsimi extends Error {
  constructor(public tablo: string) {
    super(`${tablo} ${ISTEK_SURESI_MS / 1000} sn içinde yanıt vermedi`);
  }
}

/**
 * Tablo okur — zaman aşımıyla.
 *
 * Okul sekmesinin takılı kalmasının sebebi buydu: uygulama uzun süre arka
 * planda kalınca (Safari web uygulaması uyutuluyor) istekler bazen hiç
 * dönmüyor. Zaman aşımı olmadığı için 13 tablonun birini bekleyen
 * Promise.all sonsuza dek açık kalıyor, yükleme çarkı dönüp duruyordu;
 * uygulamayı kapatıp açmak tek çareydi. Artık istek iptal ediliyor ve bir kez
 * daha deneniyor; yine olmazsa hata fırlatıp elimizdeki son veriye dönülüyor.
 */
async function readTable<T>(table: string, userId: string): Promise<{ rows: T[]; warning?: string }> {
  for (let deneme = 0; deneme < 2; deneme++) {
    const iptal = new AbortController();
    const zamanlayici = setTimeout(() => iptal.abort(), ISTEK_SURESI_MS);
    try {
      const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).abortSignal(iptal.signal);
      if (!error) return { rows: (data ?? []) as T[] };
      if (iptal.signal.aborted) continue;
      if (missingTable(error)) return { rows: [], warning: `${table} henüz kurulmadı` };
      return { rows: [], warning: `${table} okunamadı: ${error.message}` };
    } catch (e) {
      if (!iptal.signal.aborted) throw e;
    } finally {
      clearTimeout(zamanlayici);
    }
  }
  throw new OkulVerisiZamanAsimi(table);
}

const ONBELLEK_KEY = "epoche-okul-onbellek";

/** Son başarılı okul verisi. Sekme açılırken ekran boş beklemesin diye. */
export function okulOnbellegi(userId?: string | null): SchoolData | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const ham = localStorage.getItem(ONBELLEK_KEY);
    if (!ham) return null;
    const kayit = JSON.parse(ham) as { userId: string; data: SchoolData };
    return kayit.userId === userId ? kayit.data : null;
  } catch {
    return null;
  }
}

function onbellegeYaz(userId: string, data: SchoolData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBELLEK_KEY, JSON.stringify({ userId, data }));
  } catch { /* kota dolu — önbellek kritik değil */ }
}

export async function fetchSchoolData(userId?: string | null): Promise<SchoolData> {
  if (!userId || !isSupabaseConfigured) return EMPTY;
  // Uyandıktan sonra erişim anahtarının süresi dolmuş olabilir; okumadan önce
  // oturum tazelensin, yoksa her tablo "JWT expired" ile boş döner.
  await supabase.auth.getSession().catch(() => null);
  const [sources, courses, grades, announcements, profileRows, units, progress, outcomes, modules, questions, attempts, flashcards, sessions] = await Promise.all([
    readTable<SchoolSource>("ybs_sources", userId),
    readTable<SchoolCourse>("ybs_courses", userId),
    readTable<SchoolGrade>("ybs_grades", userId),
    readTable<SchoolAnnouncement>("ybs_announcements", userId),
    readTable<SchoolProfile>("ybs_profile", userId),
    readTable<StudyUnit & { deleted_at: string | null }>("ybs_units", userId),
    readTable<UnitProgress>("ybs_unit_progress", userId),
    readTable<StudyOutcome>("ybs_outcomes", userId),
    readTable<StudyModule & { deleted_at: string | null }>("ybs_modules", userId),
    readTable<StudyQuestion>("ybs_questions", userId),
    readTable<QuestionAttempt>("ybs_question_attempts", userId),
    readTable<FlashcardRow>("ybs_flashcards", userId),
    readTable<{ completed_at: string; duration_minutes: number; phase: string }>("work_sessions", userId),
  ]);
  const sonuc: SchoolData = {
    sources: sources.rows,
    courses: courses.rows,
    grades: grades.rows,
    announcements: announcements.rows,
    profile: profileRows.rows[0] ?? null,
    // Emekliye ayrılmış birim planda görünmemeli; kaynaktan düşen konu çalışma listesini kirletir.
    units: units.rows.filter((unit) => !unit.deleted_at),
    progress: progress.rows,
    outcomes: outcomes.rows,
    modules: modules.rows.filter((row) => !row.deleted_at),
    questions: questions.rows,
    attempts: attempts.rows,
    flashcards: flashcards.rows,
    // Yalnız çalışma fazı tempoya sayılır; molalar sayılırsa tempo olduğundan büyük görünür.
    sessions: sessions.rows
      .filter((row) => row.phase === "work")
      .map((row) => ({ tarih: row.completed_at, dakika: row.duration_minutes })),
    warnings: [sources.warning, courses.warning, grades.warning, announcements.warning, profileRows.warning,
               units.warning, progress.warning, outcomes.warning, modules.warning, questions.warning, attempts.warning, flashcards.warning].filter(Boolean) as string[],
  };
  // Yalnız eksiksiz okuma önbelleğe girer; yarım veri sonraki açılışı yanıltmasın.
  if (!sonuc.warnings.length) onbellegeYaz(userId, sonuc);
  return sonuc;
}

/**
 * Bir konunun ilerleme durumunu kaydeder.
 *
 * Bu tablo kullanıcınındır: motor okur, asla yazmaz. Bu yüzden yazma yolu da
 * yalnız buradan geçer ve her zaman kullanıcının kendi oturumuyla çalışır.
 */
export async function setUnitProgress(
  userId: string,
  unitId: string,
  durum: UnitProgressState,
  gercekDakika?: number,
): Promise<void> {
  await birimIlerlemesiniBirlestir(userId, unitId, {
    durum,
    son_temas_at: new Date().toISOString(),
    ...(gercekDakika != null ? { gercek_dakika: gercekDakika } : {}),
  });
}

/** Şema henüz güncellenmemişse (v11 çalıştırılmadıysa) anlaşılır bir hata. */
export class AdimKolonuYok extends Error {
  constructor() {
    super("Checklist için veritabanı güncellemesi bekleniyor (migration-epoche-v11-adimlar.sql).");
  }
}

/**
 * Konunun checklist'inde bir adımı işaretler ya da kaldırır.
 *
 * `durum` da adımlardan türetilip birlikte yazılır: durum okuyan eski
 * sürümler ve motorun eski kopyası bozulmadan çalışmaya devam etsin.
 * Önceki adımları döndürür ki çağıran "geri al" sunabilsin.
 */
export async function setUnitStep(
  userId: string,
  unitId: string,
  adim: Adim,
  isaretli: boolean,
): Promise<Adimlar> {
  const { data: mevcut, error: okumaHatasi } = await supabase
    .from("ybs_unit_progress")
    .select("*")
    .eq("unit_id", unitId)
    .eq("user_id", userId)
    .maybeSingle();
  if (okumaHatasi) throw new Error(okumaHatasi.message);
  const onceki: Adimlar = { ...((mevcut as { adimlar?: Adimlar } | null)?.adimlar ?? {}) };
  const yeni: Adimlar = { ...onceki, [adim]: isaretli ? new Date().toISOString() : null };
  await setUnitSteps(userId, unitId, yeni);
  return onceki;
}

/** Adımların tamamını yazar (geri al için). */
export async function setUnitSteps(userId: string, unitId: string, adimlar: Adimlar): Promise<void> {
  try {
    await birimIlerlemesiniBirlestir(userId, unitId, {
      adimlar,
      durum: durumuTuret(adimlar),
      son_temas_at: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof Error && /adimlar/.test(e.message)) throw new AdimKolonuYok();
    throw e;
  }
}

/**
 * İlerleme satırını okuyup birleştirerek yazar.
 *
 * PostgREST'in upsert'ü satırın tamamını değiştiriyor: yalnız `durum` yazan
 * bir çağrı `not_id`'yi, yalnız `not_id` yazan bir çağrı da `durum`u siliyordu.
 * Notu açıp sonra "Çalıştım" demek konu-not bağını koparıyordu.
 */
async function birimIlerlemesiniBirlestir(
  userId: string,
  unitId: string,
  yama: Record<string, unknown>,
): Promise<void> {
  const { data: mevcut } = await supabase
    .from("ybs_unit_progress")
    .select("*")
    .eq("unit_id", unitId)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("ybs_unit_progress").upsert({
    ...(mevcut ?? {}),
    unit_id: unitId,
    user_id: userId,
    ...yama,
    updated_at: new Date().toISOString(),
  }, { onConflict: "unit_id" });
  if (error) throw new Error(error.message);
}

/**
 * Soru denemesi kaydeder. Deneme tablosu kullanıcınındır; motor yazmaz.
 * Her deneme ayrı satır — aynı soruyu tekrar çözmek önceki kaydı silmez,
 * çünkü ilerleme "bir kez bildim" değil "tekrar tekrar biliyorum" ile ölçülür.
 */
export async function saveQuestionAttempt(
  userId: string,
  questionId: string,
  verilen: string,
  dogru: boolean,
): Promise<void> {
  const { error } = await supabase.from("ybs_question_attempts").insert({
    id: `att-${questionId}-${Date.now()}`,
    user_id: userId,
    question_id: questionId,
    verilen,
    dogru_mu: dogru,
    cozuldu_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Konu ile notunu bağlar. İlerleme tablosu kullanıcınındır; motor buraya yazmaz. */
export async function setUnitNote(userId: string, unitId: string, noteId: string): Promise<void> {
  await birimIlerlemesiniBirlestir(userId, unitId, { not_id: noteId });
}

/** Kart değerlendirmesini kaydeder. Zamanlama tablosu kullanıcınındır. */
export async function saveCardReview(
  userId: string,
  cardId: string,
  durum: { ease: number; interval: number; reps: number; lapses: number; dueAt: string; lastReviewedAt?: string | null },
  baglam: { unitId?: string; dersKodu?: string } = {},
): Promise<void> {
  const { error } = await supabase.from("ybs_flashcards").upsert({
    id: cardId,
    user_id: userId,
    unit_id: baglam.unitId || null,
    ders_kodu: baglam.dersKodu || null,
    ease: durum.ease,
    interval_days: durum.interval,
    reps: durum.reps,
    lapses: durum.lapses,
    due_at: durum.dueAt,
    last_reviewed_at: durum.lastReviewedAt ?? new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export function buildSchoolDemoData(): SchoolData {
  const now = new Date().toISOString();
  return {
    sources: [
      { id: "ankuzef-duyuru", ad: "ANKUZEF Duyurular", url: "https://ankuzef.ankara.edu.tr/tr/duyurular", last_ok_at: now, max_age_hours: 24, durum: "taze" },
      { id: "akademik-takvim", ad: "Akademik Takvim", url: "https://oidb.ankara.edu.tr", last_ok_at: now, max_age_hours: 168, durum: "taze" },
      { id: "bologna-mufredat", ad: "Bologna Müfredat", url: "https://bologna.ankara.edu.tr", last_ok_at: now, max_age_hours: 168, durum: "taze" },
    ],
    courses: [
      { kod: "AAUF1101", ad: "İktisada Giriş", yariyil: 1, akts: 4, zorunlu: true, muafiyet_hakki: false, ortalamaya_etki: true },
      { kod: "AAUF1105", ad: "Matematik I", yariyil: 1, akts: 4, zorunlu: true, muafiyet_hakki: false, ortalamaya_etki: true },
      { kod: "AAUF1109", ad: "Bilgi Yönetimi", yariyil: 1, akts: 5, zorunlu: true, muafiyet_hakki: false, ortalamaya_etki: true },
    ],
    grades: [],
    announcements: [{
      id: "demo-registration",
      baslik: "2026-2027 Güz yarıyılı ders kayıt işlemleri",
      ozet: "Ders atamalarını ve ödeme durumunu OBS üzerinden kontrol et.",
      url: "https://oidb.ankara.edu.tr",
      published_at: "2026-08-24T09:00:00Z",
      source: "OİDB",
      action_required: true,
      last_verified_at: now,
    }],
    profile: { program: "Yönetim Bilişim Sistemleri (Açıköğretim)", sinav_merkezi: "Konya", obs_session_valid: false },
    units: [
      { id: "demo:u1", ders_kodu: "AAUF1101", baslik: "1-İktisat Nedir?", tip: "konu", dilim: "vize", katman: "cekirdek", tahmini_dakika: 90, soru_degeri: 5, konu_no: 1 },
      { id: "demo:u2", ders_kodu: "AAUF1105", baslik: "1-Temel Bilgiler", tip: "konu", dilim: "vize", katman: "cekirdek", tahmini_dakika: 75, soru_degeri: 5, konu_no: 1 },
    ],
    progress: [],
    // Gün sayfası demoda boş görünmesin diye birkaç örnek kazanım, materyal ve soru.
    outcomes: [
      { id: "demo:k1", unit_id: "demo:u1", sira: 1, metin: "İktisadın temel kavramlarını açıklayabilecek" },
      { id: "demo:k2", unit_id: "demo:u1", sira: 2, metin: "Kıtlık ve seçim ilişkisini örneklerle tartışabilecek" },
    ],
    modules: [
      { id: "ybs:mod:demo1", unit_id: "demo:u1", ad: "Kitap Bölümü", tip: "resource", oys_url: "https://oys.ankuzef.ankara.edu.tr", tahmini_dakika: 30, yerel_dosya: null },
      { id: "ybs:mod:demo2", unit_id: "demo:u1", ad: "Bölüm Özeti Ses Metni (Podcast)", tip: "resource", oys_url: "https://oys.ankuzef.ankara.edu.tr", tahmini_dakika: 10, yerel_dosya: null },
      { id: "ybs:mod:demo3", unit_id: "demo:u2", ad: "Temel Bilgiler — video anlatım", tip: "hvp", oys_url: "https://oys.ankuzef.ankara.edu.tr", tahmini_dakika: 15, yerel_dosya: null },
    ],
    questions: [
      {
        id: "demo:q1", ders_kodu: "AAUF1101", unit_id: "demo:u1", soru_no: 1, bolum_no: 1,
        govde: "Sınırsız ihtiyaçlar karşısında kaynakların kıt olması iktisatta hangi kavramla ifade edilir?",
        secenekler: [{ harf: "A", metin: "Kıtlık" }, { harf: "B", metin: "Enflasyon" }, { harf: "C", metin: "Fayda" }, { harf: "D", metin: "Talep" }, { harf: "E", metin: "Arz" }],
        dogru: "A",
      },
      {
        id: "demo:q2", ders_kodu: "AAUF1101", unit_id: "demo:u1", soru_no: 2, bolum_no: 1,
        govde: "Bir seçim yapılırken vazgeçilen en iyi alternatifin değerine ne ad verilir?",
        secenekler: [{ harf: "A", metin: "Marjinal fayda" }, { harf: "B", metin: "Fırsat maliyeti" }, { harf: "C", metin: "Toplam maliyet" }, { harf: "D", metin: "Sabit maliyet" }, { harf: "E", metin: "Batık maliyet" }],
        dogru: "B",
      },
    ],
    attempts: [],
    flashcards: [],
    sessions: [],
    warnings: [],
  };
}

export async function saveSchoolGrade(
  userId: string,
  input: { courseCode: string; term: string; midterm?: number; final?: number }
): Promise<void> {
  const clean = (value: number | undefined) => value === undefined || Number.isNaN(value) ? null : value;
  for (const [label, value] of [["Vize", input.midterm], ["Final", input.final]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new RangeError(`${label} 0 ile 100 arasında olmalı.`);
    }
  }
  const id = `grade-${userId}-${input.courseCode.toLocaleLowerCase("tr-TR")}-${input.term.toLocaleLowerCase("tr-TR").replace(/\s+/g, "-")}`;
  const { error } = await supabase.from("ybs_grades").upsert({
    id,
    user_id: userId,
    ders_kodu: input.courseCode,
    donem: input.term,
    vize: clean(input.midterm),
    final: clean(input.final),
    kaynak: "manuel",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,ders_kodu,donem" });
  if (error) throw new Error(error.message);
}
