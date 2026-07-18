// Yayındaki derleme kimliği — istemci kendi kimliğiyle karşılaştırır,
// farklıysa "Yeni sürüm hazır" bildirimi gösterir.

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    { build: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
