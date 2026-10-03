"use client";

// Takvimin sağ üst köşesinde iplerden sarkıp sallanan figürler.
// Hiçbir şeye dokunmayı engellemez (altındaki düğmeye tıklanır); bir konuya
// "Hakimim" denince hepsi sevinir (KUTLAMA olayı).
// Hareket azaltılmışsa (sistem ayarı) sallanmaz. Ayarlar → Figürlerim'den gizlenebilir.

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { DEGISTI, EN_FAZLA, GORUNUR, HAZIR_FIGURLER, KUTLAMA, figurleriGetir, onbellektenFigurler, type Figur } from "@/lib/figurler";

const IPLER = [22, 44, 30, 54]; // her figürün ip uzunluğu: farklı boylar daha canlı durur

export function SallananFigurler() {
  const { user, isDemoMode } = useAppStore();
  const [figurler, setFigurler] = useState<Figur[]>(() => onbellektenFigurler() ?? []);
  const [gorunur, setGorunur] = useState(true);
  const [kutla, setKutla] = useState(0);

  useEffect(() => {
    const tazele = () => {
      try { setGorunur(localStorage.getItem(GORUNUR) !== "kapali"); } catch { /* varsayılan açık */ }
      if (user?.id && !isDemoMode) figurleriGetir(user.id).then(setFigurler).catch(() => {});
    };
    tazele();
    const sevin = () => setKutla(Date.now());
    window.addEventListener(DEGISTI, tazele);
    window.addEventListener(KUTLAMA, sevin);
    return () => { window.removeEventListener(DEGISTI, tazele); window.removeEventListener(KUTLAMA, sevin); };
  }, [user?.id, isDemoMode]);

  if (!gorunur) return null;
  const liste = (figurler.length ? figurler : HAZIR_FIGURLER).slice(0, EN_FAZLA);

  return (
    // İçerik alanının üst kenarına yapışık sıfır yükseklikli şerit: ipler başlığın
    // altından sarkar, sayfa kaysa da figürler köşede kalır.
    <div aria-hidden className="sticky top-0 h-0 z-30 pointer-events-none">
    <div className="absolute -top-3 sm:-top-5 right-0 flex gap-1.5 sm:gap-3">
      <style>{`
        @keyframes epoche-sallan { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
        @keyframes epoche-sevin { 0%,100% { transform: translateY(0) rotate(0) } 25% { transform: translateY(-18px) rotate(-12deg) scale(1.15) } 50% { transform: translateY(0) rotate(0) } 75% { transform: translateY(-10px) rotate(12deg) } }
        .epoche-ip { transform-origin: top center; animation: epoche-sallan var(--sure) ease-in-out infinite; animation-delay: var(--gecikme); }
        @media (prefers-reduced-motion: reduce) { .epoche-ip, .epoche-govde { animation: none !important; } }
      `}</style>
      {liste.map((f, i) => (
        <div key={f.id} className="epoche-ip flex flex-col items-center" style={{ ["--sure" as string]: `${2.6 + i * 0.45}s`, ["--gecikme" as string]: `${-i * 0.7}s` }}>
          <div style={{ width: 1.5, height: IPLER[i % IPLER.length], background: "var(--border-strong)" }} />
          <div className="-mt-0.5">
            <img
              key={kutla}
              src={f.resim}
              alt=""
              draggable={false}
              className="epoche-govde w-9 h-9 sm:w-12 sm:h-12 object-contain select-none"
              style={{
                filter: "drop-shadow(0 3px 4px rgba(0,0,0,.18))",
                animation: kutla && Date.now() - kutla < 2000 ? `epoche-sevin 0.9s ease-in-out ${i * 0.12}s 2` : undefined,
              }}
            />
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}
