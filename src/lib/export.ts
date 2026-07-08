/**
 * Faz 7 — Export Utilities
 * CSV for tasks, Markdown for notes, ICS for events
 */

import type { Task, DayNote, CalendarEvent, BackupData } from "@/types";
import { getPriorityLabel, getStatusLabel, getTagColorLabel } from "./utils";

// ── Tam Yedekleme (JSON) ───────────────────────────────────
// Uygulamadaki TÜM veriyi tek dosyada indirir. Bu dosya
// "Yedekten Geri Yükle" ile eksiksiz geri alınabilir.

export function exportFullBackup(data: Omit<BackupData, "app" | "version" | "exportedAt">): void {
  const backup: BackupData = {
    app: "epoche",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(backup, null, 2), `epoche-yedek-${date}.json`, "application/json;charset=utf-8;");
}

export function parseBackupFile(text: string): BackupData | null {
  try {
    const data = JSON.parse(text.replace(/^\uFEFF/, "")) as BackupData;
    if (data.app !== "epoche" || typeof data.version !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

// ── CSV Export ─────────────────────────────────────────────

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportTasksToCSV(tasks: Task[]): void {
  const headers = [
    "Baslik",
    "Durum",
    "Oncelik",
    "Etiketler",
    "Tarih",
    "Tahmini Sure (dk)",
    "Checklist Tamamlanan",
    "Checklist Toplam",
    "Olusturulma",
    "Tamamlanma",
  ];

  const rows = tasks.map((t) => [
    escapeCsv(t.title),
    escapeCsv(getStatusLabel(t.status)),
    escapeCsv(getPriorityLabel(t.priority)),
    escapeCsv(t.tags.map((tag) => tag.name).join(", ")),
    t.date,
    String(t.estimatedMinutes || ""),
    String(t.checklist.filter((c) => c.completed).length),
    String(t.checklist.length),
    t.createdAt.split("T")[0],
    t.completedAt?.split("T")[0] || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  downloadFile(csv, "epoche-gorevler.csv", "text/csv;charset=utf-8;");
}

// ── Markdown Export ────────────────────────────────────────

export function exportNotesToMarkdown(notes: DayNote[]): void {
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));

  const md = sorted
    .map((note) => {
      return `## ${note.date}\n\n${note.plainText || "(Bos not)"}\n\n---\n`;
    })
    .join("\n");

  const content = `# Epoche — Notlar\n\nExport tarihi: ${new Date().toLocaleDateString("tr-TR")}\n\n---\n\n${md}`;

  downloadFile(content, "epoche-notlar.md", "text/markdown;charset=utf-8;");
}

// ── ICS (iCalendar) Export ─────────────────────────────────

export function exportEventsToICS(events: CalendarEvent[]): void {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Epoche//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const dateClean = event.date.replace(/-/g, "");
    const startTime = event.startTime?.replace(":", "") || "0000";
    const endTime = event.endTime?.replace(":", "") || startTime;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@epoche`);
    lines.push(`SUMMARY:${event.title}`);

    if (event.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      lines.push(`DTEND;VALUE=DATE:${dateClean}`);
    } else {
      lines.push(`DTSTART:${dateClean}T${startTime}00`);
      lines.push(`DTEND:${dateClean}T${endTime}00`);
    }

    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  downloadFile(lines.join("\r\n"), "epoche-etkinlikler.ics", "text/calendar;charset=utf-8;");
}

// ── Download Helper ────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(["\ufeff" + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
