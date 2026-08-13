// ============================================================
// Epoche — Supabase Canlı Tutucu
//
// Supabase ücretsiz planı, 7 gün boyunca hiç API isteği almayan
// projeleri duraklatır; duraklayınca alan adı DNS'ten kalkar ve
// uygulamada giriş "Load failed" ile başarısız olur (13.08.2026'da
// tam olarak bu yaşandı).
//
// Bu uç nokta günde bir kez Vercel cron tarafından çağrılır ve
// veritabanına tek satırlık bir sorgu atar — proje "aktif" sayılır.
//
// Cron tanımı: vercel.json > crons
// İsteğe bağlı env: CRON_SECRET (tanımlıysa yalnız cron çağırabilir)
// ============================================================

import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  // CRON_SECRET tanımlıysa Vercel cron'u bunu Authorization başlığında
  // gönderir; tanımlı değilse uç nokta herkese açıktır (zararsız).
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !key) {
    return Response.json(
      { ok: false, error: "Supabase ortam değişkenleri eksik" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // En ucuz sorgu: satır gövdesi değil yalnızca sayım başlığı döner.
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { head: true, count: "exact" });

  // Not: RLS bir hata döndürse bile istek projeye ulaşmıştır, yani
  // duraklamayı önleme amacı gerçekleşir. Yine de görünürlük için raporla.
  return Response.json(
    {
      ok: !error,
      pingedAt: new Date().toISOString(),
      taskCount: count ?? null,
      error: error?.message ?? null,
    },
    { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
