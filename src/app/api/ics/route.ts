// ============================================================
// Epoche — ICS Takvim Aboneliği
// Apple Takvim / Google Takvim bu adrese abone olur; böylece
// Epoche etkinlikleri telefonun ve Mac'in yerli takviminde,
// kilit ekranı / ana ekran widget'larında görünür.
//
// Kullanım: GET /api/ics?token=<kullanıcı-id>
// Google'ın "gizli adres" modeliyle aynı: token'ı bilen okuyabilir.
//
// Gerekli env (Vercel > Settings > Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase Dashboard > Settings > API)
// ============================================================

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  end_time: string | null;
  is_all_day: boolean;
  recurrence: string;
  recurrence_end_date: string | null;
  deleted_at?: string | null;
}

// ICS metin alanlarında özel karakterleri kaçır
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsDate(date: string): string {
  return date.replace(/-/g, "");
}

function icsDateTime(date: string, time: string): string {
  return `${icsDate(date)}T${time.replace(":", "")}00`;
}

function addOneDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const RRULE_FREQ: Record<string, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
};

function eventToVevent(e: EventRow): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${e.id}@epoche`);
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`);
  lines.push(`SUMMARY:${escapeIcs(e.title)}`);

  const timed = !e.is_all_day && e.start_time;
  if (timed) {
    const start = icsDateTime(e.date, e.start_time!);
    const end = e.end_time ? icsDateTime(e.date, e.end_time) : start;
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(addOneDay(e.date))}`);
  }

  const freq = RRULE_FREQ[e.recurrence];
  if (freq) {
    let rrule = `FREQ=${freq}`;
    if (e.recurrence_end_date) {
      rrule += timed
        ? `;UNTIL=${icsDate(e.recurrence_end_date)}T235959`
        : `;UNTIL=${icsDate(e.recurrence_end_date)}`;
    }
    lines.push(`RRULE:${rrule}`);
  }

  if (e.description) {
    lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("Geçersiz token", { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return new Response(
      "Takvim aboneliği henüz etkin değil: Vercel ortam değişkenlerine SUPABASE_SERVICE_ROLE_KEY eklenmeli.",
      { status: 503 }
    );
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("events").select("*").eq("user_id", token);

  if (error) {
    return new Response("Etkinlikler okunamadı", { status: 500 });
  }

  const events = ((data ?? []) as EventRow[]).filter((e) => !e.deleted_at);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Epoche//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Epoche",
    "X-WR-TIMEZONE:Europe/Istanbul",
  ];
  for (const e of events) {
    lines.push(...eventToVevent(e));
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Takvim uygulamaları periyodik çeker; 5 dk edge cache yeterli
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
    },
  });
}
