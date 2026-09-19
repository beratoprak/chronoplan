"use client";

import { useEffect } from "react";

/**
 * Service worker'ı elle kaydeder.
 *
 * next-pwa v5'in `register: true` seçeneği Pages Router için yazılmıştır ve
 * App Router'da kayıt betiğini pakete eklemez. Sonuç olarak /sw.js üretiliyor
 * ama hiç kaydolmuyordu; bu da hem çevrimdışı önbelleği hem Web Push'u
 * devre dışı bırakıyordu (navigator.serviceWorker.ready hiç çözülmüyor).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker kaydedilemedi:", error);
    });
  }, []);

  return null;
}
