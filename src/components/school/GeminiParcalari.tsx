"use client";

// Faz G'nin ekrandaki iki parçası: konu zorluğu ve haftanın açıklaması.
// İkisi de Gemini'nin çıktısı; yoksa hiçbir şey çizilmez (plan yine çalışır).

import { Sparkles } from "lucide-react";
import type { HaftalikAciklama } from "@/lib/school-data";

/** Zorluk 1-5: beş küçük nokta. Tahmin yoksa görünmez. */
export function ZorlukRozeti({ zorluk }: { zorluk?: number }) {
  if (!zorluk) return null;
  const etiket = ["", "çok kolay", "kolay", "orta", "zor", "çok zor"][zorluk] ?? "";
  return (
    <span className="inline-flex items-center gap-[3px] align-middle" title={`Zorluk ${zorluk}/5 — ${etiket} (Gemini tahmini)`} aria-label={`Zorluk ${zorluk}/5, ${etiket}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="inline-block w-[5px] h-[5px] rounded-full"
          style={{ background: i <= zorluk ? (zorluk >= 4 ? "var(--priority-high-text)" : "var(--tag-school-text)") : "var(--border-strong)" }}
        />
      ))}
    </span>
  );
}

/** Haftanın açıklaması: planla birlikte, 3-4 cümle. */
export function AciklamaKarti({ aciklama, buyuk = false }: { aciklama?: HaftalikAciklama | null; buyuk?: boolean }) {
  if (!aciklama?.metin) return null;
  return (
    <div className="rounded-2xl px-4 py-3 lg:px-6 lg:py-4 flex gap-3" style={{ background: "var(--tag-school-bg)" }}>
      <Sparkles size={buyuk ? 18 : 15} className="shrink-0 mt-0.5" style={{ color: "var(--tag-school-text)" }} />
      <div className="min-w-0">
        <p className={`${buyuk ? "text-[11px] lg:text-[13px]" : "text-[10px]"} font-semibold uppercase tracking-wide mb-1`} style={{ color: "var(--tag-school-text)" }}>
          Bu haftanın planı neden böyle
        </p>
        <p className={`${buyuk ? "text-[14px] lg:text-[17px]" : "text-[12px]"} leading-relaxed`} style={{ color: "var(--text-primary)" }}>{aciklama.metin}</p>
      </div>
    </div>
  );
}

/** Bir haftanın açıklaması (hafta: pazartesi tarihi). */
export const haftaninAciklamasi = (liste: HaftalikAciklama[] | undefined, hafta: string | undefined | null) =>
  (hafta && liste?.find((a) => String(a.hafta).slice(0, 10) === String(hafta).slice(0, 10))) || null;
