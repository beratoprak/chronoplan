"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const CURRENT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/**
 * Yeni sürüm çıktığında alttan bir "Güncelle" bildirimi gösterir.
 * Böylece uygulamayı SİLMEDEN her zaman en güncel sürüme geçilir —
 * silmek veri kabını da sildiği için asla önerilmez.
 */
export function UpdateNotifier() {
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (CURRENT_BUILD === "dev") return; // yerel geliştirmede devre dışı
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (!cancelled && build && build !== "dev" && build !== CURRENT_BUILD) {
          setUpdateReady(true);
        }
      } catch {
        // çevrimdışı — sessiz geç
      }
    }

    void check();
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => void check(), 30 * 60_000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  async function applyUpdate() {
    setUpdating(true);
    try {
      // Service worker önbelleklerini boşalt ki yenileme taze kodu getirsin.
      // Veriye (localStorage/Supabase) DOKUNULMAZ.
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
    } catch {
      // temizlik başarısız olsa da yenile
    }
    window.location.reload();
  }

  if (!updateReady) return null;

  return (
    <div
      className="fixed inset-x-0 z-[90] flex justify-center px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
    >
      <button
        onClick={applyUpdate}
        disabled={updating}
        className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg animate-fade-in"
        style={{
          background: "var(--brand-gold)",
          color: "var(--text-inverse)",
        }}
      >
        <RefreshCw size={14} className={updating ? "animate-spin" : ""} />
        {updating ? "Güncelleniyor..." : "Yeni sürüm hazır — Güncelle"}
      </button>
    </div>
  );
}
