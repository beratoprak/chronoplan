"use client";

// Kazanım işaretleri ve ezber kartları not bloklarından okunuyor. Konu notları
// v17 ile okul notlarına (okul_not) taşındı; burada ikisi birleşir. Okul notları
// okunabildiyse genel notlardaki eski kopyaları sayılmaz (eski işaret yeniyi
// ezmesin); tablo henüz yoksa (v17 çalıştırılmadı) eskisi gibi genel notlar.

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "./store";
import { eskiOkulNotuMu, okulNotIcerikleri } from "./okul-notlari";

export function useNotBloklari(): { content: string }[] {
  const user = useAppStore((s) => s.user);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const richNotes = useAppStore((s) => s.richNotes);
  // Okul notlarından dönünce tazelensin.
  const gorunum = useAppStore((s) => s.currentView);
  const [okul, setOkul] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user?.id || isDemoMode) { setOkul(null); return; }
    let iptal = false;
    okulNotIcerikleri(user.id).then((l) => { if (!iptal) setOkul(l); }).catch(() => { if (!iptal) setOkul(null); });
    return () => { iptal = true; };
  }, [user?.id, isDemoMode, gorunum]);

  return useMemo(
    () => (okul ? [...richNotes.filter((n) => !eskiOkulNotuMu(n)), ...okul.map((content) => ({ content }))] : richNotes),
    [okul, richNotes],
  );
}
