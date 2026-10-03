"use client";

import { AciklamaKarti, haftaninAciklamasi } from "@/components/school/GeminiParcalari";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2,
  ChevronRight, CircleDollarSign, CloudOff, GraduationCap, Loader2, NotebookPen,
  Layers, RefreshCw, Save, School, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { buildSchoolDemoData, buildSchoolStrategy, completedCredits, fetchSchoolData, isSchoolSourceStale, okulOnbellegi, saveCardReview, setUnitProgress, type SchoolData } from "@/lib/school-data";
import { buildStudyPlan, type UnitProgress } from "@/lib/study-plan";
import { ezberKartlari, isaretliKazanimlar } from "@/lib/note-blocks";
import { haftaninPlani, PLAN_KAYNAGI, planiHesapla, planiKurVeYaz, type PlanSatiri } from "@/lib/haftalik-plan-kayit";
import { hedefHafta } from "@/lib/haftalik-plan";
import { dersOzetleri, soruSayisi, sureYazi } from "@/lib/ders-paneli";
import { ADIMLAR, mevcutAdimHaritasi } from "@/lib/ilerleme";
import { degerlendir, yeniKart, zamaniGelenler, type Deger, type KartDurumu } from "@/lib/spaced-repetition";
import type { CalendarEvent, Task } from "@/types";

const EMPTY: SchoolData = { sources: [], courses: [], grades: [], announcements: [], profile: null, units: [], progress: [], outcomes: [], modules: [], questions: [], attempts: [], flashcards: [], sessions: [], warnings: [] };

const HAL_ETIKET = { yolunda: "Yolunda", geriliyor: "Geriliyor", kritik: "Kritik" } as const;

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

export function SchoolView() {
  const {
    user, isDemoMode, events, tasks, addRichNote, setView, openTaskModal, syncStatus, updateEvent,
    richNotes, openGunSayfasi, openDersSayfasi,
  } = useAppStore();
  // Önbellek varsa ekran ilk karede dolu açılır; ağ arkadan tazeler.
  const [data, setData] = useState<SchoolData>(() => okulOnbellegi(user?.id) ?? EMPTY);
  const [loading, setLoading] = useState(() => !okulOnbellegi(user?.id));
  /** Son tazeleme düştüyse kullanıcıya söylenir; ekran yine de açık kalır. */
  const [agHatasi, setAgHatasi] = useState<string | null>(null);
  const [tazeleniyor, setTazeleniyor] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [ackMessage, setAckMessage] = useState<string | null>(null);

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

  const activeCourses = useMemo(() => data.courses.filter((course) => course.yariyil === 1), [data.courses]);
  const completedAkts = useMemo(() => completedCredits(data.courses, data.grades), [data.courses, data.grades]);
  const staleSources = data.sources.filter((source) => isSchoolSourceStale(source));
  // OYS mobil anahtarı reddedildiyse (süresi doldu ya da iptal) ders içeriği
  // güncellenmiyor; genel "kaynak bayat" uyarısı ne yapılacağını söylemiyordu.
  const oysAnahtari = staleSources.find((source) => source.id === "oys-mobil" && source.last_error === "OYS anahtarını yenile");
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

  /** Dersler bölümü: her ders bir satır, eşiğe en uzak olan üstte (Faz D). */
  const dersOzet = useMemo(() => dersOzetleri({
    kodlar: activeCourses.map((c) => c.kod).filter((kod) => data.units.some((u) => u.ders_kodu === kod && u.tip === "konu")),
    units: data.units, ilerleme: progressMap, adimHaritasi, haftaSatirlari,
  }), [activeCourses, data.units, progressMap, adimHaritasi, haftaSatirlari]);

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

  if (loading) {
    return <div className="h-full flex items-center justify-center" aria-label="Okul verileri yükleniyor"><Loader2 className="animate-spin" style={{ color: "var(--tag-school)" }} /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-4 sm:space-y-5">
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
            <p className="text-[11px] mt-1">{data.warnings[0] ?? (oysAnahtari && staleSources.length === 1
              ? "OYS anahtarını yenile: ders içeriği güncellenmiyor. Bilgisayarda ybs-panel klasöründe npm run oys:kesif çalıştır."
              : `${staleSources.length} kaynak bayat veya hatalı. Kritik tarihi resmî bağlantıdan kontrol et.`)}</p>
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
            <div className="mb-3 empty:hidden"><AciklamaKarti aciklama={haftaninAciklamasi(data.aciklamalar, haftaSatirlari[0]?.hafta ?? hafta)} /></div>
            {haftaHesabi?.plan.uyarilar.map((u) => (
              <p key={u} className="text-[11px] mb-2 rounded-xl px-3 py-2" style={{ background: "var(--priority-medium-bg)", color: "var(--priority-medium-text)" }}>{u}</p>
            ))}
            {!haftaGunleri.length && !planHatasi && <EmptyState>Bu haftanın planı henüz kurulmadı. "Yeniden planla"ya bas.</EmptyState>}
            <ol className="space-y-1.5">
              {haftaGunleri.map(([tarih, satirlar]) => {
                const bugunMu = tarih === format(new Date(), "yyyy-MM-dd");
                const tur = satirlar[0]?.gun_turu;
                return (
                  <li key={tarih}>
                  {/* Güne basınca o günün gün sayfası (föy) açılır — takvimdeki etkinlikle aynı. */}
                  <button onClick={() => openGunSayfasi(tarih)} className="w-full text-left rounded-xl p-2.5 flex gap-3 items-center" style={{
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
                            <span key={`${s.id}-${p.unit_id}`} className="block text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                              {p.baslik}{p.devam ? " (devam)" : ""}{p.bitiyor ? " — bugün biter" : ""} · {p.dakika} dk
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                    <ChevronRight size={15} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="cp-card p-4 sm:p-5">
            <SectionTitle
              icon={Layers}
              title="Dersler"
              detail={plan ? `Vize · ${format(parseISO(plan.sinav_tarihi), "d MMMM", { locale: tr })} · ${plan.esikteki_ders}/${plan.toplam_ders} ders eşikte` : undefined}
            />
            {plan && (
              <p className="text-[11px] -mt-1 mb-3 flex items-center gap-2 flex-wrap" style={{ color: "var(--text-tertiary)" }}>
                <span
                  className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: plan.hal === "kritik" ? "var(--priority-high-bg)" : plan.hal === "geriliyor" ? "var(--priority-medium-bg)" : "var(--priority-low-bg)",
                    color: plan.hal === "kritik" ? "var(--priority-high-text)" : plan.hal === "geriliyor" ? "var(--priority-medium-text)" : "var(--priority-low-text)",
                  }}
                >
                  {HAL_ETIKET[plan.hal]}
                </span>
                <span>{countdownLabel(plan.sinav_tarihi)} · vizeye kalan iş {sureYazi(plan.kalan_dakika)} · gereken {plan.gereken_tempo} dk/gün</span>
              </p>
            )}
            <p className="text-[11px] mb-2" style={{ color: "var(--text-tertiary)" }}>
              Çubuk: vize kapsamındaki ~20 sorudan kaçını karşılıyorsun. Çizgi geçme eşiği (12). Derse basınca konuları açılır.
            </p>
            {plan && plan.risk.length > 0 && (
              <p className="text-[11px] mb-2 rounded-xl px-3 py-2" style={{ background: "var(--priority-high-bg)", color: "var(--priority-high-text)" }}>
                Bu tempoyla eşiğe ulaşamayan dersler: {plan.risk.map((r) => `${dersAdi(r.ders_kodu)} (${sureYazi(r.gereken_dakika)})`).join(" · ")}
              </p>
            )}
            {!dersOzet.length && (
              <EmptyState>Ders konuları henüz yüklenmedi. Motor OYS kazısını yayınlayınca burada görünecek.</EmptyState>
            )}
            <ul>
              {dersOzet.map((d) => {
                const course = activeCourses.find((c) => c.kod === d.kod);
                return (
                  <li key={d.kod} style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
                    <button onClick={() => openDersSayfasi(d.kod)} className="w-full flex items-center gap-3 py-3 text-left min-h-14">
                      <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-5">
                        <span className="sm:flex-1 min-w-0">
                          <span className="block text-[13px] font-medium truncate">{course?.ad ?? d.kod}</span>
                          <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                            {d.kod}{course ? ` · ${course.akts} AKTS` : ""} · vize {d.konular.vize.length} konu
                            {d.buHafta.length > 0 && <span style={{ color: "var(--tag-school-text)" }}> · bu hafta {d.buHafta.length} konu</span>}
                          </span>
                        </span>
                        <span className="sm:w-[42%] shrink-0">
                          <span className="relative block h-2 rounded-full" style={{ background: "var(--surface-sunken)" }}>
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${Math.min(100, d.yuzde)}%`, background: d.esikte ? "var(--priority-low-text)" : "var(--tag-school)" }}
                            />
                            <span className="absolute -inset-y-1 w-0.5 rounded" style={{ left: `${d.esikYeri}%`, background: "var(--text-secondary)" }} aria-hidden />
                          </span>
                          <span className="block text-[10px] mt-1" style={{ color: d.esikte ? "var(--priority-low-text)" : "var(--text-tertiary)" }}>
                            %{d.yuzde} · {d.esikte ? "eşikte ✓" : `eşiğe ${soruSayisi(d.esige_kalan)}`}
                          </span>
                        </span>
                      </span>
                      <ChevronRight size={15} className="shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    </button>
                  </li>
                );
              })}
            </ul>
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

        </div>

        <aside className="space-y-4 sm:space-y-5">
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
                  <div className="min-w-0 flex-1"><p className="text-[12px] truncate">{source.ad}</p><p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{source.last_ok_at ? `${format(parseISO(source.last_ok_at), "dd.MM HH:mm")} doğrulandı` : "Henüz doğrulanmadı"}</p>{!healthy && source.last_error && <p className="text-[10px] font-medium" style={{ color: "var(--priority-urgent)" }}>{source.last_error}</p>}</div>
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
