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
import { haftalikPlanKur, hedefHafta, type HaftalikPlan, type PlanDersi, type PlanGunu } from "./haftalik-plan";
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
  | { durum: "kuruldu"; hafta: string; plan: HaftalikPlan }
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

/** Takvimde görünen başlık: iki ders ve günün konusu. */
export function etkinlikBasligi(gun: PlanGunu, dersler: SchoolCourse[]): string {
  if (gun.tur === "tekrar") {
    return `🔁 Tekrar · ${gun.dersler.map((d) => kisaAd(d.ders_kodu, dersler)).join(" + ")}`;
  }
  const parca = (d: PlanDersi) => {
    const ilk = d.parcalar[0];
    if (!ilk) return kisaAd(d.ders_kodu, dersler);
    return `${kisaAd(d.ders_kodu, dersler)} · ${ilk.baslik}${ilk.devam ? " (devam)" : ""}`;
  };
  return `📘 ${gun.dersler.map(parca).join("  +  ")}`;
}

/** Etkinlik açıklaması: bütün parçalar ve süreleri. */
export function etkinlikAciklamasi(gun: PlanGunu, dersler: SchoolCourse[]): string {
  const satirlar: string[] = [];
  for (const d of gun.dersler) {
    satirlar.push(`${kisaAd(d.ders_kodu, dersler)} — ${d.tur === "tekrar" ? "tekrar" : `${d.dakika} dk`}`);
    if (d.tur === "tekrar") {
      satirlar.push("  • Konuların özetine ve çıkmış sorulara dön, ezber kartlarını çevir.");
    } else {
      for (const p of d.parcalar) {
        satirlar.push(`  • ${p.baslik}${p.devam ? " (devam)" : ""}${p.bitiyor ? " — bugün biter" : ""} · ${p.dakika} dk`);
      }
    }
  }
  satirlar.push("", "Konuyu açmak için: Okul → Bu hafta.");
  return satirlar.join("\n");
}

function satirlariUret(userId: string, hafta: string, plan: HaftalikPlan): PlanSatiri[] {
  const simdi = new Date().toISOString();
  const satirlar: PlanSatiri[] = [];
  for (const gun of plan.gunler) {
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

/** Planı hesaplar — yazmaz. Test ve önizleme için ayrı. */
export function planiHesapla(data: SchoolData, events: CalendarEvent[], simdi: Date): { hafta: string; plan: HaftalikPlan } | null {
  const hedef = hedefHafta(simdi);
  const sinav = enYakinSinav(events, format(simdi, "yyyy-MM-dd"));
  if (!sinav || !data.units.length) return null;
  const adimlar = mevcutAdimHaritasi(data.units, data.modules, data.questions);
  const ilerleme = new Map<string, UnitProgress>(
    data.progress.map((p) => [p.unit_id, { ...p, mevcut: adimlar.get(p.unit_id) ?? ADIMLAR }]),
  );
  const plan = haftalikPlanKur({
    units: data.units, ilerleme, sinavTarihi: sinav.tarih, dilim: sinav.dilim,
    baslangic: hedef.baslangic, bitis: hedef.bitis,
  });
  return { hafta: hedef.hafta, plan };
}

let calisiyor = false;

/**
 * Hedef haftanın planı yoksa (ya da `zorla` verildiyse) kurar ve yazar.
 *
 * Geçmiş günlere dokunulmaz: hafta ortasında yeniden planlanınca yalnız
 * bugünden pazara kadar olan günler değişir, geride kalanlar kayıt olarak kalır.
 */
export async function planiKurVeYaz(
  userId: string,
  events: CalendarEvent[],
  { zorla = false, simdi = new Date() }: { zorla?: boolean; simdi?: Date } = {},
): Promise<PlanSonucu> {
  const hedef = hedefHafta(simdi);
  if (calisiyor) return { durum: "guncel", hafta: hedef.hafta };
  calisiyor = true;
  try {
    if (!zorla) {
      const { data: var_, error } = await supabase
        .from("ybs_haftalik_plan").select("id").eq("user_id", userId).eq("hafta", hedef.hafta).limit(1);
      if (error) throw new Error(error.message);
      if (var_?.length) return { durum: "guncel", hafta: hedef.hafta };
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
    const satirlar = satirlariUret(userId, hedef.hafta, plan);
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

    return { durum: "kuruldu", hafta: hedef.hafta, plan };
  } finally {
    calisiyor = false;
  }
}
