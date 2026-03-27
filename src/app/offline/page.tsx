"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div
      className="flex items-center justify-center min-h-screen px-4"
      style={{ background: "var(--surface-base)" }}
    >
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--surface-sunken)" }}
        >
          <WifiOff size={28} style={{ color: "var(--text-tertiary)" }} />
        </div>
        <h1
          className="text-xl font-medium mb-2"
          style={{
            fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)",
            color: "var(--text-primary)",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>Chrono</span>
          <span style={{ color: "var(--brand-gold)" }}>Plan</span>
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Internet baglantiniz yok. Cevrimdisi modda bazi ozellikler kisitli olabilir.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="cp-btn cp-btn-primary gap-2"
        >
          <RefreshCw size={14} />
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
