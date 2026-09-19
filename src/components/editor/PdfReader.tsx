"use client";

// Ders PDF okuyucu.
//
// Seçilen metin doğrudan nota alıntı olarak düşürülebiliyor — okumakla not
// almak arasındaki kopukluk çalışmanın en çok emek kaybettiren yeri.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, X } from "lucide-react";
import { imzaliBaglanti } from "@/lib/pdf-kaynak";

interface Props {
  yol: string;
  baslik: string;
  onKapat: () => void;
  onAlinti: (metin: string, sayfa: number) => void;
}

export function PdfReader({ yol, baslik, onKapat, onAlinti }: Props) {
  const tuvalRef = useRef<HTMLCanvasElement>(null);
  const metinKatmaniRef = useRef<HTMLDivElement>(null);
  const belgeRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const [durum, setDurum] = useState<"yukleniyor" | "hazir" | "hata">("yukleniyor");
  const [secim, setSecim] = useState("");

  useEffect(() => {
    let iptal = false;
    (async () => {
      setDurum("yukleniyor");
      const url = await imzaliBaglanti(yol);
      if (!url) { if (!iptal) setDurum("hata"); return; }
      // pdfjs yalnız tarayıcıda çalışıyor; sunucu derlemesine girmemesi için
      // dinamik ithal ediliyor.
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      try {
        const belge = await pdfjs.getDocument(url).promise;
        if (iptal) return;
        belgeRef.current = belge as never;
        setToplam(belge.numPages);
        setSayfa(1);
        setDurum("hazir");
      } catch { if (!iptal) setDurum("hata"); }
    })();
    return () => { iptal = true; };
  }, [yol]);

  const ciz = useCallback(async () => {
    const belge = belgeRef.current as never as { getPage: (n: number) => Promise<never> } | null;
    const tuval = tuvalRef.current;
    if (!belge || !tuval) return;
    const sayfaNesnesi = await belge.getPage(sayfa) as never as {
      getViewport: (o: { scale: number }) => { width: number; height: number };
      render: (o: unknown) => { promise: Promise<void> };
      getTextContent: () => Promise<{ items: { str: string }[] }>;
    };
    const olcek = Math.min(1.6, (tuval.parentElement?.clientWidth ?? 700) / sayfaNesnesi.getViewport({ scale: 1 }).width);
    const gorunum = sayfaNesnesi.getViewport({ scale: olcek });
    tuval.width = gorunum.width;
    tuval.height = gorunum.height;
    const ctx = tuval.getContext("2d");
    if (!ctx) return;
    await sayfaNesnesi.render({ canvasContext: ctx, viewport: gorunum, canvas: tuval }).promise;
    // Metin katmanı seçim için: tuval üzerine yazı çizilmiyor, metin ayrı tutuluyor.
    const icerik = await sayfaNesnesi.getTextContent();
    if (metinKatmaniRef.current) {
      metinKatmaniRef.current.textContent = icerik.items.map((i) => i.str).join(" ");
    }
  }, [sayfa]);

  useEffect(() => { if (durum === "hazir") void ciz(); }, [durum, ciz]);

  useEffect(() => {
    const dinle = () => setSecim(window.getSelection()?.toString().trim() ?? "");
    document.addEventListener("selectionchange", dinle);
    return () => document.removeEventListener("selectionchange", dinle);
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: "0.5px solid var(--border-default)" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
        <span className="text-[12px] font-medium truncate flex-1">{baslik}</span>
        <button onClick={() => setSayfa((s) => Math.max(1, s - 1))} disabled={sayfa <= 1} className="cp-btn cp-btn-ghost min-h-8 px-2 disabled:opacity-30"><ChevronLeft size={14} /></button>
        <span className="text-[11px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>{sayfa}/{toplam || "—"}</span>
        <button onClick={() => setSayfa((s) => Math.min(toplam, s + 1))} disabled={sayfa >= toplam} className="cp-btn cp-btn-ghost min-h-8 px-2 disabled:opacity-30"><ChevronRight size={14} /></button>
        <button onClick={onKapat} className="cp-btn cp-btn-ghost min-h-8 px-2"><X size={14} /></button>
      </div>

      {secim && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: "var(--tag-school-bg)" }}>
          <span className="text-[11px] truncate flex-1" style={{ color: "var(--tag-school-text)" }}>{secim.slice(0, 80)}</span>
          <button
            onClick={() => { onAlinti(secim, sayfa); window.getSelection()?.removeAllRanges(); setSecim(""); }}
            className="cp-btn cp-btn-primary min-h-8 text-[11px] shrink-0"
          >
            <Quote size={12} />Nota al
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        {durum === "yukleniyor" && <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>PDF yükleniyor…</p>}
        {durum === "hata" && <p className="text-[12px]" style={{ color: "var(--priority-high-text)" }}>PDF açılamadı. Dosya yüklenmemiş olabilir.</p>}
        <canvas ref={tuvalRef} style={{ maxWidth: "100%", display: durum === "hazir" ? "block" : "none" }} />
        <div
          ref={metinKatmaniRef}
          className="text-[11px] mt-3 leading-relaxed select-text"
          style={{ color: "var(--text-secondary)", display: durum === "hazir" ? "block" : "none" }}
        />
      </div>
    </div>
  );
}
