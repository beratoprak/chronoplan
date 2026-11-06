"use client";

// OYS videosunu uygulamanın içinde oynatır (Plan v3, Faz F).
//
// Adres Epoche'nin video aracısından alınır (kısa ömürlü, imzalı); OYS anahtarı
// tarayıcıya hiç gelmez. Videonun %90'ı izlenince `onIzlendi` çağrılır — son
// saniyelerdeki kapanış yazısını beklemek gerekmesin.
//
// Hız düğmesi (6 Kasım): 1× → 1,25× → 1,5× → 1,75× → 2× → 1×. Seçilen hız
// bu cihazda hatırlanır; bir sonraki video da o hızla açılır.

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { HIZLAR, hizYazisi, sonrakiHiz } from "@/lib/video-hizi";

const HIZ_ANAHTARI = "epoche:video-hizi";

function kayitliHiz(): number {
  try {
    const h = Number(localStorage.getItem(HIZ_ANAHTARI));
    return HIZLAR.includes(h) ? h : 1;
  } catch {
    return 1;
  }
}

export function VideoOynatici({ modulId, baslik, oysUrl, onKapat, onIzlendi }: {
  modulId: string;
  baslik: string;
  oysUrl: string | null;
  onKapat: () => void;
  onIzlendi: () => void;
}) {
  const [adres, setAdres] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const bildirildi = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const [hiz, setHiz] = useState(1);

  useEffect(() => { setHiz(kayitliHiz()); }, []);
  // Tarayıcı yeni kaynakta hızı 1'e döndürür; her yüklemede yeniden uygulanır.
  useEffect(() => { if (video.current) video.current.playbackRate = hiz; }, [hiz, adres]);

  const hizDegistir = () => {
    const yeni = sonrakiHiz(hiz);
    setHiz(yeni);
    try { localStorage.setItem(HIZ_ANAHTARI, String(yeni)); } catch { /* özel pencere: yalnız bu video */ }
  };

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetch("/api/oys-video", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: JSON.stringify({ modulId }),
        });
        const govde = await res.json().catch(() => ({}));
        if (iptal) return;
        if (!res.ok || !govde.url) setHata(govde.error ?? "Video açılamadı");
        else setAdres(govde.url);
      } catch {
        if (!iptal) setHata("Bağlantı kurulamadı");
      }
    })();
    return () => { iptal = true; };
  }, [modulId]);

  const ilerledi = (v: HTMLVideoElement) => {
    if (bildirildi.current || !v.duration) return;
    if (v.currentTime / v.duration >= 0.9) {
      bildirildi.current = true;
      onIzlendi();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000" }} role="dialog" aria-modal="true" aria-label={baslik}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ paddingTop: "calc(8px + env(safe-area-inset-top))", color: "#fff" }}>
        <span className="text-[13px] font-medium truncate flex-1">{baslik}</span>
        {adres && !hata && (
          <button
            onClick={hizDegistir}
            className="cp-btn min-h-11 px-3 text-[13px] font-semibold tabular-nums"
            style={{ color: "#fff", border: "0.5px solid rgba(255,255,255,0.35)" }}
            aria-label={`Oynatma hızı ${hizYazisi(hiz)}, değiştir`}
            title="Oynatma hızı"
          >
            {hizYazisi(hiz)}
          </button>
        )}
        {oysUrl && (
          <a href={oysUrl} target="_blank" rel="noreferrer" className="cp-btn min-h-11 px-3 text-[12px] gap-1" style={{ color: "#fff" }} title="OYS'de aç">
            OYS<ArrowUpRight size={12} />
          </a>
        )}
        <button onClick={onKapat} className="cp-btn min-h-11 px-3" style={{ color: "#fff" }} aria-label="Videoyu kapat"><X size={18} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {hata ? (
          <div className="text-center px-6" style={{ color: "#ddd" }} role="alert">
            <p className="text-[14px]">{hata}</p>
            {oysUrl && (
              <a href={oysUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-[13px] underline underline-offset-2">
                OYS'de izle<ArrowUpRight size={12} />
              </a>
            )}
          </div>
        ) : adres ? (
          <video
            ref={video}
            src={adres}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="w-full h-full max-h-full"
            style={{ objectFit: "contain" }}
            onLoadedMetadata={(e) => { e.currentTarget.playbackRate = hiz; }}
            onRateChange={(e) => { if (HIZLAR.includes(e.currentTarget.playbackRate)) setHiz(e.currentTarget.playbackRate); }}
            onTimeUpdate={(e) => ilerledi(e.currentTarget)}
            onEnded={(e) => ilerledi(e.currentTarget)}
            onError={() => setHata("Video oynatılamadı")}
          />
        ) : (
          <Loader2 size={22} className="animate-spin" style={{ color: "#aaa" }} />
        )}
      </div>
    </div>
  );
}
