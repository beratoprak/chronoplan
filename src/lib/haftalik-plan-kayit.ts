// Haftalık planı kurar, kaydeder ve takvime yazar (Plan v3, Faz B).
//
// Hesap `haftalik-plan.ts`'te (saf); burası yalnız veriyi toplayıp sonucu
// yazar. Plan kullanıcının kendi oturumuyla yazılır, motor bu kayıtlara
// dokunmaz. Takvim etkinlikleri `is_managed` ve kendi kaynak adıyla yazılıyor:
// motorun uzlaştırması yalnız kendi kaynaklarına baktığı için bu etkinlikleri
// emekliye ayırmaz.

import { addDays, format, parseISO } from "date-fns";
import { supabase } from "./supabase";
import { fetchSchoolData, type SchoolCourse, type SchoolData } from "./school-data";
import { haftaAnahtari, haftalikPlanKur, hedefAralik, PLAN_SURUM_ANI, yenidenKurulmali, type HaftalikPlan, type PlanDersi, type PlanGunu, type YenidenKurNedeni } from "./haftalik-plan";
import { ADIMLAR, mevcutAdimHaritasi } from "./ilerleme";
import type { UnitProgress } from "./study-plan";
import type { CalendarEvent } from "@/types";

export const PLAN_KAYNAGI = "ybs-haftalik-plan";
export const planEtkinlikId = (tarih: string) => `ybs-plan-${tarih}`;

export interface PlanSatiri {
  id: string;
  user_id: string;
  hafta: string;
  tarih: string;
  gun_turu: PlanGunu["tur"];
  sira: number;
  ders_kodu: string | null;
  tur: PlanDersi["tur"] | null;
  dakika: number;
  parcalar: PlanDersi["parcalar"];
  olusturma: string;
}

export type PlanSonucu =
  | { durum: "kuruldu"; hafta: string; plan: HaftalikPlan; neden: YenidenKurNedeni | "elle" }
  | { durum: "guncel"; hafta: string }
  | { durum: "sinav-yok" | "veri-yok"; hafta: string };

/**
 * En yakın sınav: başlangıcından bir gün sonrasına kadar hâlâ "yaklaşan"
 * sayılır (sınav Cmt+Paz sürüyor). Ara sınav → vize konuları, final → final.
 */
export function enYakinSinav(events: CalendarEvent[], bugun: string): { tarih: string; dilim: "vize" | "final" } | null {
  const adaylar = events
    .filter((e) => !(e as { deletedAt?: string }).deletedAt)
    .map((e) => ({ e, dilim: /ara sınav/i.test(e.title) ? "vize" as const : /final/i.test(e.title) ? "final" as const : null }))
    .filter((x): x is { e: CalendarEvent; dilim: "vize" | "final" } => x.dilim !== null)
    .filter((x) => format(addDays(parseISO(x.e.date), 1), "yyyy-MM-dd") >= bugun)
    .sort((a, b) => a.e.date.localeCompare(b.e.date));
  return adaylar[0] ? { tarih: adaylar[0].e.date, dilim: adaylar[0].dilim } : null;
}

const kisaAd = (kod: string, dersler: SchoolCourse[]) =>
  (dersler.find((d) => d.kod === kod)?.ad ?? kod).replace(/\s+Ve\s+/g, " ve ");

/** Uzun konu adını sözcük sınırında kısaltır; tam adı açıklamada duruyor. */
export function kisalt(metin: string, uzunluk: number): string {
  if (metin.length <= uzunluk) return metin;
  const kesik = metin.slice(0, uzunluk);
  const bosluk = kesik.lastIndexOf(" ");
  return `${(bosluk > uzunluk * 0.6 ? kesik.slice(0, bosluk) : kesik).replace(/[\s,;:·-]+$/, "")}…`;
}

/** Takvimde görünen başlık: günün dersleri ve konusu (konu adı kısaltılmış). */
export function etkinlikBasligi(gun: PlanGunu, dersler: SchoolCourse[]): string {
  if (gun.tur === "tekrar") {
    return `🔁 Tekrar · ${gun.dersler.map((d) => kisaAd(d.ders_kodu, dersler)).join(" + ")}`;
  }
  const parca = (d: PlanDersi) => {
    const ilk = d.parcalar[0];
    if (!ilk) return kisaAd(d.ders_kodu, dersler);
    const ek = d.parcalar.length > 1 ? ` +${d.parcalar.length - 1}` : ilk.devam ? " (devam)" : "";
    return `${kisaAd(d.ders_kodu, dersler)} · ${kisalt(ilk.baslik, d.parcalar.length > 1 || gun.dersler.length === 1 ? 40 : 34)}${ek}`;
  };
  return `📘 ${gun.dersler.map(parca).join("  +  ")}`;
}

/** Bölünmüş konu için kısa not; konu bütünse boş. */
export function parcaNotu(p: { devam: boolean; bitiyor: boolean }): string {
  if (p.bitiyor) return p.devam ? " — bugün bitir" : "";
  return p.devam ? " — biraz daha ilerle, sonra bitir" : " — bugün başla, sonra bitir";
}

/** Etkinlik açıklaması: bütün konular. Süre yazılmaz (26 Ekim kararı). */
export function etkinlikAciklamasi(gun: PlanGunu, dersler: SchoolCourse[]): string {
  const satirlar: string[] = [];
  for (const d of gun.dersler) {
    satirlar.push(`${kisaAd(d.ders_kodu, dersler)}${d.tur === "tekrar" ? " — tekrar" : ""}`);
    if (d.tur === "tekrar") {
      satirlar.push("  • Konuların özetine ve çıkmış sorulara dön, ezber kartlarını çevir.");
    } else {
      for (const p of d.parcalar) {
        satirlar.push(`  • ${p.baslik}${p.devam ? " (devam)" : ""}${parcaNotu(p)}`);
      }
    }
  }
  satirlar.push("", "Konuyu açmak için: Okul → Bu hafta.");
  return satirlar.join("\n");
}

function satirlariUret(userId: string, plan: HaftalikPlan): PlanSatiri[] {
  const simdi = new Date().toISOString();
  const satirlar: PlanSatiri[] = [];
  for (const gun of plan.gunler) {
    // Son düzlükte plan birden çok haftaya yayılır: her satır kendi haftasında.
    const hafta = haftaAnahtari(gun.tarih);
    if (!gun.dersler.length) {
      satirlar.push({
        id: `${userId}:${gun.tarih}:0`, user_id: userId, hafta, tarih: gun.tarih, gun_turu: gun.tur,
        sira: 0, ders_kodu: null, tur: null, dakika: 0, parcalar: [], olusturma: simdi,
      });
      continue;
    }
    gun.dersler.forEach((d, i) => satirlar.push({
      id: `${userId}:${gun.tarih}:${i + 1}`, user_id: userId, hafta, tarih: gun.tarih, gun_turu: gun.tur,
      sira: i + 1, ders_kodu: d.ders_kodu, tur: d.tur, dakika: d.dakika, parcalar: d.parcalar, olusturma: simdi,
    }));
  }
  return satirlar;
}

/** Bu hafta için kayıtlı plan satırları (gün sayfası ve panel okur). */
export async function haftaninPlani(userId: string, hafta: string): Promise<PlanSatiri[]> {
  const { data, error } = await supabase
    .from("ybs_haftalik_plan")
    .select("*")
    .eq("user_id", userId)
    .eq("hafta", hafta)
    .order("tarih")
    .order("sira");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanSatiri[];
}

/** Tarih aralığındaki plan satırları (son düzlükte birden çok hafta). */
export async function araliktakiPlan(userId: string, baslangic: string, bitis: string): Promise<PlanSatiri[]> {
  const { data, error } = await supabase
    .from("ybs_haftalik_plan")
    .select("*")
    .eq("user_id", userId)
    .gte("tarih", baslangic)
    .lte("tarih", bitis)
    .order("tarih")
    .order("sira");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanSatiri[];
}

/** Tek günün plan satırları (gün sayfası). Hafta değil tarih: geçmiş haftanın günü de açılabilsin. */
export async function gununPlani(userId: string, tarih: string): Promise<PlanSatiri[]> {
  const { data, error } = await supabase
    .from("ybs_haftalik_plan")
    .select("*")
    .eq("user_id", userId)
    .eq("tarih", tarih)
    .order("sira");
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanSatiri[];
}

/** Planı hesaplar — yazmaz. Test ve önizleme için ayrı. */
export function planiHesapla(data: SchoolData, events: CalendarEvent[], simdi: Date): { hafta: string; baslangic: string; bitis: string; plan: HaftalikPlan } | null {
  const hedef = planAraligi(events, simdi);
  const sinav = hedef.sinav;
  if (!sinav || !data.units.length) return null;
  const adimlar = mevcutAdimHaritasi(data.units, data.modules, data.questions);
  const ilerleme = new Map<string, UnitProgress>(
    data.progress.map((p) => [p.unit_id, { ...p, mevcut: adimlar.get(p.unit_id) ?? ADIMLAR }]),
  );
  const oturumlar = new Map((data.oturumlar ?? []).filter((o) => o.dilim === sinav.dilim).map((o) => [o.ders_kodu, { tarih: o.tarih, oturum: o.oturum }]));
  const plan = haftalikPlanKur({
    units: data.units, ilerleme, sinavTarihi: sinav.tarih, dilim: sinav.dilim, oturumlar,
    baslangic: hedef.baslangic, bitis: hedef.bitis,
  });
  return { hafta: hedef.hafta, baslangic: hedef.baslangic, bitis: hedef.bitis, plan };
}

/**
 * Planlanacak aralık ve sınav. Sınav, planın kurulduğu haftanın ilk gününe
 * göre seçilir (Faz H). Bugüne göre seçilseydi vizeden sonraki pazar akşamı
 * (15 Kasım) ara sınav hâlâ "yaklaşan" sayılır, 16 Kasım haftası geçmiş
 * vizeye göre kurulurdu.
 */
export function planAraligi(events: CalendarEvent[], simdi: Date) {
  const ilk = hedefAralik(simdi, null);
  const sinav = enYakinSinav(events, ilk.baslangic);
  return { ...hedefAralik(simdi, sinav?.tarih ?? null), sinav };
}

/** Plan yeniden kurulmalı mı — iki küçük okumayla. */
async function kurulmaNedeni(userId: string, hedef: ReturnType<typeof planAraligi>, bugun: string): Promise<YenidenKurNedeni | null> {
  const [hafta, sonrasi, ilerleme] = await Promise.all([
    supabase.from("ybs_haftalik_plan").select("id").eq("user_id", userId).eq("hafta", hedef.hafta).limit(1),
    supabase.from("ybs_haftalik_plan").select("tarih,olusturma").eq("user_id", userId).gte("tarih", hedef.baslangic)
      .order("tarih", { ascending: false }).limit(60),
    supabase.from("ybs_unit_progress").select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1),
  ]);
  for (const r of [hafta, sonrasi]) if (r.error) throw new Error(r.error.message);
  const satirlar = (sonrasi.data ?? []) as { tarih: string; olusturma: string }[];
  const sonKurulum = satirlar.reduce<string | null>((m, s) => (!m || s.olusturma > m ? s.olusturma : m), null);
  return yenidenKurulmali({
    bugun,
    sonDuzluk: hedef.sonDuzluk,
    haftaVar: Boolean(hafta.data?.length),
    sinavaUzaniyor: Boolean(hedef.sinav && satirlar.some((s) => String(s.tarih).slice(0, 10) >= hedef.sinav!.tarih)),
    sonKurulum,
    sonIlerleme: (ilerleme.data?.[0] as { updated_at?: string } | undefined)?.updated_at ?? null,
    surumAni: PLAN_SURUM_ANI,
  });
}

let calisiyor = false;

/**
 * Gerekiyorsa (bkz. `yenidenKurulmali`) ya da `zorla` verildiyse planı kurar
 * ve yazar.
 *
 * Geçmiş günlere dokunulmaz: yeniden planlanınca yalnız bugünden aralığın
 * sonuna kadar olan günler değişir, geride kalanlar kayıt olarak kalır.
 */
export async function planiKurVeYaz(
  userId: string,
  events: CalendarEvent[],
  { zorla = false, simdi = new Date() }: { zorla?: boolean; simdi?: Date } = {},
): Promise<PlanSonucu> {
  const hedef = planAraligi(events, simdi);
  if (calisiyor) return { durum: "guncel", hafta: hedef.hafta };
  calisiyor = true;
  try {
    let neden: YenidenKurNedeni | "elle" = "elle";
    if (!zorla) {
      const n = await kurulmaNedeni(userId, hedef, format(simdi, "yyyy-MM-dd"));
      if (!n) return { durum: "guncel", hafta: hedef.hafta };
      neden = n;
    }

    const data = await fetchSchoolData(userId);
    if (!data.units.length) return { durum: "veri-yok", hafta: hedef.hafta };
    const hesap = planiHesapla(data, events, simdi);
    if (!hesap) return { durum: "sinav-yok", hafta: hedef.hafta };
    const { plan } = hesap;

    // 1) Plan satırları: aralıktaki eskileri sil, yenilerini yaz.
    const { error: silmeHatasi } = await supabase
      .from("ybs_haftalik_plan").delete()
      .eq("user_id", userId).gte("tarih", hedef.baslangic).lte("tarih", hedef.bitis);
    if (silmeHatasi) throw new Error(silmeHatasi.message);
    const satirlar = satirlariUret(userId, plan);
    const { error: yazmaHatasi } = await supabase.from("ybs_haftalik_plan").insert(satirlar);
    if (yazmaHatasi) throw new Error(yazmaHatasi.message);

    // 2) Takvim: dersi olan her güne bir tüm-gün etkinliği. Kimlik tarihten:
    //    yeniden planlanınca aynı etkinlik güncellenir, çoğalmaz.
    const zaman = new Date().toISOString();
    const etkinlikler = plan.gunler
      .filter((g) => g.dersler.length && (g.tur === "calisma" || g.tur === "tekrar"))
      .map((g) => ({
        id: planEtkinlikId(g.tarih),
        user_id: userId,
        title: etkinlikBasligi(g, data.courses),
        description: etkinlikAciklamasi(g, data.courses),
        date: g.tarih,
        start_time: null,
        end_time: null,
        tag_color: "school",
        is_all_day: true,
        recurrence: "none",
        is_managed: true,
        source: PLAN_KAYNAGI,
        updated_at: zaman,
        deleted_at: null,
        reminders: [],
      }));
    if (etkinlikler.length) {
      const { error } = await supabase.from("events").upsert(etkinlikler, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    // 3) Aralıkta artık plan olmayan günlerin etkinliği emekliye ayrılır
    //    (v1'deki hayalet sınav hatası tekrarlanmasın).
    const tutulan = etkinlikler.map((e) => e.id);
    let emekli = supabase.from("events")
      .update({ deleted_at: zaman, updated_at: zaman })
      .eq("user_id", userId).eq("source", PLAN_KAYNAGI).is("deleted_at", null)
      .gte("date", hedef.baslangic).lte("date", hedef.bitis);
    if (tutulan.length) emekli = emekli.not("id", "in", `(${tutulan.join(",")})`);
    const { error: emekliHatasi } = await emekli;
    if (emekliHatasi) throw new Error(emekliHatasi.message);

    return { durum: "kuruldu", hafta: hedef.hafta, plan, neden };
  } finally {
    calisiyor = false;
  }
}
