"use client";

// Okul notları (v17): takvimin genel notlarından bağımsız, klasörlü not alanı.
//
// Kullanıcı okul notlarının genel not sayfasına karışmasını istemedi; PDF'in
// yanında aldığı notları da hiçbir yerde göremiyordu. Burada solda iç içe
// klasörler (yeni klasör, yeniden adlandır, sürükle-bırak), sağda Word gibi
// not alanı var. Uygulama iki kök kurar: "PDF notlarım" (PDF'in yanında alınan
// notlar, vurgularıyla) ve "Ders notlarım" (konu notları, kendi notların);
// altlarında Ders → Konu. Yeni notlar kendiliğinden yerine düşer, sonra
// istediğin yere taşıyabilirsin.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  BookOpen, ChevronDown, ChevronLeft, ChevronRight, FileText, Folder, FolderOpen, FolderPlus,
  ListChecks, Loader2, Pencil, Plus, Search, StickyNote, Trash2, X,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { aranabilirMetin } from "@/lib/note-content";
import { formatDate } from "@/lib/dates";
import { depoYolu } from "@/lib/pdf-kaynak";
import { isaretleriGetir, RENKLER, type Isaret } from "@/lib/pdf-calisma";
import {
  fetchSchoolData, okulOnbellegi, saveQuestionAttempt, setUnitStep, type SchoolData,
} from "@/lib/school-data";
import {
  agacKur, altKlasorler, klasorleriYaz, klasorSil, klasorYolu, konuBaglami, notIcerikYaz, notlariYaz,
  notSil, okulNotlariniGetir, oncesineSira, otomatikKlasor, sonrakiSira, tasinabilirMi, yeniKimlik, yoldanDers,
  type AgacDugumu, type DersBaglami, type OkulKlasor, type OkulNot,
} from "@/lib/okul-notlari";

const BlockEditor = dynamic(() => import("@/components/editor/BlockEditor").then((m) => m.BlockEditor), {
  ssr: false,
  loading: () => <div className="px-6 py-4 text-sm" style={{ color: "var(--text-tertiary)" }}>Editör yükleniyor…</div>,
});
const PdfReader = dynamic(() => import("@/components/editor/PdfReader").then((m) => m.PdfReader), { ssr: false });

const ACIK = "epoche-okul-notlari-acik";
type Surukle = { tur: "not" | "klasor"; id: string } | null;
type PdfAcik = { yol: string; baslik: string; baglam: DersBaglami | null; ilkSayfa?: number };

const simdi = () => new Date().toISOString();

export function OkulNotlariView() {
  const user = useAppStore((s) => s.user);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const istenen = useAppStore((s) => s.istenenOkulNotu);
  const okulNotunuAc = useAppStore((s) => s.okulNotunuAc);
  const kayitli = Boolean(user?.id) && !isDemoMode;

  const [klasorler, setKlasorler] = useState<OkulKlasor[]>([]);
  const [notlar, setNotlar] = useState<OkulNot[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [okul, setOkul] = useState<SchoolData | null>(() => okulOnbellegi(user?.id));
  const [acik, setAcik] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ACIK) ?? "[]")); } catch { return new Set(); }
  });
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [hedefKlasor, setHedefKlasor] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [adlandirilan, setAdlandirilan] = useState<string | null>(null);
  const [surukle, setSurukle] = useState<Surukle>(null);
  const [birakmaHedefi, setBirakmaHedefi] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PdfAcik | null>(null);
  const [surum, setSurum] = useState(0);
  const [vurgular, setVurgular] = useState<Isaret[]>([]);

  // ── Düzenleme (genel notlardaki kayıt düzeniyle aynı: ref + erteleme) ──
  const [baslik, setBaslik] = useState("");
  const [icerik, setIcerik] = useState("");
  const [kirli, setKirli] = useState(false);
  const baslikRef = useRef("");
  const icerikRef = useRef("");
  const kirliRef = useRef(false);
  const seciliRef = useRef<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baslikAlani = useRef<HTMLTextAreaElement>(null);

  const secili = notlar.find((n) => n.id === seciliId) ?? null;

  const acikYaz = (yeni: Set<string>) => {
    setAcik(yeni);
    try { localStorage.setItem(ACIK, JSON.stringify(Array.from(yeni))); } catch { /* yer yoksa önemli değil */ }
  };
  const ac = (...idler: string[]) => acikYaz(new Set([...Array.from(acik), ...idler]));
  const degistirAcik = (id: string) => {
    const yeni = new Set(acik);
    if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
    acikYaz(yeni);
  };

  const hataGoster = (e: unknown) => setHata(e instanceof Error ? e.message : String(e));

  // ── Yükleme ──────────────────────────────────────────────────
  const yukle = useCallback(async () => {
    if (!kayitli || !user?.id) { setYukleniyor(false); return; }
    try {
      const v = await okulNotlariniGetir(user.id);
      setKlasorler(v.klasorler);
      setNotlar(v.notlar);
      setHata(null);
    } catch (e) { hataGoster(e); } finally { setYukleniyor(false); }
  }, [kayitli, user?.id]);

  useEffect(() => { void yukle(); }, [yukle]);
  useEffect(() => {
    if (!kayitli || !user?.id) return;
    fetchSchoolData(user.id).then(setOkul).catch(() => { /* klasör adları için; yoksa kodla yetinilir */ });
  }, [kayitli, user?.id]);

  // Klasörü olmayan notlar (eski notlardan taşınanlar) otomatik yerine konur.
  const yerlestirildi = useRef(false);
  useEffect(() => {
    if (yerlestirildi.current || yukleniyor || !okul || !user?.id || !kayitli) return;
    const ids = new Set(klasorler.map((k) => k.id));
    const yersiz = notlar.filter((n) => !n.klasor_id || !ids.has(n.klasor_id));
    yerlestirildi.current = true;
    if (!yersiz.length) return;
    let hepsi = [...klasorler];
    const yeniKlasorler: OkulKlasor[] = [];
    const tasinan: OkulNot[] = [];
    const dersler = okul.courses.map((c) => c.kod);
    for (const n of yersiz) {
      const ders = n.ders_kodu ?? (n.kaynak ? yoldanDers(n.kaynak, dersler) : null);
      const { klasorId, yeniler } = otomatikKlasor(hepsi, n.tur === "pdf" ? "pdf" : "ders", konuBaglami(okul, n.unit_id, ders));
      hepsi = [...hepsi, ...yeniler];
      yeniKlasorler.push(...yeniler);
      tasinan.push({ ...n, klasor_id: klasorId, ders_kodu: ders });
    }
    setKlasorler(hepsi);
    setNotlar((l) => l.map((n) => tasinan.find((t) => t.id === n.id) ?? n));
    void klasorleriYaz(user.id, yeniKlasorler).then(() => notlariYaz(user.id, tasinan)).catch(hataGoster);
  }, [yukleniyor, okul, klasorler, notlar, user?.id, kayitli]);

  // ── Kaydetme ─────────────────────────────────────────────────
  const kaydet = useCallback(() => {
    const id = seciliRef.current;
    if (!id || !kirliRef.current) return;
    if (zamanlayici.current) { clearTimeout(zamanlayici.current); zamanlayici.current = null; }
    const alanlar = { baslik: baslikRef.current.trim() || "Başlıksız", icerik: icerikRef.current };
    kirliRef.current = false;
    setKirli(false);
    setNotlar((l) => l.map((n) => (n.id === id ? { ...n, ...alanlar, guncelleme: simdi() } : n)));
    if (kayitli && user?.id) notIcerikYaz(user.id, id, alanlar).catch(hataGoster);
  }, [kayitli, user?.id]);

  const ertele = () => {
    kirliRef.current = true;
    setKirli(true);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(kaydet, 800);
  };

  useEffect(() => {
    const gizlendi = () => { if (document.visibilityState === "hidden") kaydet(); };
    window.addEventListener("beforeunload", kaydet);
    document.addEventListener("visibilitychange", gizlendi);
    return () => {
      window.removeEventListener("beforeunload", kaydet);
      document.removeEventListener("visibilitychange", gizlendi);
      kaydet();
    };
  }, [kaydet]);

  const notuAc = useCallback((n: OkulNot) => {
    kaydet();
    seciliRef.current = n.id;
    setSeciliId(n.id);
    setBaslik(n.baslik);
    baslikRef.current = n.baslik;
    setIcerik(n.icerik);
    icerikRef.current = n.icerik;
    setHedefKlasor(n.klasor_id);
  }, [kaydet]);

  const kapatNot = () => { kaydet(); seciliRef.current = null; setSeciliId(null); };

  // Başka yerden açılması istenen not (konu notu düğmesi).
  useEffect(() => {
    if (!istenen || yukleniyor) return;
    const n = notlar.find((x) => x.id === istenen);
    if (n) {
      notuAc(n);
      if (n.klasor_id) ac(...klasorYolu(n.klasor_id, klasorler).map((k) => k.id));
      okulNotunuAc(null);
    } else {
      // Az önce kurulmuş olabilir: bir kez tazele.
      void yukle().then(() => okulNotunuAc(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [istenen, yukleniyor, notlar]);

  // Başlık alanı içeriği kadar uzasın.
  useEffect(() => {
    const ta = baslikAlani.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [baslik, seciliId]);

  // PDF notunun vurguları.
  useEffect(() => {
    setVurgular([]);
    if (!secili?.kaynak || secili.tur !== "pdf" || !kayitli || !user?.id) return;
    isaretleriGetir(user.id, secili.kaynak).then(setVurgular).catch(() => setVurgular([]));
  }, [secili?.id, secili?.kaynak, secili?.tur, kayitli, user?.id, surum]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Klasör ve not işlemleri ──────────────────────────────────
  /** Klasörün en yakın otomatik atasından ders ve konu: yeni notun okul blokları çalışsın. */
  const klasorBaglami = (klasorId: string | null) => {
    const yol = klasorYolu(klasorId, klasorler);
    const konu = [...yol].reverse().find((k) => k.unit_id);
    const ders = [...yol].reverse().find((k) => k.ders_kodu);
    return { ders_kodu: ders?.ders_kodu ?? null, unit_id: konu?.unit_id ?? null };
  };

  const yeniNot = (klasorId: string | null) => {
    const kardes = notlar.filter((n) => n.klasor_id === klasorId);
    const not: OkulNot = {
      id: yeniKimlik(), klasor_id: klasorId, baslik: "Yeni not", icerik: "", tur: "serbest", kaynak: null,
      ...klasorBaglami(klasorId), sira: sonrakiSira(kardes), olusturma: simdi(), guncelleme: simdi(),
    };
    setNotlar((l) => [...l, not]);
    if (klasorId) ac(...klasorYolu(klasorId, klasorler).map((k) => k.id));
    notuAc(not);
    setTimeout(() => { baslikAlani.current?.focus(); baslikAlani.current?.select(); }, 80);
    if (kayitli && user?.id) notlariYaz(user.id, [not]).catch(hataGoster);
  };

  const yeniKlasor = (ustId: string | null) => {
    const kardes = klasorler.filter((k) => k.ust_id === ustId);
    const k: OkulKlasor = { id: yeniKimlik(), ust_id: ustId, ad: "Yeni klasör", sira: sonrakiSira(kardes), ders_kodu: null, unit_id: null, kok: null };
    setKlasorler((l) => [...l, k]);
    if (ustId) ac(...klasorYolu(ustId, klasorler).map((x) => x.id));
    setHedefKlasor(k.id);
    setAdlandirilan(k.id);
    if (kayitli && user?.id) klasorleriYaz(user.id, [k]).catch(hataGoster);
  };

  const adlandir = (id: string, ad: string) => {
    setAdlandirilan(null);
    const k = klasorler.find((x) => x.id === id);
    const temiz = ad.trim();
    if (!k || !temiz || temiz === k.ad) return;
    const yeni = { ...k, ad: temiz };
    setKlasorler((l) => l.map((x) => (x.id === id ? yeni : x)));
    if (kayitli && user?.id) klasorleriYaz(user.id, [yeni]).catch(hataGoster);
  };

  const klasoruSil = async (id: string) => {
    const k = klasorler.find((x) => x.id === id);
    if (!k) return;
    const icindeki = notlar.filter((n) => altKlasorler(id, klasorler).has(n.klasor_id ?? "")).length;
    const soru = icindeki
      ? `"${k.ad}" klasörü silinsin mi? İçindeki ${icindeki} not ve alt klasörler silinmez, bir üst klasöre taşınır.`
      : `"${k.ad}" klasörü silinsin mi?`;
    if (!window.confirm(soru)) return;
    // İçindekiler bir üste taşınır: not kaybolmasın.
    const altlar = klasorler.filter((x) => x.ust_id === id).map((x) => ({ ...x, ust_id: k.ust_id }));
    const notlari = notlar.filter((n) => n.klasor_id === id).map((n) => ({ ...n, klasor_id: k.ust_id }));
    setKlasorler((l) => l.filter((x) => x.id !== id).map((x) => altlar.find((a) => a.id === x.id) ?? x));
    setNotlar((l) => l.map((n) => notlari.find((a) => a.id === n.id) ?? n));
    if (kayitli && user?.id) {
      try {
        await klasorleriYaz(user.id, altlar);
        await notlariYaz(user.id, notlari);
        await klasorSil(user.id, id);
      } catch (e) { hataGoster(e); void yukle(); }
    }
  };

  const notuSil = async (n: OkulNot) => {
    const ek = n.tur === "pdf" ? " PDF'teki vurgular silinmez; PDF'i açıp yazarsan not yeniden oluşur." : "";
    if (!window.confirm(`"${n.baslik || "Başlıksız"}" notu silinsin mi?${ek}`)) return;
    if (seciliId === n.id) { kirliRef.current = false; seciliRef.current = null; setSeciliId(null); }
    setNotlar((l) => l.filter((x) => x.id !== n.id));
    if (kayitli && user?.id) notSil(user.id, n.id).catch((e) => { hataGoster(e); void yukle(); });
  };

  /** Notu bir klasöre (sonuna) ya da bir notun önüne taşır. */
  const notuTasi = (notId: string, klasorId: string | null, onceki?: string) => {
    const n = notlar.find((x) => x.id === notId);
    if (!n || notId === onceki) return;
    const kardes = notlar.filter((x) => x.klasor_id === klasorId && x.id !== notId);
    const sira = onceki ? oncesineSira(kardes, onceki) : sonrakiSira(kardes);
    const yeni = { ...n, klasor_id: klasorId, sira };
    setNotlar((l) => l.map((x) => (x.id === notId ? yeni : x)));
    if (seciliId === notId) setHedefKlasor(klasorId);
    if (klasorId) ac(klasorId);
    if (kayitli && user?.id) notlariYaz(user.id, [yeni]).catch(hataGoster);
  };

  const klasoruTasi = (id: string, ustId: string | null) => {
    const k = klasorler.find((x) => x.id === id);
    if (!k || k.ust_id === ustId || !tasinabilirMi(id, ustId, klasorler)) return;
    const yeni = { ...k, ust_id: ustId, sira: sonrakiSira(klasorler.filter((x) => x.ust_id === ustId)) };
    setKlasorler((l) => l.map((x) => (x.id === id ? yeni : x)));
    if (ustId) ac(ustId);
    if (kayitli && user?.id) klasorleriYaz(user.id, [yeni]).catch(hataGoster);
  };

  // ── Sürükle-bırak ────────────────────────────────────────────
  const acmaZamani = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surukleBasla = (e: React.DragEvent, s: NonNullable<Surukle>) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", s.id);
    setSurukle(s);
  };
  const surukleBitti = () => {
    setSurukle(null);
    setBirakmaHedefi(null);
    if (acmaZamani.current) clearTimeout(acmaZamani.current);
  };
  const klasoreBirakilabilir = (hedef: string | null) =>
    !!surukle && (surukle.tur === "not" || tasinabilirMi(surukle.id, hedef, klasorler));
  const klasorUstunde = (e: React.DragEvent, id: string) => {
    if (!klasoreBirakilabilir(id)) return;
    e.preventDefault();
    e.stopPropagation();
    if (birakmaHedefi !== id) {
      setBirakmaHedefi(id);
      // Kapalı klasörün üstünde biraz bekleyince açılır: derine bırakılabilsin.
      if (acmaZamani.current) clearTimeout(acmaZamani.current);
      if (!acik.has(id)) acmaZamani.current = setTimeout(() => ac(id), 650);
    }
  };
  const klasoreBirak = (e: React.DragEvent, id: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (!surukle) return;
    if (surukle.tur === "not") notuTasi(surukle.id, id);
    else klasoruTasi(surukle.id, id);
    surukleBitti();
  };
  const notUstunde = (e: React.DragEvent, n: OkulNot) => {
    if (surukle?.tur !== "not" || surukle.id === n.id) return;
    e.preventDefault();
    e.stopPropagation();
    setBirakmaHedefi(`not:${n.id}`);
  };
  const notaBirak = (e: React.DragEvent, n: OkulNot) => {
    e.preventDefault();
    e.stopPropagation();
    if (surukle?.tur === "not") notuTasi(surukle.id, n.klasor_id, n.id);
    surukleBitti();
  };

  // ── Başka parçalardan gelen olaylar ──────────────────────────
  // Konu notundaki materyal bloğu PDF açmak ister: okuyucu yanındaki notuyla açılır.
  useEffect(() => {
    const pdfAc = (e: Event) => {
      const d = (e as CustomEvent<{ dersKodu: string; cmid: string; baslik: string }>).detail;
      if (!d?.dersKodu || !d?.cmid) return;
      const modul = okul?.modules.find((m) => m.id === `ybs:mod:${d.cmid}`);
      kaydet();
      setPdf({ yol: depoYolu(d.dersKodu, d.cmid), baslik: d.baslik || modul?.ad || "Ders materyali", baglam: okul ? konuBaglami(okul, modul?.unit_id, d.dersKodu) : null });
    };
    // Konu notundaki çıkmış soru cevaplanınca deneme kaydı ve "Soru çöz" adımı.
    const cevap = (e: Event) => {
      const d = (e as CustomEvent<{ questionId: string; verilen: string; dogru: boolean }>).detail;
      if (!user?.id || !kayitli || !d?.questionId || !d?.verilen) return;
      const unitId = notlar.find((n) => n.id === seciliRef.current)?.unit_id;
      void (async () => {
        try {
          await saveQuestionAttempt(user.id, d.questionId, d.verilen, d.dogru);
          if (unitId) await setUnitStep(user.id, unitId, "soru", true);
        } catch (err) { console.error("Soru denemesi kaydedilemedi:", err); }
      })();
    };
    window.addEventListener("epoche:pdf-ac", pdfAc);
    window.addEventListener("epoche:soru-cevap", cevap);
    return () => {
      window.removeEventListener("epoche:pdf-ac", pdfAc);
      window.removeEventListener("epoche:soru-cevap", cevap);
    };
  }, [okul, kaydet, user?.id, kayitli, notlar]);

  const pdfiAc = (n: OkulNot, ilkSayfa?: number) => {
    if (!n.kaynak) return;
    kaydet();
    setPdf({ yol: n.kaynak, baslik: n.baslik, baglam: okul ? konuBaglami(okul, n.unit_id, n.ders_kodu) : null, ilkSayfa });
  };

  /** Okuyucu kapanınca yandaki notta yazılanlar buraya da gelsin. */
  const pdfKapat = async () => {
    setPdf(null);
    if (!kayitli || !user?.id) return;
    try {
      const v = await okulNotlariniGetir(user.id);
      setKlasorler(v.klasorler);
      setNotlar(v.notlar);
      const guncel = v.notlar.find((n) => n.id === seciliRef.current);
      if (guncel) { setIcerik(guncel.icerik); icerikRef.current = guncel.icerik; }
      setSurum((s) => s + 1);
    } catch (e) { hataGoster(e); }
  };

  // ── Görünüm hesapları ────────────────────────────────────────
  const agac = useMemo(() => agacKur(klasorler, notlar), [klasorler, notlar]);
  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const bulunanlar = useMemo(() => {
    if (!q) return [];
    return notlar
      .filter((n) => n.baslik.toLocaleLowerCase("tr-TR").includes(q) || aranabilirMetin(n.icerik).toLocaleLowerCase("tr-TR").includes(q))
      .sort((a, b) => b.guncelleme.localeCompare(a.guncelleme));
  }, [notlar, q]);
  const yolAdi = (klasorId: string | null) => klasorYolu(klasorId, klasorler).map((k) => k.ad).join(" › ");

  // Taşı listesi: bütün klasörler girintili.
  const klasorSecenekleri = useMemo(() => {
    const liste: { id: string; ad: string; derinlik: number }[] = [];
    const gez = (d: AgacDugumu, derinlik: number) => {
      liste.push({ id: d.klasor.id, ad: d.klasor.ad, derinlik });
      d.altlar.forEach((a) => gez(a, derinlik + 1));
    };
    agac.kokler.forEach((d) => gez(d, 0));
    return liste;
  }, [agac]);

  const kelime = useMemo(() => aranabilirMetin(icerik).split(/\s+/).filter(Boolean).length, [icerik]);

  // ── Çizim parçaları ──────────────────────────────────────────
  const notIkonu = (n: OkulNot) =>
    n.tur === "pdf" ? <FileText size={14} style={{ color: "#c2410c" }} />
      : n.tur === "konu" ? <ListChecks size={14} style={{ color: "var(--tag-school)" }} />
        : <StickyNote size={14} style={{ color: "var(--text-tertiary)" }} />;

  // Bileşen değil düz işlev: her çizimde yeniden kurulmasın, sürükleme yarıda kesilmesin.
  const notSatiri = (n: OkulNot, derinlik: number, yolGoster = false) => {
    const seciliMi = n.id === seciliId;
    const hedef = birakmaHedefi === `not:${n.id}`;
    return (
      <div
        key={n.id}
        draggable
        onDragStart={(e) => surukleBasla(e, { tur: "not", id: n.id })}
        onDragEnd={surukleBitti}
        onDragOver={(e) => notUstunde(e, n)}
        onDragLeave={() => hedef && setBirakmaHedefi(null)}
        onDrop={(e) => notaBirak(e, n)}
        onClick={() => notuAc(n)}
        role="treeitem"
        aria-selected={seciliMi}
        className="group flex items-center gap-2 pr-2 py-1.5 rounded-lg cursor-pointer select-none"
        style={{
          paddingLeft: 10 + derinlik * 16,
          background: seciliMi ? "var(--surface-raised)" : undefined,
          boxShadow: seciliMi ? "inset 0 0 0 1px var(--brand-gold)" : undefined,
          borderTop: hedef ? "2px solid var(--brand-gold)" : "2px solid transparent",
          opacity: surukle?.id === n.id ? 0.4 : 1,
        }}
      >
        <span className="shrink-0">{notIkonu(n)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] truncate">{n.baslik || "Başlıksız"}</span>
          {yolGoster && <span className="block text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>{yolAdi(n.klasor_id) || "Klasörsüz"}</span>}
        </span>
        <span className="text-[10px] shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>{formatDate(n.guncelleme, "d MMM")}</span>
      </div>
    );
  };

  const klasorDugumu = (d: AgacDugumu, derinlik: number): React.ReactNode => {
    const k = d.klasor;
    const acikMi = acik.has(k.id);
    const hedef = birakmaHedefi === k.id;
    const kokIkonu = k.kok && !k.ders_kodu ? (k.kok === "pdf" ? <FileText size={15} style={{ color: "#c2410c" }} /> : <BookOpen size={15} style={{ color: "var(--tag-school)" }} />) : null;
    return (
      <div role="group" key={k.id}>
        <div
          draggable={adlandirilan !== k.id}
          onDragStart={(e) => surukleBasla(e, { tur: "klasor", id: k.id })}
          onDragEnd={surukleBitti}
          onDragOver={(e) => klasorUstunde(e, k.id)}
          onDragLeave={() => hedef && setBirakmaHedefi(null)}
          onDrop={(e) => klasoreBirak(e, k.id)}
          onClick={() => { degistirAcik(k.id); setHedefKlasor(k.id); }}
          onDoubleClick={(e) => { e.stopPropagation(); setAdlandirilan(k.id); }}
          role="treeitem"
          aria-expanded={acikMi}
          className="group flex items-center gap-1.5 pr-1 py-1.5 rounded-lg cursor-pointer select-none"
          style={{
            paddingLeft: 4 + derinlik * 16,
            background: hedef ? "color-mix(in srgb, var(--brand-gold) 22%, transparent)" : hedefKlasor === k.id && !seciliId ? "var(--surface-raised)" : undefined,
            outline: hedef ? "1px dashed var(--brand-gold)" : undefined,
            opacity: surukle?.id === k.id ? 0.4 : 1,
          }}
        >
          <span className="w-4 shrink-0 flex justify-center" style={{ color: "var(--text-tertiary)" }}>
            {acikMi ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="shrink-0">{kokIkonu ?? (acikMi ? <FolderOpen size={15} style={{ color: "var(--brand-gold)" }} /> : <Folder size={15} style={{ color: "var(--brand-gold)" }} />)}</span>
          {adlandirilan === k.id ? (
            <input
              autoFocus
              defaultValue={k.ad}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => adlandir(k.id, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adlandir(k.id, e.currentTarget.value);
                if (e.key === "Escape") setAdlandirilan(null);
              }}
              className="flex-1 min-w-0 text-[13px] rounded px-1.5 py-0.5 outline-none"
              style={{ background: "var(--surface-base)", border: "1px solid var(--brand-gold)", color: "var(--text-primary)" }}
              aria-label="Klasör adı"
            />
          ) : (
            <span className={`flex-1 min-w-0 truncate text-[13px] ${derinlik === 0 ? "font-semibold" : "font-medium"}`}>{k.ad}</span>
          )}
          {d.toplam > 0 && adlandirilan !== k.id && (
            <span className="text-[10px] tabular-nums px-1.5 rounded-full group-hover:hidden" style={{ background: "var(--surface-sunken)", color: "var(--text-tertiary)" }}>{d.toplam}</span>
          )}
          {adlandirilan !== k.id && (
            <span className="hidden group-hover:flex items-center shrink-0">
              <button onClick={(e) => { e.stopPropagation(); yeniNot(k.id); }} className="p-1 rounded hover:opacity-70" title="Bu klasöre not ekle" aria-label={`${k.ad} klasörüne not ekle`}><Plus size={13} /></button>
              <button onClick={(e) => { e.stopPropagation(); yeniKlasor(k.id); }} className="p-1 rounded hover:opacity-70" title="Alt klasör aç" aria-label={`${k.ad} içinde klasör aç`}><FolderPlus size={13} /></button>
              <button onClick={(e) => { e.stopPropagation(); setAdlandirilan(k.id); }} className="p-1 rounded hover:opacity-70" title="Yeniden adlandır" aria-label={`${k.ad} klasörünü yeniden adlandır`}><Pencil size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); void klasoruSil(k.id); }} className="p-1 rounded hover:opacity-70" title="Klasörü sil" aria-label={`${k.ad} klasörünü sil`}><Trash2 size={12} /></button>
            </span>
          )}
        </div>
        {acikMi && (
          <div>
            {d.altlar.map((a) => klasorDugumu(a, derinlik + 1))}
            {d.notlar.map((n) => notSatiri(n, derinlik + 1))}
            {!d.altlar.length && !d.notlar.length && (
              <p className="py-1 text-[11px] italic" style={{ paddingLeft: 30 + derinlik * 16, color: "var(--text-muted)" }}>Boş — buraya not sürükle ya da + ile ekle</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Ekran ────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col md:flex-row h-full rounded-xl overflow-hidden animate-fade-in"
      style={{ border: "0.5px solid var(--border-default)", background: "var(--surface-base)" }}
    >
      {/* Sol: klasör ağacı. Dar ekranda not açıkken gizlenir. */}
      <div
        className={`flex flex-col w-full md:w-80 shrink-0 md:h-full ${seciliId ? "hidden md:flex" : "flex-1 md:flex-none"}`}
        style={{ borderRight: "0.5px solid var(--border-default)", background: "var(--surface-sunken)" }}
      >
        <div className="p-3 space-y-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold flex-1">Okul notları</h2>
            <button onClick={() => yeniKlasor(seciliId ? secili?.klasor_id ?? null : hedefKlasor)} className="cp-btn cp-btn-ghost min-h-9 px-2 text-[12px]" title="Yeni klasör"><FolderPlus size={14} />Klasör</button>
            <button onClick={() => yeniNot(seciliId ? secili?.klasor_id ?? null : hedefKlasor)} className="cp-btn cp-btn-primary min-h-9 px-2.5 text-[12px]" title="Yeni not"><Plus size={14} />Not</button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Okul notlarında ara…"
              className="w-full pl-8 pr-7 py-2 text-[13px] rounded-lg outline-none"
              style={{ background: "var(--surface-base)", border: "0.5px solid var(--border-default)", color: "var(--text-primary)" }}
              aria-label="Okul notlarında ara"
            />
            {arama && <button onClick={() => setArama("")} className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Aramayı temizle"><X size={13} /></button>}
          </div>
          {hedefKlasor && !seciliId && (
            <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>Yeni not/klasör: {yolAdi(hedefKlasor)}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-1.5" role="tree" aria-label="Okul notları klasörleri">
          {yukleniyor && <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={18} style={{ color: "var(--tag-school)" }} /></div>}
          {!yukleniyor && q && (
            <>
              <p className="px-2 py-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>{bulunanlar.length} not bulundu</p>
              {bulunanlar.map((n) => notSatiri(n, 0, true))}
            </>
          )}
          {!yukleniyor && !q && (
            <>
              {agac.kokler.map((d) => klasorDugumu(d, 0))}
              {agac.kokNotlari.map((n) => notSatiri(n, 0))}
              {!agac.kokler.length && !agac.kokNotlari.length && (
                <div className="px-4 py-10 text-center space-y-2">
                  <FolderOpen size={28} className="mx-auto" style={{ color: "var(--text-muted)" }} />
                  <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    Henüz okul notu yok. PDF'in yanında not aldığında "PDF notlarım" altına, konu notu açtığında "Ders notlarım" altına kendiliğinden gelir. Kendi klasörünü de açabilirsin.
                  </p>
                </div>
              )}
              {/* En üst seviyeye bırakma alanı: klasörü ya da notu kökten çıkarmak için. */}
              {surukle && (
                <div
                  onDragOver={(e) => { if (klasoreBirakilabilir(null)) { e.preventDefault(); setBirakmaHedefi("kok"); } }}
                  onDragLeave={() => setBirakmaHedefi(null)}
                  onDrop={(e) => klasoreBirak(e, null)}
                  className="mt-2 rounded-lg py-3 text-center text-[11px]"
                  style={{
                    border: "1px dashed var(--border-strong)",
                    background: birakmaHedefi === "kok" ? "color-mix(in srgb, var(--brand-gold) 18%, transparent)" : undefined,
                    color: "var(--text-tertiary)",
                  }}
                >
                  En üst seviyeye bırak
                </div>
              )}
            </>
          )}
        </div>
        {!kayitli && (
          <p className="px-3 py-2 text-[11px]" style={{ color: "var(--text-tertiary)", borderTop: "0.5px solid var(--border-default)" }}>Giriş yapınca okul notların kaydedilir.</p>
        )}
        {hata && (
          <p className="px-3 py-2 text-[11px]" role="alert" style={{ color: "var(--priority-high-text)", borderTop: "0.5px solid var(--border-default)" }}>{hata}</p>
        )}
      </div>

      {/* Sağ: not */}
      {secili ? (
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
          <div className="px-5 sm:px-8 pt-4 pb-3" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={kapatNot} className="md:hidden cp-btn cp-btn-ghost min-h-9 px-2 text-[12px] -ml-2"><ChevronLeft size={14} />Klasörler</button>
              <p className="text-[11px] truncate flex-1 min-w-0" style={{ color: "var(--text-tertiary)" }}>{yolAdi(secili.klasor_id) || "Klasörsüz"}</p>
              {secili.tur === "pdf" && secili.kaynak && (
                <button onClick={() => pdfiAc(secili)} className="cp-btn cp-btn-primary min-h-9 px-2.5 text-[12px]"><FileText size={13} />PDF'i aç</button>
              )}
              <select
                value={secili.klasor_id ?? ""}
                onChange={(e) => notuTasi(secili.id, e.target.value || null)}
                className="min-h-9 rounded-lg px-2 text-[12px] max-w-[11rem]"
                style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)", color: "var(--text-primary)" }}
                aria-label="Notu başka klasöre taşı"
                title="Taşı"
              >
                <option value="">Taşı: en üst seviye</option>
                {klasorSecenekleri.map((k) => (
                  <option key={k.id} value={k.id}>{"  ".repeat(k.derinlik)}{k.ad}</option>
                ))}
              </select>
              <button onClick={() => void notuSil(secili)} className="cp-btn cp-btn-ghost min-h-9 px-2" aria-label="Notu sil" title="Notu sil"><Trash2 size={14} /></button>
            </div>
            <textarea
              ref={baslikAlani}
              value={baslik}
              onChange={(e) => { setBaslik(e.target.value); baslikRef.current = e.target.value; ertele(); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              rows={1}
              placeholder="Başlık…"
              className="w-full mt-2 text-[26px] leading-tight cp-not-basligi bg-transparent outline-none resize-none overflow-hidden"
              style={{ color: "var(--text-primary)" }}
              aria-label="Not başlığı"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto epoche-block-editor">
            <BlockEditor
              key={`${secili.id}:${surum}`}
              noteId={`okul:${secili.id}:${surum}`}
              content={icerik}
              onChange={(v) => { setIcerik(v); icerikRef.current = v; ertele(); }}
              okul={{ unitId: secili.unit_id ?? undefined, dersKodu: secili.ders_kodu ?? undefined }}
            />
            {secili.tur === "pdf" && (
              <section className="mx-5 sm:mx-8 my-6 rounded-xl p-3" style={{ background: "var(--surface-sunken)" }}>
                <h3 className="text-[12px] font-semibold mb-2 flex items-center gap-2">
                  <span className="flex-1">Vurgular ve altı çizilenler</span>
                  <span className="font-normal tabular-nums" style={{ color: "var(--text-tertiary)" }}>{vurgular.length}</span>
                </h3>
                {!vurgular.length && <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Bu PDF'te henüz vurgu yok.</p>}
                <ul className="space-y-1.5">
                  {vurgular.map((v) => (
                    <li key={v.id}>
                      <button onClick={() => pdfiAc(secili, v.sayfa)} className="w-full text-left rounded-lg p-2 flex gap-2" style={{ background: "var(--surface-base)" }} title="PDF'te bu sayfayı aç">
                        <span className="mt-1 inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={v.tur === "alti" ? { borderBottom: "2px solid #c2410c" } : { background: RENKLER[v.renk] ?? RENKLER.sari }} />
                        <span className="min-w-0">
                          <span className="block text-[10px]" style={{ color: "var(--text-tertiary)" }}>s. {v.sayfa} · {v.tur === "alti" ? "altı çizili" : "vurgu"}</span>
                          <span className="block text-[12px] leading-snug">{v.metin}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="px-5 sm:px-8 py-2 flex items-center justify-between text-[10px]" style={{ borderTop: "0.5px solid var(--border-default)", color: "var(--text-muted)" }}>
            <span>{!kayitli ? "Giriş yapınca kaydedilir" : kirli ? "Kaydediliyor…" : `Kaydedildi · ${formatDate(secili.guncelleme, "d MMM HH:mm")}`}</span>
            <span>{kelime} kelime</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-3 p-6 text-center">
          <FolderOpen size={40} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Soldan bir not seç ya da yeni not aç</p>
          <p className="text-xs max-w-sm" style={{ color: "var(--text-muted)" }}>
            Notları ve klasörleri sürükleyip başka bir klasörün üstüne bırakarak taşıyabilirsin. Klasör adına çift tıklayınca adı değişir.
          </p>
        </div>
      )}

      {pdf && (
        <div className="fixed inset-0 z-50 flex" style={{ background: "var(--surface-base)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <PdfReader yol={pdf.yol} baslik={pdf.baslik} baglam={pdf.baglam} ilkSayfa={pdf.ilkSayfa} onKapat={() => void pdfKapat()} />
        </div>
      )}
    </div>
  );
}
