"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle, ArrowUpRight, BookOpenCheck, CalendarClock, CheckCircle2,
  ChevronRight, CircleDollarSign, CloudOff, GraduationCap, Loader2, NotebookPen,
  Layers, RefreshCw, Save, School, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { AdimKolonuYok, buildSchoolDemoData, buildSchoolStrategy, completedCredits, fetchSchoolData, isSchoolSourceStale, okulOnbellegi, setUnitStep, setUnitSteps, requiredFinal, saveCardReview, saveQuestionAttempt, saveSchoolGrade, setUnitNote, setUnitProgress, type SchoolData } from "@/lib/school-data";
import { buildStudyPlan, type StudyUnit, type UnitProgress, type UnitProgressState } from "@/lib/study-plan";
import { buildUnitNote } from "@/lib/study-note";
import { ezberKartlari, isaretliKazanimlar } from "@/lib/note-blocks";
import { haftaninPlani, PLAN_KAYNAGI, planiHesapla, planiKurVeYaz, type PlanSatiri } from "@/lib/haftalik-plan-kayit";
import { hedefHafta } from "@/lib/haftalik-plan";
import { MATERYAL_SIRASI, materyalEtiketi } from "@/lib/materyal";
import { KonuChecklist } from "@/components/school/KonuChecklist";
import { ADIM_ETIKETI, ADIMLAR, ilerlemeKatsayisi, isaretliAdimlar, mevcutAdimHaritasi, type Adim, type Adimlar } from "@/lib/ilerleme";
import { degerlendir, yeniKart, zamaniGelenler, type Deger, type KartDurumu } from "@/lib/spaced-repetition";
import type { CalendarEvent, Task } from "@/types";

const EMPTY: SchoolData = { sources: [], courses: [], grades: [], announcements: [], profile: null, units: [], progress: [], outcomes: [], modules: [], questions: [], attempts: [], flashcards: [], sessions: [], warnings: [] };

const HAL_ETIKET = { yolunda: "Yolunda", geriliyor: "Geriliyor", kritik: "Kritik" } as const;
const DURUM_ETIKET: Record<UnitProgressState, string> = {
  dokunulmadi: "Başlamadım", calisildi: "Çalıştım", test_edildi: "Test ettim", hakim: "Hakimim",
};
const saatce = (dakika: number) => `${(dakika / 60).toFixed(1)} sa`;

function isSchoolTask(task: Task) {
  return task.isManaged || task.id.startsWith("ybs-") || task.tags.some((tag) => tag.color === "school" || tag.name.toLocaleLowerCase("tr-TR") === "okul");
}

function isSchoolEvent(event: CalendarEvent) {
  // Çalışma planı etkinlikleri de okul etiketli ve "ybs-" ile başlıyor; ama
  // kritik tarih değiller. Ayıklanmazsa "Sıradaki kritik tarih" kartı kayıt
  // ve sınav yerine günün çalışma planını gösteriyordu.
  if (event.source === PLAN_KAYNAGI) return false;
  return event.isManaged || event.id.startsWith("ybs-") || event.tagColor === "school";
}

function countdownLabel(date: string) {
  const days = differenceInCalendarDays(startOfDay(parseISO(date)), startOfDay(new Date()));
  if (days < 0) return `${Math.abs(days)} gün geçti`;
  if (days === 0) return "Bugün";
  if (days === 1) return "Yarın";
  return `${days} gün kaldı`;
}

function SectionTitle({ icon: Icon, title, detail }: { icon: React.ElementType; title: string; detail?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={17} style={{ color: "var(--tag-school)" }} />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      </div>
      {detail && <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>{detail}</span>}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] py-3 leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}

/** Konunun hangi durumda olduğunu tek bakışta gösterir. İşaretlemenin bir
 *  iz bırakması gerekiyor; eskiden basıp basmadığını anlamanın yolu yoktu. */
function DurumRozeti({ durum }: { durum: UnitProgressState }) {
  if (durum === "dokunulmadi") return null;
  const renk = durum === "hakim"
    ? { background: "var(--priority-low-bg)", color: "var(--priority-low-text)" }
    : { background: "var(--tag-school-bg)", color: "var(--tag-school-text)" };
  return (
    <span className="rounded-full px-1.5 py-0.5 font-semibold" style={renk}>
      {durum === "hakim" ? "hakim ✓" : DURUM_ETIKET[durum]}
    </span>
  );
}

export function SchoolView() {
  const {
    user, isDemoMode, events, tasks, addRichNote, setView, openTaskModal, syncStatus, updateEvent,
    requestRichNote, richNotes,
  } = useAppStore();
  // Önbellek varsa ekran ilk karede dolu açılır; ağ arkadan tazeler.
  const [data, setData] = useState<SchoolData>(() => okulOnbellegi(user?.id) ?? EMPTY);
  const [loading, setLoading] = useState(() => !okulOnbellegi(user?.id));
  /** Son tazeleme düştüyse kullanıcıya söylenir; ekran yine de açık kalır. */
  const [agHatasi, setAgHatasi] = useState<string | null>(null);
  const [tazeleniyor, setTazeleniyor] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [gradeCourse, setGradeCourse] = useState("");
  const [midterm, setMidterm] = useState("");
  const [finalScore, setFinalScore] = useState("");
  const [gradeStatus, setGradeStatus] = useState<string | null>(null);
  const [ackMessage, setAckMessage] = useState<string | null>(null);
  const [unitBusy, setUnitBusy] = useState<string | null>(null);
  const [acikSoru, setAcikSoru] = useState<string | null>(null);
  const [verilenCevap, setVerilenCevap] = useState<Record<string, string>>({});
  /** Son işaretleme — geri alma bildirimi için. */
  const [sonIslem, setSonIslem] = useState<{ unitId: string; onceki: UnitProgressState | Adimlar; mesaj: string } | null>(null);
  /** Ders → konular listesinde açık olan ders. */
  const [acikDers, setAcikDers] = useState<string | null>(null);

  /**
   * Veriyi tazeler.
   *
   * `ilk` yalnız ilk yüklemede true: sonraki tazelemelerde tam ekran
   * yükleniciye geçmek bütün görünümü söküp yeniden kuruyordu, yani her
   * işaretlemeden sonra sayfa başa sarıyor ve yerini kaybediyordun.
   */
  const load = useCallback(async (ilk = false) => {
    setTazeleniyor(true);
    try {
      setData(isDemoMode ? buildSchoolDemoData() : await fetchSchoolData(user?.id));
      setAgHatasi(null);
    } catch (e) {
      // Ağ asılı kaldı ya da koptu. Eskiden burada hiçbir şey yakalanmıyordu:
      // yükleme bayrağı açık kalıyor, çark sonsuza dek dönüyordu.
      setAgHatasi(e instanceof Error ? e.message : "Okul verisi alınamadı");
    } finally {
      if (ilk) setLoading(false);
      setTazeleniyor(false);
    }
  }, [isDemoMode, user?.id]);

  useEffect(() => { void load(true); }, [load]);

  // ── Bu hafta ──────────────────────────────────────────────────
  // Planı kendiliğinden kuran kanca app düzeyinde (useHaftalikPlanlayici);
  // burada yalnız gösteriliyor ve elle yeniden kurulabiliyor.
  const [haftaSatirlari, setHaftaSatirlari] = useState<PlanSatiri[]>([]);
  const [planMesgul, setPlanMesgul] = useState(false);
  const [planHatasi, setPlanHatasi] = useState<string | null>(null);
  const hafta = hedefHafta(new Date()).hafta;
  const haftayiOku = useCallback(async () => {
    if (!user?.id || isDemoMode) return;
    try {
      setHaftaSatirlari(await haftaninPlani(user.id, hafta));
    } catch (e) {
      setPlanHatasi(/ybs_haftalik_plan/.test(String(e))
        ? "Haftalık plan için veritabanı güncellemesi bekleniyor (migration-epoche-v12)."
        : `Plan okunamadı: ${e instanceof Error ? e.message : e}`);
    }
  }, [user?.id, isDemoMode, hafta]);
  useEffect(() => { void haftayiOku(); }, [haftayiOku, events.length]);

  const yenidenPlanla = useCallback(async () => {
    if (!user?.id) return;
    setPlanMesgul(true);
    setPlanHatasi(null);
    try {
      const sonuc = await planiKurVeYaz(user.id, events, { zorla: true });
      if (sonuc.durum === "sinav-yok") setPlanHatasi("Takvimde yaklaşan sınav bulunamadı; plan sınav tarihine göre kuruluyor.");
      else if (sonuc.durum === "veri-yok") setPlanHatasi("Ders konuları henüz yüklenmedi.");
      await useAppStore.getState().syncFromSupabase();
      await haftayiOku();
    } catch (e) {
      setPlanHatasi(`Plan kurulamadı: ${e instanceof Error ? e.message : e}`);
    } finally {
      setPlanMesgul(false);
    }
  }, [user?.id, events, haftayiOku]);

  // Uygulama arka plandan dönünce sessizce tazele. Uzun uykudan sonra elde
  // bayat veri kalmasın; tazeleme düşerse ekran açık kalır, uyarı çıkar.
  useEffect(() => {
    const dondu = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", dondu);
    return () => document.removeEventListener("visibilitychange", dondu);
  }, [load]);

  const schoolEvents = useMemo(() => {
    const found = events.filter(isSchoolEvent).filter((event) => event.date >= format(new Date(), "yyyy-MM-dd"));
    if (!isDemoMode || found.length) return found.sort((a, b) => a.date.localeCompare(b.date));
    return [
      { id: "ybs-demo-registration", title: "Ders kaydı ve ödeme son günü", date: "2026-09-27", tagColor: "school", isAllDay: true, recurrence: "none" },
      { id: "ybs-demo-midterm", title: "Güz ara sınavı", date: "2026-11-14", tagColor: "school", isAllDay: true, recurrence: "none" },
    ] as CalendarEvent[];
  }, [events, isDemoMode]);
  const schoolTasks = useMemo(() => tasks.filter(isSchoolTask).filter((task) => task.status !== "done"), [tasks]);
  const nextEvent = schoolEvents[0];
  const registrationTask = schoolTasks.find((task) => /kayıt|ödeme/i.test(task.title)) ?? schoolTasks[0];
  const completedChecklist = registrationTask?.checklist.filter((item) => item.completed).length ?? 0;
  const totalChecklist = registrationTask?.checklist.length ?? 0;

  const haftaHesabi = useMemo(() => planiHesapla(data, events, new Date()), [data, events]);
  const dersAdi = useCallback((kod: string | null) => data.courses.find((c) => c.kod === kod)?.ad ?? kod ?? "", [data.courses]);
  const haftaGunleri = useMemo(() => {
    const gunler = new Map<string, PlanSatiri[]>();
    for (const satir of haftaSatirlari) gunler.set(satir.tarih, [...(gunler.get(satir.tarih) ?? []), satir]);
    return Array.from(gunler.entries());
  }, [haftaSatirlari]);

  const gradesByCourse = useMemo(() => new Map(data.grades.map((grade) => [grade.ders_kodu, grade])), [data.grades]);
  const activeCourses = useMemo(() => data.courses.filter((course) => course.yariyil === 1), [data.courses]);
  const completedAkts = useMemo(() => completedCredits(data.courses, data.grades), [data.courses, data.grades]);
  const staleSources = data.sources.filter((source) => isSchoolSourceStale(source));
  const strategy = useMemo(() => buildSchoolStrategy(data.courses, data.grades), [data.courses, data.grades]);

  // Sinav tarihi panelin kendi uydurdugu bir sabit degil: motorun yazdigi
  // yonetilen olaydan okunuyor. Kaynak tarihi degistirirse plan da kayar.
  const examEvent = useMemo(
    () => schoolEvents.find((event) => /ara s\u0131nav/i.test(event.title)),
    [schoolEvents],
  );
  const outcomesByUnit = useMemo(() => {
    // Kazanım bloğu kimliğe bağlanıyor, bu yüzden metin değil tam kayıt tutuluyor.
    const map = new Map<string, { id: string; metin: string }[]>();
    for (const outcome of [...data.outcomes].sort((a, b) => a.sira - b.sira)) {
      map.set(outcome.unit_id, [...(map.get(outcome.unit_id) ?? []), { id: outcome.id, metin: outcome.metin }]);
    }
    return map;
  }, [data.outcomes]);

  // Kazanım ilerlemesi notlardan okunuyor: notta işaretlediğin kutucuk burada
  // aynı anda görünüyor, arada senkronlanacak ikinci bir kayıt yok.
  const isaretli = useMemo(() => isaretliKazanimlar(richNotes), [richNotes]);

  /** Bir konunun kazanımlarının kaçı işaretli. */
  const kazanimOrani = useCallback((unitId: string) => {
    const hepsi = outcomesByUnit.get(unitId) ?? [];
    if (!hepsi.length) return null;
    const biten = hepsi.filter((k) => isaretli.has(k.id)).length;
    return { biten, toplam: hepsi.length, tam: biten === hepsi.length };
  }, [outcomesByUnit, isaretli]);

  /**
   * Kazanımların tamamı işaretli olan, henüz dokunulmamış konular.
   *
   * Kazanım işaretlemek plana hiç yansımıyordu: konunun bütün hedeflerini
   * kapatıp panele bakınca hiçbir şey yapmamış gibi görünüyordun. İşaretli
   * kazanım beyandan daha güçlü bir kanıt — hepsi işaretliyse konu en az
   * "çalışıldı" sayılıyor. "Hakimim" hâlâ yalnız senin diyebileceğin şey.
   */
  const kazanimlaTamamlananlar = useMemo(() => {
    const kayitli = new Map(data.progress.map((row) => [row.unit_id, row.durum]));
    const cikti: string[] = [];
    for (const [unitId, kazanim] of Array.from(outcomesByUnit.entries())) {
      if (!kazanim.length || !kazanim.every((k) => isaretli.has(k.id))) continue;
      if ((kayitli.get(unitId) ?? "dokunulmadi") !== "dokunulmadi") continue;
      cikti.push(unitId);
    }
    return cikti;
  }, [data.progress, outcomesByUnit, isaretli]);

  /** Konuda hangi adımlar var: videosuz konuda İzle, sorusuz konuda Soru çöz yok. */
  const adimHaritasi = useMemo(
    () => mevcutAdimHaritasi(data.units, data.modules, data.questions),
    [data.units, data.modules, data.questions],
  );

  const progressMap = useMemo(() => {
    const map = new Map<string, UnitProgress>(data.progress.map((row) => [row.unit_id, row]));
    for (const unitId of kazanimlaTamamlananlar) {
      map.set(unitId, { ...(map.get(unitId) ?? { unit_id: unitId }), unit_id: unitId, durum: "calisildi" } as UnitProgress);
    }
    // Plan motoru adım listesini kayıttan okuyor; motorun `npm run plan`
    // çıktısıyla aynı rakamı vermesi bu zenginleştirmeye bağlı.
    for (const [unitId, kayit] of Array.from(map.entries())) {
      map.set(unitId, { ...kayit, mevcut: adimHaritasi.get(unitId) ?? ADIMLAR });
    }
    return map;
  }, [data.progress, kazanimlaTamamlananlar, adimHaritasi]);

  // Bu çıkarım tabloya da yazılıyor. Yazılmazsa panel 44.2 sa derken motorun
  // `npm run plan` çıktısı 45.1 sa derdi — iki ayrı gerçek, tam da bu projenin
  // kaçındığı şey. Yazılan her konu bir kez işleniyor; döngüye girmiyor.
  const yazilanKazanim = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.id || isDemoMode || !kazanimlaTamamlananlar.length) return;
    const yeni = kazanimlaTamamlananlar.filter((id) => !yazilanKazanim.current.has(id));
    if (!yeni.length) return;
    yeni.forEach((id) => yazilanKazanim.current.add(id));
    void (async () => {
      for (const unitId of yeni) {
        try {
          await setUnitProgress(user.id, unitId, "calisildi");
        } catch (e) {
          yazilanKazanim.current.delete(unitId);
          console.error("Kazanım ilerlemesi yazılamadı:", e);
        }
      }
      await load();
    })();
  }, [kazanimlaTamamlananlar, user?.id, isDemoMode, load]);

  const plan = useMemo(() => {
    if (!data.units.length || !examEvent) return null;
    return buildStudyPlan({
      units: data.units, ilerleme: progressMap, oturumlar: data.sessions, sinavTarihi: examEvent.date,
    });
  }, [data.units, data.sessions, progressMap, examEvent]);

  const questionsByUnit = useMemo(() => {
    const map = new Map<string, typeof data.questions>();
    for (const q of data.questions) {
      if (!q.unit_id) continue;
      map.set(q.unit_id, [...(map.get(q.unit_id) ?? []), q]);
    }
    return map;
  }, [data.questions]);

  const modulesByUnit = useMemo(() => {
    const map = new Map<string, typeof data.modules>();
    for (const m of data.modules) {
      map.set(m.unit_id, [...(map.get(m.unit_id) ?? []), m]);
    }
    for (const [k, v] of Array.from(map.entries())) {
      map.set(k, [...v].sort((a, b) => {
        const fark = MATERYAL_SIRASI.indexOf(materyalEtiketi(a.ad, a.tip)) - MATERYAL_SIRASI.indexOf(materyalEtiketi(b.ad, b.tip));
        return fark !== 0 ? fark : a.ad.localeCompare(b.ad, "tr");
      }));
    }
    return map;
  }, [data.modules]);

  const [acikMateryal, setAcikMateryal] = useState<string | null>(null);

  /**
   * Ders → konular.
   *
   * Panelde konuya dokunabildiğin tek yer günün üç öneri kartıydı: motor Türk
   * Dili önerirken canın Matematik çalışmak istiyorsa hiçbir yolu yoktu.
   * Öneri bir tavsiye olmalı, kapı değil — bütün konular buradan açılıyor.
   */
  const unitsByCourse = useMemo(() => {
    const map = new Map<string, StudyUnit[]>();
    for (const u of data.units as StudyUnit[]) {
      if (u.tip === "materyal") continue; // materyal bloğu konu değil
      map.set(u.ders_kodu, [...(map.get(u.ders_kodu) ?? []), u]);
    }
    const sira = { vize: 0, final: 1 } as Record<string, number>;
    for (const [kod, liste] of Array.from(map.entries())) {
      map.set(kod, [...liste].sort((a, b) => {
        const d = (sira[a.dilim ?? ""] ?? 2) - (sira[b.dilim ?? ""] ?? 2);
        return d !== 0 ? d : a.baslik.localeCompare(b.baslik, "tr");
      }));
    }
    return map;
  }, [data.units]);

  const answerQuestion = useCallback(async (questionId: string, harf: string, dogru: string | null) => {
    setVerilenCevap((onceki) => ({ ...onceki, [questionId]: harf }));
    if (!user?.id) return;
    await saveQuestionAttempt(user.id, questionId, harf, harf === dogru);
    // Kartta çözülen soru da konunun "Soru çöz" adımını işaretler.
    const unitId = data.questions.find((q) => q.id === questionId)?.unit_id;
    if (unitId) {
      await setUnitStep(user.id, unitId, "soru", true).catch((e) => console.error("Soru adımı yazılamadı:", e));
      await load();
    }
  }, [user?.id, data.questions, load]);

  const unitById = useMemo(() => new Map(data.units.map((u) => [u.id, u])), [data.units]);

  // Kartın metni notta, zamanlaması tabloda. Sıra ikisinin birleşiminden çıkıyor;
  // zamanlama kaydı olmayan kart yeni sayılıp hemen sıraya giriyor.
  const [kartCevrildi, setKartCevrildi] = useState(false);
  const [kartBusy, setKartBusy] = useState(false);
  const tekrarSirasi = useMemo(() => {
    const zamanlama = new Map(data.flashcards.map((f) => [f.id, f]));
    const simdi = new Date().toISOString();
    const birlesik = ezberKartlari(richNotes).map((kart) => {
      const z = zamanlama.get(kart.cardId);
      const durum: KartDurumu = z
        ? { ease: Number(z.ease), interval: z.interval_days, reps: z.reps, lapses: z.lapses, dueAt: z.due_at, lastReviewedAt: z.last_reviewed_at }
        : yeniKart(simdi);
      return { ...kart, durum, dueAt: durum.dueAt };
    });
    return zamaniGelenler(birlesik, simdi);
  }, [richNotes, data.flashcards]);
  const aktifKart = tekrarSirasi[0];

  const kartiDegerlendir = useCallback(async (deger: Deger) => {
    if (!aktifKart || !user?.id) return;
    setKartBusy(true);
    try {
      const yeni = degerlendir(aktifKart.durum, deger, new Date());
      await saveCardReview(user.id, aktifKart.cardId, yeni, { unitId: aktifKart.unitId, dersKodu: aktifKart.dersKodu });
      setKartCevrildi(false);
      await load();
    } finally {
      setKartBusy(false);
    }
  }, [aktifKart, user?.id, load]);

  /**
   * Konu notunu açar; yoksa kazanımlar, materyal ve çıkmış sorularla dolu bir
   * şablon üretip birime bağlar. Boş bir not kutusu açmak işe yaramıyor —
   * neyi bilmen gerektiği notun içinde durmalı.
   */
  const openUnitNote = useCallback(async (unitId: string) => {
    const mevcut = progressMap.get(unitId)?.not_id;
    if (mevcut) {
      requestRichNote(mevcut);
      setView("notes");
      return;
    }
    const unit = unitById.get(unitId) as StudyUnit | undefined;
    if (!unit) return;
    setUnitBusy(unitId);
    try {
      const tohum = buildUnitNote(
        unit,
        outcomesByUnit.get(unitId) ?? [],
        modulesByUnit.get(unitId) ?? [],
        questionsByUnit.get(unitId) ?? [],
      );
      // Not konuya bağlanıyor: panel hangi konunun notu olduğunu buradan biliyor,
      // Notlar görünümü de dersine göre gruplayabiliyor.
      const not = addRichNote({ ...tohum, pinned: false });
      if (user?.id) await setUnitNote(user.id, unitId, not.id);
      requestRichNote(not.id);
      setView("notes");
      await load();
    } finally {
      setUnitBusy(null);
    }
  }, [progressMap, unitById, outcomesByUnit, modulesByUnit, questionsByUnit, addRichNote, requestRichNote, setView, user?.id, load]);


  /** Checklist'te bir adımı işaretler ya da kaldırır; geri alınabilir. */
  const [adimHatasi, setAdimHatasi] = useState<string | null>(null);
  const adimDegistir = useCallback(async (unitId: string, adim: Adim, isaretli: boolean) => {
    if (!user?.id) return;
    setUnitBusy(unitId);
    setAdimHatasi(null);
    try {
      const onceki = await setUnitStep(user.id, unitId, adim, isaretli);
      const baslik = unitById.get(unitId)?.baslik ?? "Konu";
      setSonIslem({
        unitId,
        onceki,
        mesaj: `${baslik.slice(0, 36)} · ${ADIM_ETIKETI[adim]} ${isaretli ? "✓" : "kaldırıldı"}`,
      });
      await load();
    } catch (e) {
      setAdimHatasi(e instanceof AdimKolonuYok
        ? e.message
        : `Kaydedilemedi: ${e instanceof Error ? e.message : "bilinmeyen hata"}`);
    } finally {
      setUnitBusy(null);
    }
  }, [user?.id, load, unitById]);

  const geriAl = useCallback(async () => {
    if (!sonIslem || !user?.id) return;
    const { unitId, onceki } = sonIslem;
    setSonIslem(null);
    setUnitBusy(unitId);
    try {
      if (typeof onceki === "string") await setUnitProgress(user.id, unitId, onceki);
      else await setUnitSteps(user.id, unitId, onceki);
      await load();
    } finally {
      setUnitBusy(null);
    }
  }, [sonIslem, user?.id, load]);

  // Bildirim kendiliğinden kapanır; geri alma penceresi kısa ama yeterli.
  useEffect(() => {
    if (!sonIslem) return;
    const t = window.setTimeout(() => setSonIslem(null), 7000);
    return () => window.clearTimeout(t);
  }, [sonIslem]);

  const acknowledge = useCallback((event: CalendarEvent) => {
    if (!event.ackRequired || event.ackedAt) return;
    updateEvent(event.id, { ackedAt: new Date().toISOString() });
    setAckMessage("Kritik tarih görüldü olarak işaretlendi.");
  }, [updateEvent]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ack");
    if (!id) return;
    const event = events.find((item) => item.id === id);
    if (event) acknowledge(event);
    window.history.replaceState({}, "", window.location.pathname + window.location.search.replace(/([?&])ack=[^&]*&?/, "$1").replace(/[?&]$/, ""));
  }, [acknowledge, events]);

  function saveQuickNote() {
    const content = quickNote.trim();
    if (!content) return;
    addRichNote({
      title: content.split("\n")[0].slice(0, 64) || "Okul notu",
      content,
      tags: ["okul", "YBS"],
      pinned: false,
    });
    setQuickNote("");
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 2200);
  }

  async function submitGrade(event: React.FormEvent) {
    event.preventDefault();
    if (!user?.id || !gradeCourse) return;
    setGradeStatus("Kaydediliyor…");
    try {
      await saveSchoolGrade(user.id, {
        courseCode: gradeCourse,
        term: "2026-2027 Güz",
        midterm: midterm === "" ? undefined : Number(midterm),
        final: finalScore === "" ? undefined : Number(finalScore),
      });
      setGradeStatus("Not kaydedildi");
      await load();
    } catch (error) {
      setGradeStatus(error instanceof Error ? error.message : "Not kaydedilemedi");
    }
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center" aria-label="Okul verileri yükleniyor"><Loader2 className="animate-spin" style={{ color: "var(--tag-school)" }} /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-4 sm:space-y-5">
      {/* İşaretlemenin geri bildirimi: bastığını görmek ve yanlışlıkla
          "Hakimim" dediğinde dönebilmek için. */}
      {adimHatasi && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--priority-high-bg)", color: "var(--priority-high-text)" }} role="alert">
          <AlertTriangle size={16} className="shrink-0" />
          <p className="text-[12px] flex-1">{adimHatasi}</p>
          <button onClick={() => setAdimHatasi(null)} className="text-[11px] font-semibold shrink-0">Kapat</button>
        </div>
      )}

      {sonIslem && (
        <div
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full px-4 py-2.5 shadow-lg animate-fade-in"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border-strong)" }}
          role="status"
        >
          <CheckCircle2 size={15} style={{ color: "var(--priority-low)" }} className="shrink-0" />
          <span className="text-[12px] truncate max-w-[46vw]">{sonIslem.mesaj}</span>
          <button onClick={() => void geriAl()} className="text-[12px] font-semibold shrink-0" style={{ color: "var(--brand-gold)" }}>
            Geri al
          </button>
        </div>
      )}

      {agHatasi && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)" }} role="alert">
          <CloudOff size={18} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Bağlantı yanıt vermedi</p>
            <p className="text-[11px] mt-0.5">{data.units.length ? "Son kaydedilen hâli gösteriliyor." : "Henüz gösterilecek veri yok."} {agHatasi}</p>
          </div>
          <button onClick={() => void load()} disabled={tazeleniyor} className="cp-btn cp-btn-ghost shrink-0 disabled:opacity-50">
            <RefreshCw size={14} className={tazeleniyor ? "animate-spin" : undefined} />Tekrar dene
          </button>
        </div>
      )}

      {(staleSources.length > 0 || data.warnings.length > 0 || syncStatus === "error") && (
        <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: "var(--priority-urgent-bg)", color: "var(--priority-urgent-text)", border: "1px solid color-mix(in srgb, var(--priority-urgent) 30%, transparent)" }} role="alert">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Okul verisinin bir bölümü doğrulanamadı</p>
            <p className="text-[11px] mt-1">{data.warnings[0] ?? `${staleSources.length} kaynak bayat veya hatalı. Kritik tarihi resmî bağlantıdan kontrol et.`}</p>
          </div>
          <button onClick={() => void load()} className="ml-auto cp-icon-button shrink-0" aria-label="Okul verilerini yenile"><RefreshCw size={16} /></button>
        </div>
      )}

      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <School size={20} style={{ color: "var(--tag-school)" }} />
            <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Okul</h1>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-tertiary)" }}>{data.profile?.program ?? "YBS dijital ajandan"}</p>
        </div>
        <button onClick={() => void load()} className="cp-btn cp-btn-ghost px-3" aria-label="Yenile"><RefreshCw size={15} /><span className="hidden sm:inline">Yenile</span></button>
      </header>

      <section className="cp-card p-4 sm:p-5" style={{ borderColor: "color-mix(in srgb, var(--tag-school) 42%, var(--border-default))" }}>
        <div className="flex items-center gap-2 mb-3">
          <NotebookPen size={18} style={{ color: "var(--tag-school)" }} />
          <div>
            <h2 className="text-[15px] font-semibold">Hızlı okul notu</h2>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Ders, soru veya aklına geleni kaybetmeden yakala.</p>
          </div>
        </div>
        <textarea
          value={quickNote}
          onChange={(event) => setQuickNote(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") saveQuickNote();
          }}
          rows={3}
          placeholder="Örn. Matematik I için ikinci bölümü tekrar et…"
          className="w-full resize-none rounded-xl p-3 text-[14px] outline-none"
          style={{ background: "var(--surface-sunken)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
          aria-label="Hızlı okul notu"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <button onClick={() => setView("notes")} className="text-[11px] min-h-11" style={{ color: "var(--text-tertiary)" }}>Okul notlarını aç <ChevronRight size={13} className="inline" /></button>
          <button onClick={saveQuickNote} disabled={!quickNote.trim()} className="cp-btn cp-btn-primary min-h-11 disabled:opacity-40"><Save size={14} />{noteSaved ? "Kaydedildi" : "Nota kaydet"}</button>
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)] gap-4 sm:gap-5 items-start">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={CalendarClock} title="Sıradaki kritik tarih" detail={`${schoolEvents.length} yaklaşan`} />
            {nextEvent ? (
              <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "var(--tag-school-bg)" }}>
                <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: "var(--surface-raised)", color: "var(--tag-school-text)" }}>
                  <strong className="text-xl leading-none">{parseISO(nextEvent.date).getDate()}</strong>
                  <span className="text-[10px] uppercase mt-1">{format(parseISO(nextEvent.date), "MMM")}</span>
                </div>
                <div className="min-w-0">
                  <span className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: "var(--surface-raised)", color: "var(--tag-school-text)" }}>{countdownLabel(nextEvent.date)}</span>
                  <h3 className="text-[15px] font-semibold mt-2 leading-snug">{nextEvent.title}</h3>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>
                    {format(parseISO(nextEvent.date), "dd.MM.yyyy")}
                    {nextEvent.source && <> · {nextEvent.source}</>}
                    {nextEvent.sourceUrl && <a href={nextEvent.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 underline underline-offset-2" aria-label="Resmî kaynağı aç">Kaynak</a>}
                  </p>
                  {nextEvent.ackRequired && (
                    <button onClick={() => acknowledge(nextEvent)} disabled={Boolean(nextEvent.ackedAt)} className="cp-btn cp-btn-ghost mt-2 min-h-9 text-[11px] disabled:opacity-60">
                      <CheckCircle2 size={13} />{nextEvent.ackedAt ? "Görüldü" : "Gördüm"}
                    </button>
                  )}
                </div>
              </div>
            ) : <EmptyState>Yaklaşan yönetilen okul olayı henüz yok. Motor yayınlandığında burada görünecek.</EmptyState>}
            {ackMessage && <p className="text-[10px] mt-2" role="status" style={{ color: "var(--priority-low-text)" }}>{ackMessage}</p>}
            {schoolEvents.slice(1, 4).map((event) => (
              <div key={event.id} className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                <span className="text-[11px] w-20 shrink-0" style={{ color: "var(--text-tertiary)" }}>{countdownLabel(event.date)}</span>
                <span className="text-[13px] truncate">{event.title}</span>
              </div>
            ))}
          </section>

          <section className="cp-card p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock size={17} style={{ color: "var(--tag-school)" }} />
                <h2 className="text-[15px] font-semibold">Bu hafta</h2>
              </div>
              <button onClick={() => void yenidenPlanla()} disabled={planMesgul || !user} className="cp-btn cp-btn-ghost text-[11px] shrink-0 disabled:opacity-50">
                <RefreshCw size={13} className={planMesgul ? "animate-spin" : undefined} />Yeniden planla
              </button>
            </div>
            <p className="text-[11px] -mt-1 mb-3" style={{ color: "var(--text-tertiary)" }}>
              Her gün 2 ders, ~1 saat. Plan her pazar 21:00'den sonra ilerlemene göre yeniden kurulur;
              takvimde her gün bir etkinlik olarak durur.
            </p>
            {planHatasi && <p className="text-[11px] mb-2" role="alert" style={{ color: "var(--priority-high-text)" }}>{planHatasi}</p>}
            {haftaHesabi?.plan.uyarilar.map((u) => (
              <p key={u} className="text-[11px] mb-2 rounded-xl px-3 py-2" style={{ background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)" }}>{u}</p>
            ))}
            {!haftaGunleri.length && !planHatasi && <EmptyState>Bu haftanın planı henüz kurulmadı. "Yeniden planla"ya bas.</EmptyState>}
            <ol className="space-y-1.5">
              {haftaGunleri.map(([tarih, satirlar]) => {
                const bugunMu = tarih === format(new Date(), "yyyy-MM-dd");
                const tur = satirlar[0]?.gun_turu;
                return (
                  <li key={tarih} className="rounded-xl p-2.5 flex gap-3" style={{
                    background: bugunMu ? "var(--tag-school-bg)" : "var(--surface-sunken)",
                    outline: bugunMu ? "1px solid color-mix(in srgb, var(--tag-school) 45%, transparent)" : "none",
                  }}>
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-[10px] uppercase" style={{ color: "var(--text-tertiary)" }}>{format(parseISO(tarih), "EEE", { locale: tr })}</p>
                      <p className="text-[15px] font-semibold leading-tight">{format(parseISO(tarih), "d")}</p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {tur === "sinav" && <p className="text-[12px] font-semibold" style={{ color: "var(--priority-high-text)" }}>Sınav günü</p>}
                      {tur === "bos" && <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>Plan yok</p>}
                      {satirlar.filter((s) => s.ders_kodu).map((s) => (
                        <div key={s.id}>
                          <p className="text-[12px] font-semibold leading-snug">
                            {dersAdi(s.ders_kodu)}
                            <span className="font-normal" style={{ color: "var(--text-tertiary)" }}> · {s.tur === "tekrar" ? "tekrar" : `${s.dakika} dk`}</span>
                          </p>
                          {s.tur === "konu" && s.parcalar.map((p) => (
                            <button
                              key={`${s.id}-${p.unit_id}`}
                              onClick={() => void openUnitNote(p.unit_id)}
                              className="block text-left text-[11px] leading-snug underline-offset-2 hover:underline min-h-6"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {p.baslik}{p.devam ? " (devam)" : ""}{p.bitiyor ? " — bugün biter" : ""} · {p.dakika} dk
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle
              icon={Target}
              title="Çalışma"
              detail={plan ? `${plan.esikteki_ders}/${plan.toplam_ders} ders eşikte` : undefined}
            />
            {!plan ? (
              <EmptyState>
                {data.units.length
                  ? "Yaklaşan ara sınav bulunamadı; plan sınav tarihine göre hesaplanıyor."
                  : "Ders konuları henüz yüklenmedi. Motor OYS kazısını yayınlayınca burada görünecek."}
              </EmptyState>
            ) : (
              <>
                <div className="rounded-2xl p-4" style={{ background: "var(--surface-sunken)" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{
                        background: plan.hal === "kritik" ? "var(--priority-high-bg)" : plan.hal === "geriliyor" ? "var(--priority-medium-bg)" : "var(--priority-low-bg)",
                        color: plan.hal === "kritik" ? "var(--priority-high-text)" : plan.hal === "geriliyor" ? "var(--priority-medium-text)" : "var(--priority-low-text)",
                      }}
                    >
                      {HAL_ETIKET[plan.hal]}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      {countdownLabel(plan.sinav_tarihi)} · kalan {saatce(plan.kalan_dakika)}
                    </span>
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: "var(--text-secondary)" }}>
                    Gereken tempo <strong>{plan.gereken_tempo} dk/gün</strong> · şu anki {plan.tempo_7g} dk/gün
                    {plan.tempo_kaynak === "beyan" && <> <span style={{ color: "var(--text-tertiary)" }}>(ölçüm yok, beyan edilen kapasite)</span></>}
                  </p>
                </div>

                <h3 className="text-[12px] font-semibold mt-4 mb-2" style={{ color: "var(--text-secondary)" }}>Bugün</h3>
                {plan.oneriler.map((oneri) => {
                  const kazanimlar = outcomesByUnit.get(oneri.unit_id) ?? [];
                  return (
                    <div key={oneri.unit_id} className="rounded-2xl p-3 mb-2" style={{ background: "var(--surface-sunken)" }}>
                      {/* Dar ekranda üç düğme aynı satırda durunca başlık dikey bir
                          şeride sıkışıyordu; mobilde düğmeler başlığın altına iniyor. */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold leading-snug">{oneri.baslik}</p>
                          <p className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-tertiary)" }}>
                            <span>{oneri.ders_kodu} · {oneri.dakika} dk · {oneri.kazanc} soru</span>
                            {oneri.esik_isi && <span style={{ color: "var(--priority-medium-text)" }}>eşik işi</span>}
                            <DurumRozeti durum={progressMap.get(oneri.unit_id)?.durum ?? "dokunulmadi"} />
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0 flex-wrap">
                          <button
                            onClick={() => void openUnitNote(oneri.unit_id)}
                            disabled={unitBusy === oneri.unit_id}
                            className="cp-btn cp-btn-ghost min-h-9 text-[11px] disabled:opacity-40"
                            title="Konu notunu aç"
                          >
                            <NotebookPen size={12} />Not
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <KonuChecklist
                          kayit={progressMap.get(oneri.unit_id)}
                          mevcut={adimHaritasi.get(oneri.unit_id) ?? ADIMLAR}
                          mesgul={unitBusy === oneri.unit_id}
                          onDegis={(adim, deger) => void adimDegistir(oneri.unit_id, adim, deger)}
                        />
                      </div>
                      {kazanimlar.length > 0 && (() => {
                        const biten = kazanimlar.filter((k) => isaretli.has(k.id)).length;
                        return (
                          <>
                            <p className="text-[10px] mt-2 mb-1" style={{ color: "var(--text-tertiary)" }}>
                              Kazanım {biten}/{kazanimlar.length}
                            </p>
                            <ul className="pl-4 space-y-1 list-disc" style={{ color: "var(--text-secondary)" }}>
                              {kazanimlar.map((k) => (
                                <li
                                  key={k.id}
                                  className="text-[11px] leading-snug"
                                  style={isaretli.has(k.id) ? { textDecoration: "line-through", color: "var(--text-tertiary)" } : undefined}
                                >
                                  {k.metin}
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                      {(modulesByUnit.get(oneri.unit_id) ?? []).length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => setAcikMateryal(acikMateryal === oneri.unit_id ? null : oneri.unit_id)}
                            className="cp-btn cp-btn-ghost min-h-9 text-[11px]"
                          >
                            <BookOpenCheck size={13} />
                            {acikMateryal === oneri.unit_id ? "Materyali kapat" : `Materyal (${(modulesByUnit.get(oneri.unit_id) ?? []).length})`}
                          </button>
                          {acikMateryal === oneri.unit_id && (
                            <ul className="mt-2 space-y-1">
                              {(modulesByUnit.get(oneri.unit_id) ?? []).map((mat) => (
                                <li key={mat.id}>
                                  <a
                                    href={mat.oys_url ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-snug"
                                    style={{ background: "var(--surface-raised)", color: "var(--text-primary)" }}
                                  >
                                    <span
                                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                      style={{ background: "var(--tag-school-bg)", color: "var(--tag-school-text)" }}
                                    >
                                      {materyalEtiketi(mat.ad, mat.tip)}
                                    </span>
                                    <span className="truncate flex-1">{mat.ad}</span>
                                    {mat.tahmini_dakika > 0 && (
                                      <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>{mat.tahmini_dakika} dk</span>
                                    )}
                                    <ArrowUpRight size={12} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {(questionsByUnit.get(oneri.unit_id) ?? []).length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => setAcikSoru(acikSoru === oneri.unit_id ? null : oneri.unit_id)}
                            className="cp-btn cp-btn-ghost min-h-9 text-[11px]"
                          >
                            <NotebookPen size={13} />
                            {acikSoru === oneri.unit_id ? "Soruyu kapat" : `Çıkmış soru (${(questionsByUnit.get(oneri.unit_id) ?? []).length})`}
                          </button>
                          {acikSoru === oneri.unit_id && (questionsByUnit.get(oneri.unit_id) ?? []).map((soru) => {
                            const verilen = verilenCevap[soru.id];
                            return (
                              <div key={soru.id} className="mt-2 rounded-xl p-3" style={{ background: "var(--surface-raised)" }}>
                                <p className="text-[12px] leading-snug font-medium">{soru.govde}</p>
                                <div className="mt-2 space-y-1">
                                  {soru.secenekler.map((sik) => {
                                    const secili = verilen === sik.harf;
                                    const dogruSik = verilen != null && sik.harf === soru.dogru;
                                    return (
                                      <button
                                        key={sik.harf}
                                        onClick={() => void answerQuestion(soru.id, sik.harf, soru.dogru)}
                                        disabled={verilen != null}
                                        className="w-full text-left rounded-lg px-2.5 py-2 text-[11px] leading-snug disabled:cursor-default"
                                        style={{
                                          background: dogruSik ? "var(--priority-low-bg)" : secili ? "var(--priority-high-bg)" : "var(--surface-sunken)",
                                          color: dogruSik ? "var(--priority-low-text)" : secili ? "var(--priority-high-text)" : "var(--text-primary)",
                                        }}
                                      >
                                        <strong className="mr-1.5">{sik.harf})</strong>{sik.metin}
                                      </button>
                                    );
                                  })}
                                </div>
                                {verilen != null && (
                                  <p className="text-[11px] mt-2" style={{ color: verilen === soru.dogru ? "var(--priority-low-text)" : "var(--priority-high-text)" }}>
                                    {verilen === soru.dogru ? "Doğru." : `Yanlış — doğrusu ${soru.dogru}.`}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <h3 className="text-[12px] font-semibold mt-4 mb-2" style={{ color: "var(--text-secondary)" }}>
                  Ders durumu <span className="font-normal" style={{ color: "var(--text-tertiary)" }}>· geçmek için 20 soruda 12</span>
                </h3>
                {plan.dersler.map((ders) => (
                  <div key={ders.ders_kodu} className="flex items-center gap-3 py-2">
                    <span className="text-[12px] w-20 shrink-0 font-medium">{ders.ders_kodu}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-sunken)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (ders.kapsanan / 12) * 100)}%`,
                          background: ders.esikte ? "var(--priority-low-text)" : "var(--tag-school-text)",
                        }}
                      />
                    </div>
                    <span className="text-[11px] w-32 text-right shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {ders.esikte ? "eşikte ✓" : `${ders.esige_kalan} soru eksik · ${saatce(ders.kalan_dakika)}`}
                    </span>
                  </div>
                ))}

                {plan.risk.length > 0 && (
                  <div className="rounded-2xl p-3 mt-3" style={{ background: "var(--priority-high-bg)" }}>
                    <p className="text-[11px] font-semibold" style={{ color: "var(--priority-high-text)" }}>
                      Bu tempoyla eşiğe ulaşamayan dersler
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--priority-high-text)" }}>
                      {plan.risk.map((r) => `${r.ders_kodu} (${saatce(r.gereken_dakika)})`).join(" · ")}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle
              icon={Layers}
              title="Bütün konular"
              detail={`${Array.from(unitsByCourse.values()).reduce((t, l) => t + l.length, 0)} konu`}
            />
            <p className="text-[11px] -mt-1 mb-3" style={{ color: "var(--text-tertiary)" }}>
              Günün önerisi bir tavsiye. Canın başka dersi çekiyorsa buradan aç.
            </p>
            {activeCourses.length === 0 && <EmptyState>Ders listesi henüz yüklenmedi.</EmptyState>}
            {activeCourses.map((course) => {
              const konular = unitsByCourse.get(course.kod) ?? [];
              if (!konular.length) return null;
              const acik = acikDers === course.kod;
              const dersDurumu = plan?.dersler.find((d) => d.ders_kodu === course.kod);
              const biten = konular.filter((u) => {
                const d = progressMap.get(u.id)?.durum;
                return d === "hakim" || d === "test_edildi";
              }).length;
              return (
                <div key={course.kod} className="border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                  <button
                    onClick={() => setAcikDers(acik ? null : course.kod)}
                    className="w-full flex items-center gap-3 py-3 text-left min-h-14"
                    aria-expanded={acik}
                  >
                    <ChevronRight
                      size={15}
                      className="shrink-0 transition-transform"
                      style={{ color: "var(--text-tertiary)", transform: acik ? "rotate(90deg)" : "none" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium truncate">{course.ad}</span>
                      <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {course.kod} · {konular.length} konu · {biten} hakim
                        {dersDurumu?.esikte && <> · <span style={{ color: "var(--priority-low-text)" }}>eşikte ✓</span></>}
                      </span>
                    </span>
                    {dersDurumu && (
                      <span className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "var(--surface-sunken)" }}>
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (dersDurumu.kapsanan / 12) * 100)}%`,
                            background: dersDurumu.esikte ? "var(--priority-low-text)" : "var(--tag-school-text)",
                          }}
                        />
                      </span>
                    )}
                  </button>
                  {acik && (
                    <ul className="pb-3 space-y-1.5">
                      {konular.map((konu) => {
                        const durum = progressMap.get(konu.id)?.durum ?? "dokunulmadi";
                        const kaz = kazanimOrani(konu.id);
                        return (
                          <li key={konu.id} className="rounded-xl p-2.5" style={{ background: "var(--surface-sunken)" }}>
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[12px] leading-snug font-medium">{konu.baslik}</p>
                                <p className="text-[10px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-tertiary)" }}>
                                  <span className="rounded-full px-1.5 py-0.5" style={{ background: "var(--surface-raised)" }}>
                                    {konu.dilim === "vize" ? "Vize" : konu.dilim === "final" ? "Final" : "—"}
                                  </span>
                                  <span>{konu.tahmini_dakika} dk</span>
                                  <span>· {konu.soru_degeri} soru</span>
                                  {kaz && <span>· kazanım {kaz.biten}/{kaz.toplam}</span>}
                                  <DurumRozeti durum={durum} />
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0 flex-wrap">
                                <button
                                  onClick={() => void openUnitNote(konu.id)}
                                  disabled={unitBusy === konu.id}
                                  className="cp-btn cp-btn-ghost min-h-11 text-[11px] disabled:opacity-40"
                                >
                                  <NotebookPen size={12} />Not
                                </button>
                              </div>
                            </div>
                            <div className="mt-2">
                              <KonuChecklist
                                kayit={progressMap.get(konu.id)}
                                mevcut={adimHaritasi.get(konu.id) ?? ADIMLAR}
                                mesgul={unitBusy === konu.id}
                                onDegis={(adim, deger) => void adimDegistir(konu.id, adim, deger)}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>

          {tekrarSirasi.length > 0 ? (
            <section className="cp-card p-4 sm:p-5">
              <SectionTitle icon={RefreshCw} title="Tekrar" detail={`${tekrarSirasi.length} kart hazır`} />
              <div className="rounded-2xl p-4" style={{ background: "var(--surface-sunken)" }}>
                <p className="text-[10px] mb-2" style={{ color: "var(--text-tertiary)" }}>
                  {aktifKart.dersKodu || "Kart"}
                </p>
                <p className="text-[14px] font-medium leading-snug">{aktifKart.on || "Ön yüz boş"}</p>
                {kartCevrildi ? (
                  <>
                    <p className="text-[12px] mt-3 leading-snug" style={{ color: "var(--text-secondary)" }}>
                      {aktifKart.arka || "Arka yüz boş"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {([["tekrar", "Bilemedim"], ["zor", "Zor"], ["iyi", "İyi"], ["kolay", "Kolay"]] as const).map(([deger, etiket]) => (
                        <button
                          key={deger}
                          onClick={() => void kartiDegerlendir(deger)}
                          disabled={kartBusy}
                          className="cp-btn cp-btn-ghost min-h-9 text-[11px] disabled:opacity-40"
                        >
                          {etiket}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <button onClick={() => setKartCevrildi(true)} className="cp-btn cp-btn-primary min-h-9 text-[11px] mt-3">
                    Çevir
                  </button>
                )}
              </div>
            </section>
          ) : (
            // Bölüm kart yokken tümüyle gizleniyordu: özelliğin var olduğunu
            // bilmenin yolu yoktu, kart eklemenin de.
            <section className="cp-card p-4 sm:p-5">
              <SectionTitle icon={RefreshCw} title="Tekrar" detail="0 kart" />
              <EmptyState>
                Zamanı gelen ezber kartı yok. Bir konu notunda <strong>/</strong> yazıp{" "}
                <strong>Ezber kartı</strong> ekle — ön yüze soruyu, arka yüze cevabı yaz;
                kart buraya kendiliğinden düşer.
              </EmptyState>
            </section>
          )}

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={CircleDollarSign} title="Kayıt ve ödeme" detail={totalChecklist ? `${completedChecklist}/${totalChecklist}` : undefined} />
            {registrationTask ? (
              <button onClick={() => openTaskModal(registrationTask)} className="w-full text-left rounded-2xl p-4 min-h-16" style={{ background: "var(--surface-sunken)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate">{registrationTask.title}</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>Kontrol listesini aç ve tamamlananları işaretle</p>
                  </div>
                  <ChevronRight size={17} className="shrink-0" />
                </div>
                {totalChecklist > 0 && <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "var(--border-default)" }}><div className="h-full rounded-full" style={{ width: `${(completedChecklist / totalChecklist) * 100}%`, background: "var(--tag-school)" }} /></div>}
              </button>
            ) : <EmptyState>Kayıt/ödeme görevi henüz yayınlanmadı.</EmptyState>}
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={Sparkles} title="Duyurular" detail={`${data.announcements.filter((item) => item.action_required).length} aksiyon`} />
            {data.announcements.length ? data.announcements.slice(0, 6).map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 py-3 border-b last:border-b-0 min-h-14" style={{ borderColor: "var(--border-subtle)" }}>
                <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: item.action_required ? "var(--priority-high)" : "var(--tag-school)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug">{item.baslik}</span>
                  <span className="block text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>{item.source}{item.published_at ? ` · ${format(parseISO(item.published_at), "dd.MM.yyyy")}` : ""}</span>
                </span>
                <ArrowUpRight size={14} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />
              </a>
            )) : <EmptyState>Aksiyon gerektiren duyuru yok. Boş olması kaynakların sağlıklı olduğu anlamına gelmez; aşağıdaki sağlık bölümünü kontrol et.</EmptyState>}
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={BookOpenCheck} title="Dersler ve notlar" detail={`1. yarıyıl · ${activeCourses.length} ders`} />
            {activeCourses.map((course) => {
              const grade = gradesByCourse.get(course.kod);
              const required = requiredFinal(grade?.vize);
              return (
                <div key={course.kod} className="grid grid-cols-[1fr_auto] gap-3 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="min-w-0"><p className="text-[13px] font-medium truncate">{course.ad}</p><p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>{course.kod} · {course.akts} AKTS</p></div>
                  <div className="text-right"><p className="text-[12px] font-medium">{grade?.harf ?? grade?.statu ?? "—"}</p>{required != null && <p className="text-[10px] mt-1" style={{ color: required >= 65 ? "var(--priority-high-text)" : "var(--text-tertiary)" }}>Final ≥ {required}</p>}</div>
                </div>
              );
            })}
            {!activeCourses.length && <EmptyState>Aktif yarıyıl müfredatı henüz yayınlanmadı.</EmptyState>}
            {user && activeCourses.length > 0 && (
              <form onSubmit={submitGrade} className="grid sm:grid-cols-[1fr_86px_86px_auto] gap-2 mt-4 p-3 rounded-2xl" style={{ background: "var(--surface-sunken)" }}>
                <select value={gradeCourse} onChange={(event) => setGradeCourse(event.target.value)} className="rounded-xl px-3 text-[12px] min-h-11" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }} aria-label="Ders seç"><option value="">Ders seç…</option>{activeCourses.map((course) => <option key={course.kod} value={course.kod}>{course.ad}</option>)}</select>
                <input value={midterm} onChange={(event) => setMidterm(event.target.value)} type="number" min="0" max="100" placeholder="Vize" className="rounded-xl px-3 text-[12px] min-h-11" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }} aria-label="Vize notu" />
                <input value={finalScore} onChange={(event) => setFinalScore(event.target.value)} type="number" min="0" max="100" placeholder="Final" className="rounded-xl px-3 text-[12px] min-h-11" style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)" }} aria-label="Final notu" />
                <button type="submit" disabled={!gradeCourse} className="cp-btn cp-btn-primary min-h-11 disabled:opacity-40"><Save size={14} />Kaydet</button>
                {gradeStatus && <p className="sm:col-span-4 text-[10px]" style={{ color: "var(--text-tertiary)" }}>{gradeStatus}</p>}
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-4 sm:space-y-5">
          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={Target} title="Haftalık strateji" detail={strategy.gabno == null ? "GABNO —" : `GABNO ${strategy.gabno.toFixed(2)}`} />
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl p-3" style={{ background: "var(--surface-sunken)" }}><p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Riskli ders</p><strong className="text-lg">{strategy.riskCourses.length}</strong></div>
              <div className="rounded-xl p-3" style={{ background: "var(--surface-sunken)" }}><p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Hesaplanan AKTS</p><strong className="text-lg">{strategy.evaluatedAkts}</strong></div>
            </div>
            <ol className="space-y-2">
              {strategy.nextActions.slice(0, 3).map((action, index) => <li key={action} className="flex gap-2 text-[11px] leading-relaxed"><span className="font-semibold" style={{ color: "var(--tag-school-text)" }}>{index + 1}.</span><span>{action}</span></li>)}
            </ol>
            <p className="text-[10px] mt-3" style={{ color: "var(--text-tertiary)" }}>Yalnız girilmiş notlardan hesaplanır; resmî transkript yerine geçmez.</p>
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={GraduationCap} title="Mezuniyet" detail={`${completedAkts}/240 AKTS`} />
            <div className="relative w-32 h-32 mx-auto my-4 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(var(--tag-school) ${(completedAkts / 240) * 360}deg, var(--surface-sunken) 0)` }}>
              <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center" style={{ background: "var(--surface-raised)" }}><strong className="text-2xl">%{Math.round((completedAkts / 240) * 100)}</strong><span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>tamamlandı</span></div>
            </div>
            <p className="text-[11px] text-center" style={{ color: "var(--text-tertiary)" }}>Notlar girildikçe başarılı derslerin AKTS toplamı otomatik ilerler.</p>
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={ShieldCheck} title="Sistem sağlığı" detail={`${data.sources.length - staleSources.length}/${data.sources.length}`} />
            {data.sources.map((source) => {
              const healthy = !isSchoolSourceStale(source);
              return (
                <div key={source.id} className="flex items-center gap-2 py-2.5">
                  {healthy ? <CheckCircle2 size={15} style={{ color: "var(--priority-low)" }} /> : <CloudOff size={15} style={{ color: "var(--priority-urgent)" }} />}
                  <div className="min-w-0 flex-1"><p className="text-[12px] truncate">{source.ad}</p><p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{source.last_ok_at ? `${format(parseISO(source.last_ok_at), "dd.MM HH:mm")} doğrulandı` : "Henüz doğrulanmadı"}</p></div>
                  {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="cp-icon-button" aria-label={`${source.ad} kaynağını aç`}><ArrowUpRight size={13} /></a>}
                </div>
              );
            })}
            {!data.sources.length && <EmptyState>Kaynak sağlık verisi henüz yok.</EmptyState>}
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle icon={School} title="Öğrenci profili" />
            <dl className="space-y-3 text-[12px]">
              <div><dt style={{ color: "var(--text-tertiary)" }}>Program</dt><dd className="mt-1">{data.profile?.program ?? "Henüz eklenmedi"}</dd></div>
              <div><dt style={{ color: "var(--text-tertiary)" }}>Sınav merkezi</dt><dd className="mt-1">{data.profile?.sinav_merkezi ?? "Henüz seçilmedi"}</dd></div>
              <div><dt style={{ color: "var(--text-tertiary)" }}>OBS</dt><dd className="mt-1">{data.profile?.obs_session_valid ? "Yardımlı oturum geçerli" : "Bağlı değil — parola saklanmaz"}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
