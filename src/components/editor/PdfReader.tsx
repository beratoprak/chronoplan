"use client";

// Ders PDF'i için çalışma alanı.
//
// 3 Ekim: eski okuyucu tek sayfayı küçük ve bulanık çiziyor, metni sayfanın
// altına düz yazı olarak döküyordu — ne seçilebiliyor ne üstüne çalışılabiliyordu.
// Şimdi: sayfalar tam genişlikte ve net (ekranın piksel yoğunluğunda), alt alta
// akar; pdf.js metin katmanı sayesinde metin seçilir ve kopyalanır; seçilen yer
// vurgulanır ya da altı çizilir; PDF'in yanında serbest not alanı ve vurgu
// listesi durur (kullanıcı notların PDF'in üstünde kutu olarak değil, yanda
// olmasını istedi). Vurgu ve notlar hesaba kaydedilir (migration v16).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Copy, Highlighter, Minus, NotebookPen, Plus, Quote, Trash2, Underline, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { imzaliBaglantiDetayli, type KaynakHatasi } from "@/lib/pdf-kaynak";
import {
  RENKLER, isaretEkle, isaretSil, isaretleriGetir, kutulariHesapla, notuGetir, notuKaydet,
  type Isaret, type IsaretTuru, type Kutu,
} from "@/lib/pdf-calisma";
import { bloklariOku, bloklariYaz, type NoteBlock } from "@/lib/note-content";
import { pdfPolyfill } from "@/lib/pdf-polyfill";

// Not alanı Word gibi biçimli: Epoche'nin blok editörü (başlık, liste, kalın, "/" menüsü).
const BlockEditor = dynamic(() => import("./BlockEditor").then((m) => m.BlockEditor), { ssr: false });

interface Props {
  yol: string;
  baslik: string;
  onKapat: () => void;
  /** Varsa seçim "Konu notuna al" ile açık nota alıntı olarak eklenir. */
  onAlinti?: (metin: string, sayfa: number) => void;
  /** Yandaki not alanı; Notlar görünümünde zaten bir not açık olduğu için kapalı. */
  notAlani?: boolean;
}

type PdfSayfasi = {
  getViewport: (o: { scale: number }) => { width: number; height: number; scale: number };
  render: (o: unknown) => { promise: Promise<void>; cancel: () => void };
  streamTextContent: () => ReadableStream;
};
type PdfBelgesi = { numPages: number; getPage: (n: number) => Promise<PdfSayfasi> };
type PdfJs = typeof import("pdfjs-dist");

interface Secim { sayfa: number; metin: string; kutular: Kutu[]; x: number; y: number }

const YAKINLIK = "epoche-pdf-yakinlik";
const BOLUNME = "epoche-pdf-bolunme";

export function PdfReader({ yol, baslik, onKapat, onAlinti, notAlani = true }: Props) {
  const user = useAppStore((s) => s.user);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const kayitli = Boolean(user?.id) && !isDemoMode;

  const kokRef = useRef<HTMLDivElement>(null);
  const akisRef = useRef<HTMLDivElement>(null);
  const pdfjsRef = useRef<PdfJs | null>(null);
  const [belge, setBelge] = useState<PdfBelgesi | null>(null);
  const [boyut, setBoyut] = useState<{ w: number; h: number } | null>(null);
  const [durum, setDurum] = useState<"yukleniyor" | "hazir" | "hata">("yukleniyor");
  const [neden, setNeden] = useState<KaynakHatasi | "acilamadi" | null>(null);
  const [genislik, setGenislik] = useState(800);
  const [kokGenislik, setKokGenislik] = useState(1200);
  const [yakinlik, setYakinlik] = useState(() => {
    try { return Number(localStorage.getItem(YAKINLIK)) || 1; } catch { return 1; }
  });
  const [aktifSayfa, setAktifSayfa] = useState(1);
  const [panel, setPanel] = useState<boolean | null>(null); // null: ekrana göre
  // PDF'in genişlik payı (geniş ekranda): varsayılan yarı yarıya, ortadaki çizgi sürüklenir.
  const [oran, setOran] = useState(() => {
    try { return Math.min(0.8, Math.max(0.25, Number(localStorage.getItem(BOLUNME)) || 0.5)); } catch { return 0.5; }
  });
  const [isaretler, setIsaretler] = useState<Isaret[]>([]);
  const [not, setNot] = useState("");
  const [notDurumu, setNotDurumu] = useState<"" | "yaziliyor" | "kaydedildi">("");
  const [hata, setHata] = useState<string | null>(null);
  const [secim, setSecim] = useState<Secim | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const kayitZamani = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Belgeyi aç ────────────────────────────────────────────────
  useEffect(() => {
    let iptal = false;
    (async () => {
      setDurum("yukleniyor");
      const { url, hata: h } = await imzaliBaglantiDetayli(yol);
      if (!url) { if (!iptal) { setNeden(h ?? null); setDurum("hata"); } return; }
      pdfPolyfill();
      const pdfjs = await import("pdfjs-dist");
      // İşçi sabit adresten (scripts/pdf-worker-kopyala.mjs derlemeden önce koyar).
      pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;
      pdfjsRef.current = pdfjs;
      try {
        const b = (await pdfjs.getDocument(url).promise) as unknown as PdfBelgesi;
        const ilk = (await b.getPage(1)).getViewport({ scale: 1 });
        if (iptal) return;
        setBoyut({ w: ilk.width, h: ilk.height });
        setBelge(b);
        setDurum("hazir");
      } catch { if (!iptal) { setNeden("acilamadi"); setDurum("hata"); } }
    })().catch(() => { if (!iptal) { setNeden("acilamadi"); setDurum("hata"); } });
    return () => { iptal = true; };
  }, [yol]);

  // ── Vurgular ve not ───────────────────────────────────────────
  useEffect(() => {
    if (!kayitli || !user?.id) return;
    isaretleriGetir(user.id, yol).then(setIsaretler).catch((e) => setHata(e.message));
    notuGetir(user.id, yol).then(setNot).catch((e) => setHata(e.message));
  }, [kayitli, user?.id, yol]);

  const notuYaz = (metin: string) => {
    setNot(metin);
    if (!kayitli || !user?.id) return;
    setNotDurumu("yaziliyor");
    if (kayitZamani.current) clearTimeout(kayitZamani.current);
    kayitZamani.current = setTimeout(() => {
      notuKaydet(user.id, yol, metin).then(() => setNotDurumu("kaydedildi")).catch((e) => { setHata(e.message); setNotDurumu(""); });
    }, 800);
  };
  // Kapatırken bekleyen kayıt kaybolmasın.
  const notRefDeger = useRef(not);
  notRefDeger.current = not;
  useEffect(() => () => {
    if (kayitZamani.current && user?.id && kayitli) { clearTimeout(kayitZamani.current); void notuKaydet(user.id, yol, notRefDeger.current); }
  }, [user?.id, kayitli, yol]);

  // ── Ölçü ──────────────────────────────────────────────────────
  useEffect(() => {
    const gozle = new ResizeObserver(() => {
      if (akisRef.current) setGenislik(akisRef.current.clientWidth);
      if (kokRef.current) setKokGenislik(kokRef.current.clientWidth);
    });
    if (akisRef.current) gozle.observe(akisRef.current);
    if (kokRef.current) gozle.observe(kokRef.current);
    return () => gozle.disconnect();
  }, []);
  const genis = kokGenislik >= 900;
  const panelAcik = notAlani && (panel ?? genis);
  const surukle = (e: React.PointerEvent) => {
    e.preventDefault();
    const kok = kokRef.current?.getBoundingClientRect();
    if (!kok) return;
    const tasi = (ev: PointerEvent) => setOran(Math.min(0.8, Math.max(0.25, (ev.clientX - kok.left) / kok.width)));
    const birak = () => {
      window.removeEventListener("pointermove", tasi);
      window.removeEventListener("pointerup", birak);
      setOran((o) => { try { localStorage.setItem(BOLUNME, String(o)); } catch { /* */ } return o; });
    };
    window.addEventListener("pointermove", tasi);
    window.addEventListener("pointerup", birak);
  };
  // Sayfa genişliğine sığdır × yakınlık. Kenarlarda nefes payı.
  const olcek = boyut ? Math.max(0.3, ((genislik - (genislik < 600 ? 16 : 48)) / boyut.w) * yakinlik) : 1;
  const yakinlikDegistir = (d: number) => {
    const y = Math.min(3, Math.max(0.5, +(yakinlik + d).toFixed(2)));
    setYakinlik(y);
    try { localStorage.setItem(YAKINLIK, String(y)); } catch { /* yalnız bu oturum */ }
  };

  // ── Hangi sayfadayız ──────────────────────────────────────────
  const akisKaydi = () => {
    const akis = akisRef.current;
    if (!akis) return;
    const orta = akis.getBoundingClientRect().top + akis.clientHeight / 3;
    for (const el of Array.from(akis.querySelectorAll<HTMLElement>("[data-sayfa]"))) {
      const r = el.getBoundingClientRect();
      if (r.top <= orta && r.bottom >= orta) { setAktifSayfa(Number(el.dataset.sayfa)); break; }
    }
    setSecim(null);
  };
  const sayfayaGit = (n: number) => {
    akisRef.current?.querySelector(`[data-sayfa="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Seçim ─────────────────────────────────────────────────────
  const secimiOku = useCallback(() => {
    const sel = window.getSelection();
    const metin = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!sel || !metin || !sel.rangeCount) { setSecim(null); return; }
    const aralik = sel.getRangeAt(0);
    const sayfaEl = (aralik.commonAncestorContainer instanceof Element ? aralik.commonAncestorContainer : aralik.commonAncestorContainer.parentElement)?.closest<HTMLElement>("[data-sayfa]")
      ?? (aralik.startContainer.parentElement?.closest<HTMLElement>("[data-sayfa]") ?? null);
    if (!sayfaEl) { setSecim(null); return; }
    const kutular = kutulariHesapla(Array.from(aralik.getClientRects()), sayfaEl.getBoundingClientRect());
    if (!kutular.length) { setSecim(null); return; }
    const son = aralik.getBoundingClientRect();
    setSecim({ sayfa: Number(sayfaEl.dataset.sayfa), metin, kutular, x: son.left + son.width / 2, y: son.bottom });
    setKopyalandi(false);
  }, []);

  const isaretle = async (tur: IsaretTuru, renk = "sari") => {
    if (!secim) return;
    const yeni = { belge: yol, sayfa: secim.sayfa, tur, renk, kutular: secim.kutular, metin: secim.metin.slice(0, 2000) };
    window.getSelection()?.removeAllRanges();
    setSecim(null);
    if (!kayitli || !user?.id) { setIsaretler((l) => [...l, { ...yeni, id: `yerel:${Date.now()}` }]); return; }
    try {
      const kayit = await isaretEkle(user.id, yeni);
      setIsaretler((l) => [...l, kayit]);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kaydedilemedi");
      setIsaretler((l) => [...l, { ...yeni, id: `yerel:${Date.now()}` }]);
    }
  };

  const sil = async (id: string) => {
    setIsaretler((l) => l.filter((x) => x.id !== id));
    if (kayitli && user?.id && !id.startsWith("yerel:")) await isaretSil(user.id, id).catch((e) => setHata(e.message));
  };

  const notlaraEkle = () => {
    if (!secim) return;
    // Seçim editöre alıntı bloğu olarak iner, altında sayfa numarası.
    const bloklar = not.trim() ? bloklariOku(not) : [];
    const alinti: NoteBlock = { type: "quote", props: {}, content: [{ type: "text", text: secim.metin, styles: {} }] };
    const kaynak: NoteBlock = { type: "paragraph", props: {}, content: [{ type: "text", text: `— s. ${secim.sayfa}`, styles: { italic: true } }] };
    notuYaz(bloklariYaz([...bloklar, alinti, kaynak, { type: "paragraph", props: {}, content: [] }]));
    window.getSelection()?.removeAllRanges();
    setSecim(null);
    setPanel(true);
  };

  const kopyala = async () => {
    if (!secim) return;
    await navigator.clipboard?.writeText(secim.metin).catch(() => {});
    setKopyalandi(true);
  };

  const sayfalar = useMemo(() => Array.from({ length: belge?.numPages ?? 0 }, (_, i) => i + 1), [belge]);
  const sayfaIsaretleri = useMemo(() => {
    const m = new Map<number, Isaret[]>();
    for (const i of isaretler) m.set(i.sayfa, [...(m.get(i.sayfa) ?? []), i]);
    return m;
  }, [isaretler]);

  return (
    <div ref={kokRef} className="flex flex-col h-full w-full min-w-0" style={{ background: "var(--surface-base)" }}>
      {/* Başlık çubuğu */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 shrink-0" style={{ borderBottom: "0.5px solid var(--border-default)", background: "var(--surface-raised)" }}>
        <span className="text-[13px] font-medium truncate flex-1 min-w-0">{baslik}</span>
        {belge && <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--text-tertiary)" }}>s. {aktifSayfa}/{belge.numPages}</span>}
        <div className="flex items-center shrink-0">
          <button onClick={() => yakinlikDegistir(-0.1)} className="cp-btn cp-btn-ghost min-h-9 px-2" aria-label="Uzaklaştır"><Minus size={14} /></button>
          <button onClick={() => { setYakinlik(1); try { localStorage.setItem(YAKINLIK, "1"); } catch { /* */ } }} className="cp-btn cp-btn-ghost min-h-9 px-1.5 text-[11px] tabular-nums" title="Sayfa genişliğine sığdır">%{Math.round(yakinlik * 100)}</button>
          <button onClick={() => yakinlikDegistir(0.1)} className="cp-btn cp-btn-ghost min-h-9 px-2" aria-label="Yakınlaştır"><Plus size={14} /></button>
        </div>
        {notAlani && <button onClick={() => setPanel(!panelAcik)} className="cp-btn cp-btn-ghost min-h-9 px-2 text-[12px] gap-1 shrink-0" aria-pressed={panelAcik}>
          <NotebookPen size={14} /><span className="hidden sm:inline">{panelAcik ? "Notları gizle" : "Notlarım"}</span>
        </button>}
        <button onClick={onKapat} className="cp-btn cp-btn-ghost min-h-9 px-2 shrink-0" aria-label="Kapat"><X size={16} /></button>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Sayfalar */}
        <div
          ref={akisRef}
          className="min-w-0 overflow-auto"
          style={{ background: "var(--surface-sunken)", ...(panelAcik && genis ? { width: `${oran * 100}%`, flex: "none" } : { flex: 1 }) }}
          onScroll={akisKaydi}
          onMouseUp={() => setTimeout(secimiOku, 0)}
          onTouchEnd={() => setTimeout(secimiOku, 300)}
          onKeyUp={(e) => { if (e.shiftKey) secimiOku(); }}
        >
          {durum === "yukleniyor" && <p className="p-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>PDF yükleniyor…</p>}
          {durum === "hata" && <HataMesaji neden={neden} />}
          {durum === "hazir" && belge && boyut && pdfjsRef.current && (
            <div className="flex flex-col items-center gap-3 sm:gap-5 py-3 sm:py-6 px-2 sm:px-6" style={{ minWidth: "fit-content" }}>
              {sayfalar.map((n) => (
                <Sayfa key={n} no={n} belge={belge} pdfjs={pdfjsRef.current!} olcek={olcek} tahmini={boyut} isaretler={sayfaIsaretleri.get(n) ?? []} />
              ))}
            </div>
          )}
        </div>

        {/* Ortadaki çizgi: sürükleyerek PDF'i büyüt/küçült */}
        {panelAcik && genis && (
          <div
            onPointerDown={surukle}
            onDoubleClick={() => { setOran(0.5); try { localStorage.setItem(BOLUNME, "0.5"); } catch { /* */ } }}
            className="w-2 shrink-0 cursor-col-resize flex items-center justify-center group"
            style={{ background: "var(--surface-raised)", borderLeft: "0.5px solid var(--border-default)", borderRight: "0.5px solid var(--border-default)" }}
            title="Sürükle: PDF'i büyüt/küçült · çift tık: yarı yarıya"
            role="separator"
            aria-orientation="vertical"
          >
            <span className="w-0.5 h-10 rounded-full group-hover:h-16 transition-all" style={{ background: "var(--border-strong)" }} />
          </div>
        )}

        {/* Yandaki not alanı: geniş ekranda yan yana, dar ekranda PDF'in üstünde açılır */}
        {panelAcik && (
          <aside
            className={`${genis ? "flex-1 min-w-0" : "absolute inset-0 z-10"} flex flex-col min-h-0`}
            style={{ background: "var(--surface-raised)" }}
          >
            <div className="flex items-center gap-2 px-4 py-2 shrink-0" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
              <h3 className="text-[13px] font-semibold flex-1">Notlarım</h3>
              <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {!kayitli ? "Giriş yapınca kaydedilir" : notDurumu === "yaziliyor" ? "Kaydediliyor…" : notDurumu === "kaydedildi" ? "Kaydedildi" : "Yazdıkça kaydedilir"}
              </span>
              {!genis && <button onClick={() => setPanel(false)} className="cp-btn cp-btn-ghost min-h-9 px-2 text-[12px]">PDF'e dön</button>}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto epoche-block-editor">
              <BlockEditor noteId={`pdf:${yol}`} content={not} onChange={notuYaz} />
            </div>
            <details className="shrink-0" style={{ borderTop: "0.5px solid var(--border-default)" }} open={isaretler.length > 0 && isaretler.length < 6}>
              <summary className="px-4 py-2 text-[12px] font-semibold cursor-pointer select-none flex items-center gap-2">
                <span className="flex-1">Vurgular ve altı çizilenler</span>
                <span className="tabular-nums font-normal" style={{ color: "var(--text-tertiary)" }}>{isaretler.length}</span>
              </summary>
              <ul className="px-3 pb-3 space-y-1.5 overflow-y-auto max-h-[30vh]">
                {!isaretler.length && <li className="px-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>Henüz yok. PDF'te bir yeri seç, çıkan çubuktan vurgula ya da altını çiz.</li>}
                {isaretler.map((i) => (
                  <li key={i.id} className="flex gap-2 rounded-lg p-2" style={{ background: "var(--surface-base)" }}>
                    <button onClick={() => { if (!genis) setPanel(false); setTimeout(() => sayfayaGit(i.sayfa), 50); }} className="flex-1 min-w-0 text-left">
                      <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={i.tur === "alti" ? { borderBottom: "2px solid #c2410c" } : { background: RENKLER[i.renk] ?? RENKLER.sari }} />
                        s. {i.sayfa} · {i.tur === "alti" ? "altı çizili" : "vurgu"}
                      </span>
                      <span className="block text-[12px] leading-snug mt-0.5 line-clamp-3">{i.metin}</span>
                    </button>
                    <button onClick={() => void sil(i.id)} className="cp-btn cp-btn-ghost min-h-8 px-1.5 self-start opacity-60 hover:opacity-100" aria-label="Sil"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
            </details>
            {hata && <p className="px-4 pb-3 text-[10px]" role="alert" style={{ color: "var(--priority-high-text)" }}>{hata}</p>}
          </aside>
        )}
      </div>

      {/* Seçim çubuğu */}
      {secim && (
        <div
          className="fixed z-[60] flex items-center gap-0.5 rounded-xl p-1 shadow-xl"
          style={{
            left: Math.min(Math.max(8, secim.x - 170), (typeof window !== "undefined" ? window.innerWidth : 400) - 348),
            top: Math.min(secim.y + 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 56),
            background: "var(--surface-raised)", border: "0.5px solid var(--border-default)",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {Object.entries(RENKLER).map(([ad, renk]) => (
            <button key={ad} onClick={() => void isaretle("vurgu", ad)} className="w-9 h-9 rounded-lg flex items-center justify-center" title="Vurgula" aria-label={`Vurgula (${ad})`}>
              <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: renk }}><Highlighter size={11} /></span>
            </button>
          ))}
          <button onClick={() => void isaretle("alti")} className="w-9 h-9 rounded-lg flex items-center justify-center" title="Altını çiz" aria-label="Altını çiz"><Underline size={15} /></button>
          <span className="w-px h-6 mx-0.5" style={{ background: "var(--border-default)" }} />
          {notAlani && <button onClick={notlaraEkle} className="h-9 px-2 rounded-lg flex items-center gap-1 text-[12px]" title="Notlara ekle"><NotebookPen size={14} />Notlara ekle</button>}
          <button onClick={() => void kopyala()} className="w-9 h-9 rounded-lg flex items-center justify-center" title="Kopyala" aria-label="Kopyala">
            {kopyalandi ? <span className="text-[10px]">✓</span> : <Copy size={14} />}
          </button>
          {onAlinti && (
            <button onClick={() => { onAlinti(secim.metin, secim.sayfa); window.getSelection()?.removeAllRanges(); setSecim(null); }} className="w-9 h-9 rounded-lg flex items-center justify-center" title="Konu notuna alıntı olarak ekle" aria-label="Konu notuna al">
              <Quote size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tek sayfa: ekrana yaklaşınca çizilir (uzun bölümlerde bütün sayfaları baştan
 * çizmek telefonu yorardı). Tuval ekranın piksel yoğunluğunda; üstünde seçilebilir
 * metin katmanı ve vurgular.
 */
function Sayfa({ no, belge, pdfjs, olcek, tahmini, isaretler }: {
  no: number; belge: PdfBelgesi; pdfjs: PdfJs; olcek: number; tahmini: { w: number; h: number }; isaretler: Isaret[];
}) {
  const kapRef = useRef<HTMLDivElement>(null);
  const tuvalRef = useRef<HTMLCanvasElement>(null);
  const metinRef = useRef<HTMLDivElement>(null);
  const [gorunur, setGorunur] = useState(no <= 2);
  const [boyut, setBoyut] = useState(tahmini);

  useEffect(() => {
    const el = kapRef.current;
    if (!el) return;
    const gozle = new IntersectionObserver(([g]) => { if (g.isIntersecting) setGorunur(true); }, { rootMargin: "1200px 0px" });
    gozle.observe(el);
    return () => gozle.disconnect();
  }, []);

  useEffect(() => {
    if (!gorunur) return;
    let iptal = false;
    let gorev: { cancel: () => void } | null = null;
    (async () => {
      const sayfa = await belge.getPage(no);
      if (iptal) return;
      const gorunum = sayfa.getViewport({ scale: olcek });
      setBoyut({ w: gorunum.width / olcek, h: gorunum.height / olcek });
      const tuval = tuvalRef.current;
      const metin = metinRef.current;
      if (!tuval || !metin) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      tuval.width = Math.floor(gorunum.width * dpr);
      tuval.height = Math.floor(gorunum.height * dpr);
      tuval.style.width = `${gorunum.width}px`;
      tuval.style.height = `${gorunum.height}px`;
      const ctx = tuval.getContext("2d");
      if (!ctx) return;
      const r = sayfa.render({ canvasContext: ctx, viewport: gorunum, canvas: tuval, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      gorev = r;
      await r.promise.catch(() => {});
      if (iptal) return;
      metin.replaceChildren();
      const katman = new pdfjs.TextLayer({ textContentSource: sayfa.streamTextContent(), container: metin, viewport: gorunum as never });
      await katman.render().catch(() => {});
    })();
    return () => { iptal = true; gorev?.cancel(); };
  }, [gorunur, belge, no, olcek, pdfjs]);

  const w = boyut.w * olcek, h = boyut.h * olcek;
  return (
    <div
      ref={kapRef}
      data-sayfa={no}
      className="relative shrink-0 bg-white"
      style={{ width: w, height: h, boxShadow: "0 1px 3px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.06)", ["--total-scale-factor" as string]: olcek, ["--scale-round-x" as string]: "1px", ["--scale-round-y" as string]: "1px" }}
    >
      <canvas ref={tuvalRef} className="absolute inset-0" />
      {/* Vurgular metnin altında; metin katmanı üstte kalır ki seçim çalışsın. */}
      <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: "multiply" }}>
        {isaretler.flatMap((i) => i.kutular.map((k, j) => (
          <div
            key={`${i.id}-${j}`}
            className="absolute"
            style={{
              left: `${k.x * 100}%`, top: `${k.y * 100}%`, width: `${k.w * 100}%`, height: `${k.h * 100}%`,
              ...(i.tur === "alti"
                ? { borderBottom: `${Math.max(1.5, olcek * 1.2)}px solid #c2410c` }
                : { background: RENKLER[i.renk] ?? RENKLER.sari, borderRadius: 2 }),
            }}
          />
        )))}
      </div>
      <div ref={metinRef} className="textLayer" />
    </div>
  );
}

function HataMesaji({ neden }: { neden: KaynakHatasi | "acilamadi" | null }) {
  return (
    <div className="p-4 text-[12px] leading-relaxed" style={{ color: "var(--priority-high-text)" }} role="alert">
      {neden === "izin" ? (
        <>
          <p className="font-semibold">Materyal klasörü kapalı.</p>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
            Dosya depoda duruyor ama bu hesabın okuma izni yok. Supabase&apos;de{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>migration-epoche-v10-duzeltmeler.sql</code> bir kez çalıştırıldığında açılacak.
          </p>
        </>
      ) : neden === "acilamadi" ? (
        <p>Dosya indirildi ama açılamadı. Okuyucuyu kapatıp yeniden dene.</p>
      ) : neden === "ag" ? (
        <p>Bağlantı kurulamadı. İnternet gidip gelmiş olabilir; tekrar dene.</p>
      ) : (
        <p>Bu bölümün PDF&apos;i depoya henüz yüklenmemiş.</p>
      )}
    </div>
  );
}
