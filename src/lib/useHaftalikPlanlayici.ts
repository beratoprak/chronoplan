"use client";

// Haftalık planı kendiliğinden kuran arka plan kancası (Plan v3, Faz B).
//
// Karar (2 Ekim): plan Epoche'nin içinde hesaplanıyor. Pazar 21:00'den sonra
// uygulama ilk açıldığında yeni hafta kurulur; hafta ortasında plan hiç yoksa
// bugünden pazara kurulur. Hedef haftanın planı zaten varsa hiçbir şey yazılmaz —
// kontrol tek satırlık bir okuma.

import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useAppStore } from "./store";
import { enYakinSinav, planiKurVeYaz } from "./haftalik-plan-kayit";

/** Uygulama açıkken pazar 21:00 sınırını da yakalamak için. */
const KONTROL_ARALIGI_MS = 15 * 60_000;

export function useHaftalikPlanlayici() {
  const userId = useAppStore((s) => s.user?.id);
  const demo = useAppStore((s) => s.isDemoMode);
  const events = useAppStore((s) => s.events);
  // Sınav etkinliği ilk senkron bitmeden gelmiyor; gelince kanca yeniden çalışır.
  const sinavVar = useMemo(() => Boolean(enYakinSinav(events, format(new Date(), "yyyy-MM-dd"))), [events]);

  useEffect(() => {
    if (!userId || demo || !sinavVar) return;
    const calistir = async () => {
      try {
        const sonuc = await planiKurVeYaz(userId, useAppStore.getState().events);
        if (sonuc.durum === "kuruldu") await useAppStore.getState().syncFromSupabase();
      } catch (e) {
        // Tablo henüz kurulmadıysa (v12 çalıştırılmadı) ya da ağ yoksa sessizce
        // geç; bir sonraki açılışta yeniden denenir.
        console.warn("Haftalık plan kurulamadı:", e);
      }
    };
    void calistir();
    const gorunur = () => { if (document.visibilityState === "visible") void calistir(); };
    document.addEventListener("visibilitychange", gorunur);
    const zamanlayici = window.setInterval(() => void calistir(), KONTROL_ARALIGI_MS);
    return () => {
      document.removeEventListener("visibilitychange", gorunur);
      window.clearInterval(zamanlayici);
    };
  }, [userId, demo, sinavVar]);
}
