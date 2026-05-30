"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, RotateCcw, Settings, Clock } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates";
import type { PomodoroPhase, WorkSession } from "@/types";

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: "Çalışma",
  short_break: "Kısa Mola",
  long_break: "Uzun Mola",
};

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  work: "var(--brand-gold)",
  short_break: "var(--tag-project)",
  long_break: "var(--tag-work)",
};

function pad(n: number) { return n.toString().padStart(2, "0"); }

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}sa ${m}dk` : `${h}sa`;
}

function groupSessionsByDate(sessions: WorkSession[]): { date: string; sessions: WorkSession[] }[] {
  const map = new Map<string, WorkSession[]>();
  sessions.forEach((s) => {
    const date = s.completedAt.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(s);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, sessions]) => ({ date, sessions }));
}

export function PomodoroView() {
  const { pomodoroSettings, setPomodoroSettings, workSessions, addWorkSession, researchProjects } = useAppStore();

  // Timer state
  const [phase, setPhase] = useState<PomodoroPhase>("work");
  const [timeLeft, setTimeLeft] = useState(pomodoroSettings.workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [label, setLabel] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // Settings edit state
  const [editWork, setEditWork] = useState(pomodoroSettings.workMinutes.toString());
  const [editShort, setEditShort] = useState(pomodoroSettings.shortBreakMinutes.toString());
  const [editLong, setEditLong] = useState(pomodoroSettings.longBreakMinutes.toString());
  const [editSessions, setEditSessions] = useState(pomodoroSettings.sessionsBeforeLongBreak.toString());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = useMemo(() => {
    if (phase === "work") return pomodoroSettings.workMinutes * 60;
    if (phase === "short_break") return pomodoroSettings.shortBreakMinutes * 60;
    return pomodoroSettings.longBreakMinutes * 60;
  }, [phase, pomodoroSettings]);

  const progress = 1 - timeLeft / totalSeconds;
  const circumference = 2 * Math.PI * 90; // r=90

  function resetTimer(newPhase?: PomodoroPhase) {
    const p = newPhase || phase;
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const mins = p === "work" ? pomodoroSettings.workMinutes
      : p === "short_break" ? pomodoroSettings.shortBreakMinutes
      : pomodoroSettings.longBreakMinutes;
    setTimeLeft(mins * 60);
  }

  function switchPhase(next: PomodoroPhase) {
    setPhase(next);
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const mins = next === "work" ? pomodoroSettings.workMinutes
      : next === "short_break" ? pomodoroSettings.shortBreakMinutes
      : pomodoroSettings.longBreakMinutes;
    setTimeLeft(mins * 60);
  }

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Session complete
          clearInterval(intervalRef.current!);
          setRunning(false);

          // Log session
          if (phase === "work") {
            const newCount = sessionCount + 1;
            setSessionCount(newCount);
            addWorkSession({
              projectLabel: label || "Genel",
              durationMinutes: pomodoroSettings.workMinutes,
              phase: "work",
            });
            // Next phase
            const isLongBreak = newCount % pomodoroSettings.sessionsBeforeLongBreak === 0;
            const nextPhase: PomodoroPhase = isLongBreak ? "long_break" : "short_break";
            setTimeout(() => switchPhase(nextPhase), 500);
          } else {
            setTimeout(() => switchPhase("work"), 500);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase]);

  function saveSettings() {
    setPomodoroSettings({
      workMinutes: parseInt(editWork) || 25,
      shortBreakMinutes: parseInt(editShort) || 5,
      longBreakMinutes: parseInt(editLong) || 15,
      sessionsBeforeLongBreak: parseInt(editSessions) || 4,
    });
    resetTimer();
    setShowSettings(false);
  }

  // Weekly stats
  const weeklyMinutes = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return workSessions
      .filter((s) => s.phase === "work" && s.completedAt >= weekAgo)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [workSessions]);

  const todaySessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return workSessions.filter((s) => s.completedAt.startsWith(today) && s.phase === "work").length;
  }, [workSessions]);

  const grouped = useMemo(() => groupSessionsByDate(workSessions.filter((s) => s.phase === "work")), [workSessions]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex gap-6 h-full animate-fade-in">
      {/* Left: Timer */}
      <div className="flex flex-col items-center gap-6 flex-1">
        {/* Phase selector */}
        <div className="flex gap-2">
          {(["work", "short_break", "long_break"] as PomodoroPhase[]).map((p) => (
            <button key={p} onClick={() => switchPhase(p)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
              style={{
                background: phase === p ? PHASE_COLORS[p] : "var(--surface-raised)",
                color: phase === p ? "#fff" : "var(--text-secondary)",
              }}>
              {PHASE_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Circular timer */}
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="110" cy="110" r="90" fill="none" stroke="var(--border-default)" strokeWidth="8" />
            <circle cx="110" cy="110" r="90" fill="none"
              stroke={PHASE_COLORS[phase]}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center gap-1">
            <span className="text-4xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {pad(minutes)}:{pad(seconds)}
            </span>
            <span className="text-xs font-medium" style={{ color: PHASE_COLORS[phase] }}>
              {PHASE_LABELS[phase]}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {sessionCount} / {pomodoroSettings.sessionsBeforeLongBreak} oturum
            </span>
          </div>
        </div>

        {/* Project label */}
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Ne üzerinde çalışıyorsun? (opsiyonel)"
          className="text-sm text-center px-4 py-2 rounded-xl outline-none w-full max-w-xs"
          style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)", color: "var(--text-primary)" }} />

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button onClick={() => resetTimer()}
            className="p-3 rounded-xl hover:opacity-70 transition-opacity"
            style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
            <RotateCcw size={18} />
          </button>
          <button onClick={() => setRunning((r) => !r)}
            className="px-8 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: PHASE_COLORS[phase], color: "#fff" }}>
            {running ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={() => setShowSettings((v) => !v)}
            className="p-3 rounded-xl hover:opacity-70 transition-opacity"
            style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>
            <Settings size={18} />
          </button>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4">
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: "var(--surface-raised)" }}>
            <p className="text-lg font-bold" style={{ color: "var(--brand-gold)" }}>{todaySessions}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Bugün oturum</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: "var(--surface-raised)" }}>
            <p className="text-lg font-bold" style={{ color: "var(--brand-gold)" }}>{formatDuration(weeklyMinutes)}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Bu hafta</p>
          </div>
          <div className="text-center px-4 py-2 rounded-xl" style={{ background: "var(--surface-raised)" }}>
            <p className="text-lg font-bold" style={{ color: "var(--brand-gold)" }}>{workSessions.filter((s) => s.phase === "work").length}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Toplam oturum</p>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="w-full max-w-xs p-4 rounded-xl flex flex-col gap-3"
            style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Ayarlar (dakika)</p>
            {[
              { label: "Çalışma", value: editWork, set: setEditWork },
              { label: "Kısa Mola", value: editShort, set: setEditShort },
              { label: "Uzun Mola", value: editLong, set: setEditLong },
              { label: "Uzun Mola Sıklığı (oturum)", value: editSessions, set: setEditSessions },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                <input type="number" value={value} onChange={(e) => set(e.target.value)}
                  className="w-16 px-2 py-1 text-sm text-center rounded-lg outline-none"
                  style={{ background: "var(--surface-sunken)", border: "0.5px solid var(--border-default)", color: "var(--text-primary)" }} />
              </div>
            ))}
            <button onClick={saveSettings}
              className="w-full py-1.5 text-xs rounded-lg font-medium"
              style={{ background: "var(--brand-gold)", color: "#fff" }}>Kaydet</button>
          </div>
        )}
      </div>

      {/* Right: Session log */}
      <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: "var(--brand-gold)" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Çalışma Günlüğü</span>
        </div>
        {grouped.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
            Henüz tamamlanan oturum yok
          </p>
        ) : (
          grouped.map(({ date, sessions }) => (
            <div key={date} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {formatDate(date, "d MMMM yyyy")}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {formatDuration(sessions.reduce((s, w) => s + w.durationMinutes, 0))}
                </span>
              </div>
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PHASE_COLORS[s.phase] }} />
                  <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    {s.projectLabel}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {s.durationMinutes}dk
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
