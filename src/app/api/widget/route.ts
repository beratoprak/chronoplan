// ============================================================
// Epoche — Widget Veri Ucu
// Scriptable iPhone widget'ı bu JSON'u çekerek Epoche tasarımında
// bugünün programını ve görevlerini çizer.
//
// GET /api/widget?token=<kullanıcı-id>
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { expandEvents } from "@/lib/planner";
import type { CalendarEvent, RecurrenceType, TagColor } from "@/types";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  tag_color: string;
  is_all_day: boolean;
  recurrence: string;
  recurrence_end_date: string | null;
  deleted_at?: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  date: string | null;
  deleted_at?: string | null;
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    tagColor: row.tag_color as TagColor,
    isAllDay: row.is_all_day,
    recurrence: (row.recurrence as RecurrenceType) ?? "none",
    recurrenceEndDate: row.recurrence_end_date ?? undefined,
  };
}

// İstanbul saatiyle YYYY-MM-DD
function localDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return Response.json({ error: "Geçersiz token" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY eksik" }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [eventsRes, tasksRes] = await Promise.all([
    supabase.from("events").select("*").eq("user_id", token),
    supabase.from("tasks").select("*").eq("user_id", token),
  ]);

  if (eventsRes.error || tasksRes.error) {
    return Response.json({ error: "Veri okunamadı" }, { status: 500 });
  }

  const today = localDate();
  const weekEnd = localDate(7);

  const allEvents = ((eventsRes.data ?? []) as EventRow[])
    .filter((e) => !e.deleted_at)
    .map(rowToEvent);
  const allTasks = ((tasksRes.data ?? []) as TaskRow[]).filter(
    (t) => !t.deleted_at && t.status !== "done"
  );

  // Tekrarlı etkinlikler dahil, bugünden 7 gün ilerisine açılım
  const expanded = expandEvents(allEvents, today, weekEnd).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "")
  );

  const todayEvents = expanded
    .filter((e) => e.date === today)
    .map((e) => ({
      title: e.title,
      startTime: e.isAllDay ? null : e.startTime ?? null,
      endTime: e.isAllDay ? null : e.endTime ?? null,
      tagColor: e.tagColor,
      isAllDay: e.isAllDay,
    }));

  const todayTasks = allTasks
    .filter((t) => t.date === today)
    .map((t) => ({ title: t.title, priority: t.priority }));

  const upcoming = [
    ...expanded
      .filter((e) => e.date > today)
      .map((e) => ({ date: e.date, title: e.title, type: "event" as const, time: e.isAllDay ? null : e.startTime ?? null })),
    ...allTasks
      .filter((t) => t.date && t.date > today && t.date <= weekEnd)
      .map((t) => ({ date: t.date!, title: t.title, type: "task" as const, time: null })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, 6);

  return Response.json(
    {
      app: "epoche",
      generatedAt: new Date().toISOString(),
      today,
      todayEvents,
      todayTasks,
      upcoming,
      counts: { events: todayEvents.length, tasks: todayTasks.length },
    },
    {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" },
    }
  );
}
