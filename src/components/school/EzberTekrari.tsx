"use client";

// Sınav haftası tekrar gününde dersin ezber kartları (Plan v3, Faz H).
// Kartlar notlardaki ezber bloklarından; değerlendirme Okul → Tekrar ile aynı
// aralıklı tekrar hesabına yazılır. Sınava günler kaldığı için bu derste zamanı
// gelmemiş kartlar da sıraya girer, en yakın zamanlı önce.

import { useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { ezberKartlari } from "@/lib/note-blocks";
import { useNotBloklari } from "@/lib/useNotBloklari";
import { degerlendir, yeniKart, type Deger, type KartDurumu } from "@/lib/spaced-repetition";
import { saveCardReview, type FlashcardRow } from "@/lib/school-data";

const DEGERLER = [["tekrar", "Bilemedim"], ["zor", "Zor"], ["iyi", "İyi"], ["kolay", "Kolay"]] as const;

export function EzberTekrari({ dersKodu, zamanlama, salt }: { dersKodu: string; zamanlama: FlashcardRow[]; salt: boolean }) {
  const { user } = useAppStore();
  const notlar = useNotBloklari();
  const [bitti, setBitti] = useState<Set<string>>(new Set());
  const [cevrildi, setCevrildi] = useState(false);
  const [mesgul, setMesgul] = useState(false);

  const kartlar = useMemo(() => {
    const z = new Map(zamanlama.map((f) => [f.id, f]));
    const simdi = new Date().toISOString();
    return ezberKartlari(notlar)
      .filter((k) => k.dersKodu === dersKodu)
      .map((k) => {
        const f = z.get(k.cardId);
        const durum: KartDurumu = f
          ? { ease: Number(f.ease), interval: f.interval_days, reps: f.reps, lapses: f.lapses, dueAt: f.due_at, lastReviewedAt: f.last_reviewed_at }
          : yeniKart(simdi);
        return { ...k, durum };
      })
      .sort((a, b) => a.durum.dueAt.localeCompare(b.durum.dueAt));
  }, [notlar, zamanlama, dersKodu]);

  const kalan = kartlar.filter((k) => !bitti.has(k.cardId));
  const kart = kalan[0];

  if (!kartlar.length) {
    return <p className="text-[12px] lg:text-[14px]" style={{ color: "var(--text-tertiary)" }}>Bu derste ezber kartın yok. Konu notunda "/" yazıp ezber kartı ekleyebilirsin.</p>;
  }
  if (!kart) {
    return <p className="text-[12px] lg:text-[14px]" style={{ color: "var(--priority-low-text)" }}>Bu dersin {kartlar.length} kartının hepsine baktın ✓</p>;
  }

  const sec = async (deger: Deger) => {
    setMesgul(true);
    try {
      if (!salt && user?.id) {
        await saveCardReview(user.id, kart.cardId, degerlendir(kart.durum, deger, new Date()), { unitId: kart.unitId, dersKodu: kart.dersKodu });
      }
      setBitti((b) => new Set(b).add(kart.cardId));
      setCevrildi(false);
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 lg:p-5" style={{ background: "var(--surface-sunken)" }}>
      <p className="text-[11px] lg:text-[13px] mb-2" style={{ color: "var(--text-tertiary)" }}>Kart {kartlar.length - kalan.length + 1}/{kartlar.length}</p>
      <p className="text-[14px] lg:text-[17px] font-medium leading-snug">{kart.on || "Ön yüz boş"}</p>
      {cevrildi ? (
        <>
          <p className="text-[13px] lg:text-[16px] leading-relaxed mt-3 pt-3" style={{ borderTop: "0.5px solid var(--border-default)", color: "var(--text-secondary)" }}>{kart.arka || "Arka yüz boş"}</p>
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {DEGERLER.map(([deger, etiket]) => (
              <button key={deger} onClick={() => void sec(deger)} disabled={mesgul} className="cp-btn cp-btn-ghost min-h-11 text-[11px] lg:text-[13px] disabled:opacity-50">{etiket}</button>
            ))}
          </div>
        </>
      ) : (
        <button onClick={() => setCevrildi(true)} className="cp-btn cp-btn-primary min-h-11 text-[12px] lg:text-[14px] mt-3">Cevabı göster</button>
      )}
    </div>
  );
}
