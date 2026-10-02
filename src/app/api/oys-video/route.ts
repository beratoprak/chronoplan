// ============================================================
// Epoche — OYS video aracısı (Plan v3, Faz F)
//
// POST /api/oys-video  { modulId }  (Authorization: Bearer <oturum>)
//   → { url }  kısa ömürlü, imzalı oynatma adresi
// GET  /api/oys-video?p=<yol>&e=<bitiş>&s=<imza>
//   → videonun bir parçası (206), OYS'den anahtarla alınıp iletilir
//
// Anahtar (OYS_TOKEN) yalnız burada, sunucuda. Hizmet yalnız YBS_USER_ID'ye:
// tablolara herkes kendi satırını yazabildiği için başka bir hesap kendi
// satırına video yolu yazıp bu anahtarı kullanamasın.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { araligiSinirla, imzaGecerli, imzala, OMUR_SN, VIDEO_YOLU } from "@/lib/oys-video";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OYS = "https://oys.ankara.edu.tr";

function ayarlar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servis = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anahtar = process.env.OYS_TOKEN;
  const sahip = process.env.YBS_USER_ID;
  if (!url || !servis || !anahtar || !sahip) return null;
  return { url, servis, anahtar, sahip };
}

export async function POST(request: Request): Promise<Response> {
  const a = ayarlar();
  if (!a) return Response.json({ error: "Video hizmeti kurulmamış (OYS_TOKEN / YBS_USER_ID)" }, { status: 503 });

  const jwt = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return Response.json({ error: "Giriş gerekli" }, { status: 401 });
  const supabase = createClient(a.url, a.servis, { auth: { persistSession: false } });
  const { data: kim } = await supabase.auth.getUser(jwt);
  if (!kim.user || kim.user.id !== a.sahip) return Response.json({ error: "Bu hesapta video yok" }, { status: 403 });

  const { modulId } = (await request.json().catch(() => ({}))) as { modulId?: string };
  if (!modulId) return Response.json({ error: "modulId gerekli" }, { status: 400 });
  const { data: modul } = await supabase
    .from("ybs_modules").select("yerel_dosya").eq("id", modulId).eq("user_id", a.sahip).maybeSingle();
  const yol = modul?.yerel_dosya as string | undefined;
  if (!yol || !VIDEO_YOLU.test(yol)) return Response.json({ error: "Bu videonun dosyası bilinmiyor" }, { status: 404 });

  const bitis = Math.floor(Date.now() / 1000) + OMUR_SN;
  const q = new URLSearchParams({ p: yol, e: String(bitis), s: imzala(yol, bitis, a.anahtar) });
  return Response.json({ url: `/api/oys-video?${q}` });
}

export async function GET(request: Request): Promise<Response> {
  const a = ayarlar();
  if (!a) return new Response("Video hizmeti kurulmamış", { status: 503 });
  const { searchParams } = new URL(request.url);
  const yol = searchParams.get("p") ?? "";
  const bitis = Number(searchParams.get("e"));
  if (!imzaGecerli(yol, bitis, searchParams.get("s") ?? "", a.anahtar)) {
    return new Response("Bağlantının süresi doldu", { status: 403 });
  }

  const oys = await fetch(`${OYS}/webservice/pluginfile.php/${yol}?token=${a.anahtar}`, {
    headers: { Range: araligiSinirla(request.headers.get("range")) },
    cache: "no-store",
  });
  // Moodle hata durumunda JSON döner; anahtar reddedildiyse bunu iletmenin anlamı yok.
  if (!oys.ok || /json/.test(oys.headers.get("content-type") ?? "")) {
    return new Response("OYS videoyu vermedi", { status: oys.status === 404 ? 404 : 502 });
  }
  const basliklar = new Headers({
    "content-type": oys.headers.get("content-type") ?? "video/mp4",
    "accept-ranges": "bytes",
    // Yalnız bu tarayıcı kısa süre saklayabilir; aracı sunucular saklamaz.
    "cache-control": "private, max-age=3600",
  });
  for (const k of ["content-range", "content-length"]) {
    const v = oys.headers.get(k);
    if (v) basliklar.set(k, v);
  }
  return new Response(oys.body, { status: oys.status, headers: basliklar });
}
