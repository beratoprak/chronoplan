"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle, ArrowUpRight, BookOpenCheck, CalendarClock, CheckCircle2,
  ChevronRight, CircleDollarSign, CloudOff, GraduationCap, Loader2, NotebookPen,
  RefreshCw, Save, School, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { buildSchoolDemoData, buildSchoolStrategy, completedCredits, fetchSchoolData, isSchoolSourceStale, requiredFinal, saveQuestionAttempt, saveSchoolGrade, setUnitProgress, type SchoolData } from "@/lib/school-data";
import { buildStudyPlan, type UnitProgress, type UnitProgressState } from "@/lib/study-plan";
import type { CalendarEvent, Task } from "@/types";

const EMPTY: SchoolData = { sources: [], courses: [], grades: [], announcements: [], profile: null, units: [], progress: [], outcomes: [], questions: [], attempts: [], sessions: [], warnings: [] };

const HAL_ETIKET = { yolunda: "Yolunda", geriliyor: "Geriliyor", kritik: "Kritik" } as const;
const DURUM_ETIKET: Record<UnitProgressState, string> = {
  dokunulmadi: "Başlamadım", calisildi: "Çalıştım", test_edildi: "Test ettim", hakim: "Hakimim",
};
const saatce = (dakika: number) => `${(dakika / 60).toFixed(1)} sa`;

function isSchoolTask(task: Task) {
  return task.isManaged || task.id.startsWith("ybs-") || task.tags.some((tag) => tag.color === "school" || tag.name.toLocaleLowerCase("tr-TR") === "okul");
}

function isSchoolEvent(event: CalendarEvent) {
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
  return <p className="text-[12px] py-3" style={{ color: "var(--text-tertiary)" }}>{children}</p>;
}

export function SchoolView() {
  const {
    user, isDemoMode, events, tasks, addRichNote, setView, openTaskModal, syncStatus, updateEvent,
  } = useAppStore();
  const [data, setData] = useState<SchoolData>(EMPTY);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    setData(isDemoMode ? buildSchoolDemoData() : await fetchSchoolData(user?.id));
    setLoading(false);
  }, [isDemoMode, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const schoolEvents = useMemo(() => {
    const found = events.filter(isSchoolEvent).filter((event) => event.date >= format(new Date(), "yyyy-MM-dd"));
    if (!isDemoMode || found.length) return found.sort((a, b) => a.date.localeCompare(b.date));
    return [
      { id: "ybs-demo-registration", title: "Ders kaydı ve ödeme son günü", date: "2026-09-27", tagColor: "school", isAllDay: true, recurrence: "none" },
      { id: "ybs-demo-midterm", title: "Güz ara sınavı", date: "2026-11-28", tagColor: "school", isAllDay: true, recurrence: "none" },
    ] as CalendarEvent[];
  }, [events, isDemoMode]);
  const schoolTasks = useMemo(() => tasks.filter(isSchoolTask).filter((task) => task.status !== "done"), [tasks]);
  const nextEvent = schoolEvents[0];
  const registrationTask = schoolTasks.find((task) => /kayıt|ödeme/i.test(task.title)) ?? schoolTasks[0];
  const completedChecklist = registrationTask?.checklist.filter((item) => item.completed).length ?? 0;
  const totalChecklist = registrationTask?.checklist.length ?? 0;

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
  const progressMap = useMemo(
    () => new Map<string, UnitProgress>(data.progress.map((row) => [row.unit_id, row])),
    [data.progress],
  );
  const plan = useMemo(() => {
    if (!data.units.length || !examEvent) return null;
    return buildStudyPlan({
      units: data.units, ilerleme: progressMap, oturumlar: data.sessions, sinavTarihi: examEvent.date,
    });
  }, [data.units, data.sessions, progressMap, examEvent]);
  const outcomesByUnit = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const outcome of [...data.outcomes].sort((a, b) => a.sira - b.sira)) {
      map.set(outcome.unit_id, [...(map.get(outcome.unit_id) ?? []), outcome.metin]);
    }
    return map;
  }, [data.outcomes]);

  const questionsByUnit = useMemo(() => {
    const map = new Map<string, typeof data.questions>();
    for (const q of data.questions) {
      if (!q.unit_id) continue;
      map.set(q.unit_id, [...(map.get(q.unit_id) ?? []), q]);
    }
    return map;
  }, [data.questions]);

  const answerQuestion = useCallback(async (questionId: string, harf: string, dogru: string | null) => {
    setVerilenCevap((onceki) => ({ ...onceki, [questionId]: harf }));
    if (!user?.id) return;
    await saveQuestionAttempt(user.id, questionId, harf, harf === dogru);
  }, [user?.id]);

  const markUnit = useCallback(async (unitId: string, durum: UnitProgressState) => {
    if (!user?.id) return;
    setUnitBusy(unitId);
    try {
      await setUnitProgress(user.id, unitId, durum);
      await load();
    } finally {
      setUnitBusy(null);
    }
  }, [user?.id, load]);

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
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold leading-snug">{oneri.baslik}</p>
                          <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                            {oneri.ders_kodu} · {oneri.dakika} dk · {oneri.kazanc} soru
                            {oneri.esik_isi && <> · <span style={{ color: "var(--priority-medium-text)" }}>eşik işi</span></>}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {(["calisildi", "hakim"] as const).map((durum) => (
                            <button
                              key={durum}
                              onClick={() => void markUnit(oneri.unit_id, durum)}
                              disabled={unitBusy === oneri.unit_id}
                              className="cp-btn cp-btn-ghost min-h-9 text-[11px] disabled:opacity-40"
                            >
                              {unitBusy === oneri.unit_id ? <Loader2 size={12} className="animate-spin" /> : DURUM_ETIKET[durum]}
                            </button>
                          ))}
                        </div>
                      </div>
                      {kazanimlar.length > 0 && (
                        <ul className="mt-2 pl-4 space-y-1 list-disc" style={{ color: "var(--text-secondary)" }}>
                          {kazanimlar.map((metin) => <li key={metin} className="text-[11px] leading-snug">{metin}</li>)}
                        </ul>
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
                    <span className="text-[11px] w-24 text-right shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {ders.esikte ? "eşikte ✓" : `${ders.esige_kalan} soru · ${saatce(ders.kalan_dakika)}`}
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
