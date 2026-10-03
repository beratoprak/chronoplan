// Okul notları: takvimin genel notlarından bağımsız, klasörlü not alanı (v17).
//
// Neden ayrı: okul notları genel not sayfasına karışıyordu, PDF'in yanında
// alınan notlar ise hiçbir yerde görünmüyordu. Okulla ilgili her not burada,
// kullanıcının açtığı ve sürükleyip bıraktığı iç içe klasörlerde durur.
// Uygulama da iki kök klasör kurar: "PDF notlarım" ve "Ders notlarım"; altında
// Ders → Konu. Yeni PDF notu ve konu notu kendiliğinden yerine düşer.

import { supabase } from "./supabase";

export type KokTuru = "pdf" | "ders";
export type NotTuru = "serbest" | "konu" | "pdf";

export interface OkulKlasor {
  id: string;
  ust_id: string | null;
  ad: string;
  sira: number;
  ders_kodu: string | null;
  unit_id: string | null;
  /** Uygulamanın kurduğu klasörde hangi kökten olduğu; kullanıcının açtığında boş. */
  kok: KokTuru | null;
}

export interface OkulNot {
  id: string;
  klasor_id: string | null;
  baslik: string;
  icerik: string;
  tur: NotTuru;
  /** PDF notunda belgenin depo yolu (`<ders>/<cmid>.pdf`). */
  kaynak: string | null;
  ders_kodu: string | null;
  unit_id: string | null;
  sira: number;
  olusturma: string;
  guncelleme: string;
}

/** Notun hangi derse ve konuya ait olduğu: otomatik klasör yolu bundan kurulur. */
export interface DersBaglami {
  dersKodu: string;
  dersAdi: string;
  unitId?: string | null;
  konuAdi?: string | null;
  /** Konu klasörünün ders içindeki sırası (konu numarası). */
  konuSira?: number | null;
}

export const KOK_ADI: Record<KokTuru, string> = { pdf: "PDF notlarım", ders: "Ders notlarım" };

const TABLO_YOK = "Okul notları için veritabanı güncellemesi bekleniyor (migration-epoche-v17-okul-notlari.sql).";

function hataMetni(e: { code?: string; message: string }): string {
  if (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message)) return TABLO_YOK;
  return e.message;
}

export const yeniKimlik = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ── Saf hesaplar (testli) ─────────────────────────────────────────

/** Kardeşlerin sonuna eklenecek öğenin sırası. */
export function sonrakiSira(kardesler: { sira: number }[]): number {
  return kardesler.reduce((m, k) => Math.max(m, k.sira), 0) + 1;
}

/** `hedef`in önüne bırakılan öğenin sırası: hedefle bir öncekinin ortası. */
export function oncesineSira(kardesler: { id: string; sira: number }[], hedefId: string): number {
  const sirali = [...kardesler].sort((a, b) => a.sira - b.sira);
  const i = sirali.findIndex((k) => k.id === hedefId);
  if (i < 0) return sonrakiSira(kardesler);
  const onceki = i > 0 ? sirali[i - 1].sira : sirali[i].sira - 2;
  return (onceki + sirali[i].sira) / 2;
}

/** Klasör, kendisinin ya da kendi alt klasörünün içine taşınamaz. */
export function tasinabilirMi(klasorId: string, hedefId: string | null, klasorler: OkulKlasor[]): boolean {
  let k: string | null = hedefId;
  const ust = new Map(klasorler.map((x) => [x.id, x.ust_id]));
  for (let adim = 0; k && adim < 1000; adim++) {
    if (k === klasorId) return false;
    k = ust.get(k) ?? null;
  }
  return true;
}

/** Klasörün kökten itibaren adları ("PDF notlarım › İşletme › 1. Giriş"). */
export function klasorYolu(klasorId: string | null, klasorler: OkulKlasor[]): OkulKlasor[] {
  const harita = new Map(klasorler.map((k) => [k.id, k]));
  const yol: OkulKlasor[] = [];
  let k = klasorId ? harita.get(klasorId) : undefined;
  while (k && yol.length < 50) {
    yol.unshift(k);
    k = k.ust_id ? harita.get(k.ust_id) : undefined;
  }
  return yol;
}

/**
 * Otomatik klasör yolunu bulur, eksik halkaları kurar: Kök → Ders → Konu.
 * Klasörler adlarıyla değil (kok, ders_kodu, unit_id) ile tanınır: kullanıcı
 * yeniden adlandırsa ya da başka yere taşısa da yeni notlar oraya düşer;
 * silerse yeniden kurulur.
 */
export function otomatikKlasor(
  klasorler: OkulKlasor[],
  kok: KokTuru,
  baglam: DersBaglami | null,
): { klasorId: string; yeniler: OkulKlasor[] } {
  const hepsi = [...klasorler];
  const yeniler: OkulKlasor[] = [];
  const bulYaKur = (ust: string | null, ders: string | null, unit: string | null, ad: string, sira?: number | null) => {
    const var_ = hepsi.find((k) => k.kok === kok && (k.ders_kodu ?? null) === ders && (k.unit_id ?? null) === unit);
    if (var_) return var_.id;
    const kardes = hepsi.filter((k) => k.ust_id === ust);
    const yeni: OkulKlasor = {
      id: yeniKimlik(), ust_id: ust, ad, sira: sira ?? sonrakiSira(kardes),
      ders_kodu: ders, unit_id: unit, kok,
    };
    hepsi.push(yeni);
    yeniler.push(yeni);
    return yeni.id;
  };
  let id = bulYaKur(null, null, null, KOK_ADI[kok], kok === "pdf" ? 1 : 2);
  if (baglam?.dersKodu) {
    id = bulYaKur(id, baglam.dersKodu, null, baglam.dersAdi || baglam.dersKodu);
    if (baglam.unitId) {
      const ad = baglam.konuAdi ? (baglam.konuSira ? `${baglam.konuSira}. ${baglam.konuAdi}` : baglam.konuAdi) : "Konu";
      id = bulYaKur(id, baglam.dersKodu, baglam.unitId, ad, baglam.konuSira);
    }
  }
  return { klasorId: id, yeniler };
}

/** Ağaç düğümü: alt klasörler ve notlar sıralı. */
export interface AgacDugumu { klasor: OkulKlasor; altlar: AgacDugumu[]; notlar: OkulNot[]; toplam: number }

const siraKarsilastir = (a: { sira: number }, b: { sira: number }) => a.sira - b.sira;
const notKarsilastir = (a: OkulNot, b: OkulNot) => a.sira - b.sira || a.olusturma.localeCompare(b.olusturma);

/** Klasör ağacını kurar. Üst klasörü kayıp olan klasör ve not köke düşer. */
export function agacKur(klasorler: OkulKlasor[], notlar: OkulNot[]): { kokler: AgacDugumu[]; kokNotlari: OkulNot[] } {
  const ids = new Set(klasorler.map((k) => k.id));
  const altlari = new Map<string | null, OkulKlasor[]>();
  for (const k of klasorler) {
    const ust = k.ust_id && ids.has(k.ust_id) && k.ust_id !== k.id ? k.ust_id : null;
    altlari.set(ust, [...(altlari.get(ust) ?? []), k]);
  }
  const notlari = new Map<string | null, OkulNot[]>();
  for (const n of notlar) {
    const k = n.klasor_id && ids.has(n.klasor_id) ? n.klasor_id : null;
    notlari.set(k, [...(notlari.get(k) ?? []), n]);
  }
  const ziyaret = new Set<string>();
  const kur = (k: OkulKlasor): AgacDugumu => {
    ziyaret.add(k.id);
    const altlar = (altlari.get(k.id) ?? []).filter((a) => !ziyaret.has(a.id)).sort(siraKarsilastir).map(kur);
    const n = (notlari.get(k.id) ?? []).sort(notKarsilastir);
    return { klasor: k, altlar, notlar: n, toplam: n.length + altlar.reduce((t, a) => t + a.toplam, 0) };
  };
  return {
    kokler: (altlari.get(null) ?? []).sort(siraKarsilastir).map(kur),
    kokNotlari: (notlari.get(null) ?? []).sort(notKarsilastir),
  };
}

/** Bir klasörün bütün alt klasörlerinin kimlikleri (kendisi dahil). */
export function altKlasorler(klasorId: string, klasorler: OkulKlasor[]): Set<string> {
  const sonuc = new Set([klasorId]);
  let degisti = true;
  while (degisti) {
    degisti = false;
    for (const k of klasorler) if (k.ust_id && sonuc.has(k.ust_id) && !sonuc.has(k.id)) { sonuc.add(k.id); degisti = true; }
  }
  return sonuc;
}

/** Depo yolundaki ASCII ders kodunu dersin gerçek koduna çevirir. */
export function yoldanDers(kaynak: string, dersKodlari: string[]): string | null {
  const ascii = (s: string) => s.replace(/İ/g, "I").replace(/ı/g, "i").replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g").replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ö/g, "O").replace(/ö/g, "o").replace(/Ç/g, "C").replace(/ç/g, "c");
  const bas = kaynak.split("/")[0];
  return dersKodlari.find((k) => ascii(k) === bas) ?? null;
}

// ── Supabase ──────────────────────────────────────────────────────

const NOT_KOLONLARI = "id, klasor_id, baslik, icerik, tur, kaynak, ders_kodu, unit_id, sira, olusturma, guncelleme";
const KLASOR_KOLONLARI = "id, ust_id, ad, sira, ders_kodu, unit_id, kok";

export async function okulNotlariniGetir(userId: string): Promise<{ klasorler: OkulKlasor[]; notlar: OkulNot[] }> {
  const [k, n] = await Promise.all([
    supabase.from("okul_klasor").select(KLASOR_KOLONLARI).eq("user_id", userId),
    supabase.from("okul_not").select(NOT_KOLONLARI).eq("user_id", userId),
  ]);
  if (k.error) throw new Error(hataMetni(k.error));
  if (n.error) throw new Error(hataMetni(n.error));
  return { klasorler: (k.data ?? []) as OkulKlasor[], notlar: (n.data ?? []) as OkulNot[] };
}

export async function klasorleriYaz(userId: string, klasorler: OkulKlasor[]): Promise<void> {
  if (!klasorler.length) return;
  const { error } = await supabase.from("okul_klasor").upsert(klasorler.map((k) => ({ ...k, user_id: userId })), { onConflict: "id" });
  if (error) throw new Error(hataMetni(error));
}

export async function notlariYaz(userId: string, notlar: OkulNot[]): Promise<void> {
  if (!notlar.length) return;
  const { error } = await supabase.from("okul_not").upsert(notlar.map((n) => ({ ...n, user_id: userId })), { onConflict: "id" });
  if (error) throw new Error(hataMetni(error));
}

export async function klasorSil(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("okul_klasor").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(hataMetni(error));
}

export async function notSil(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("okul_not").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(hataMetni(error));
}

export async function pdfNotunuBul(userId: string, kaynak: string): Promise<OkulNot | null> {
  const { data, error } = await supabase.from("okul_not").select(NOT_KOLONLARI)
    .eq("user_id", userId).eq("tur", "pdf").eq("kaynak", kaynak).maybeSingle();
  if (error) throw new Error(hataMetni(error));
  return (data as OkulNot | null) ?? null;
}

/**
 * Yeni bir not kurar ve otomatik klasörüne (Kök → Ders → Konu) yerleştirir.
 * PDF notu "PDF notlarım"a, konu notu ve öteki okul notları "Ders notlarım"a düşer.
 */
export async function notKur(
  userId: string,
  alanlar: { baslik: string; icerik: string; tur: NotTuru; kaynak?: string | null; id?: string },
  baglam: DersBaglami | null,
): Promise<OkulNot> {
  const { data, error } = await supabase.from("okul_klasor").select(KLASOR_KOLONLARI).eq("user_id", userId);
  if (error) throw new Error(hataMetni(error));
  const klasorler = (data ?? []) as OkulKlasor[];
  const { klasorId, yeniler } = otomatikKlasor(klasorler, alanlar.tur === "pdf" ? "pdf" : "ders", baglam);
  await klasorleriYaz(userId, yeniler);
  const simdi = new Date().toISOString();
  const not: OkulNot = {
    id: alanlar.id ?? yeniKimlik(), klasor_id: klasorId, baslik: alanlar.baslik, icerik: alanlar.icerik,
    tur: alanlar.tur, kaynak: alanlar.kaynak ?? null, ders_kodu: baglam?.dersKodu ?? null,
    unit_id: baglam?.unitId ?? null, sira: Date.now() / 1000, olusturma: simdi, guncelleme: simdi,
  };
  await notlariYaz(userId, [not]);
  return not;
}

export async function notIcerikYaz(userId: string, id: string, alanlar: Partial<Pick<OkulNot, "baslik" | "icerik">>): Promise<void> {
  const { error } = await supabase.from("okul_not").update({ ...alanlar, guncelleme: new Date().toISOString() })
    .eq("user_id", userId).eq("id", id);
  if (error) throw new Error(hataMetni(error));
}

/** Konu notunu bulur (bağlı kimlikle ya da konusuyla); yoksa null. */
export async function konuNotunuBul(userId: string, unitId: string, notId?: string | null): Promise<OkulNot | null> {
  if (notId) {
    const { data, error } = await supabase.from("okul_not").select(NOT_KOLONLARI).eq("user_id", userId).eq("id", notId).maybeSingle();
    if (error) throw new Error(hataMetni(error));
    if (data) return data as OkulNot;
  }
  const { data, error } = await supabase.from("okul_not").select(NOT_KOLONLARI)
    .eq("user_id", userId).eq("tur", "konu").eq("unit_id", unitId).order("olusturma").limit(1);
  if (error) throw new Error(hataMetni(error));
  return ((data ?? [])[0] as OkulNot | undefined) ?? null;
}

/** Okul verisinden bir konunun ders bağlamı (klasör adları için). */
export function konuBaglami(
  data: { courses: { kod: string; ad: string }[]; units: { id: string; ders_kodu: string; baslik: string; konu_no: number | null }[] },
  unitId: string | null | undefined,
  dersKodu?: string | null,
): DersBaglami | null {
  const unit = unitId ? data.units.find((u) => u.id === unitId) : undefined;
  const kod = unit?.ders_kodu ?? dersKodu;
  if (!kod) return null;
  return {
    dersKodu: kod,
    dersAdi: data.courses.find((c) => c.kod === kod)?.ad ?? kod,
    unitId: unit?.id ?? null,
    konuAdi: unit?.baslik ?? null,
    konuSira: unit?.konu_no ?? null,
  };
}

/**
 * Genel notlardaki eski okul notu mu (konu/ders notu ya da "okul" etiketli)?
 * Bunlar v17 ile okul notlarına kopyalandı; genel not sayfasında gösterilmez.
 */
export function eskiOkulNotuMu(n: { kind?: string; unitId?: string; dersKodu?: string; tags: string[] }): boolean {
  return n.kind === "konu" || n.kind === "ders" || Boolean(n.unitId) || Boolean(n.dersKodu)
    || n.tags.some((t) => t.toLocaleLowerCase("tr-TR") === "okul");
}

/** Okul notlarının içerikleri: kazanım işaretleri ve ezber kartları bunlardan okunur. */
export async function okulNotIcerikleri(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("okul_not").select("icerik").eq("user_id", userId);
  if (error) throw new Error(hataMetni(error));
  return (data ?? []).map((r: { icerik: string }) => r.icerik);
}
