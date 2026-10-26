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

/** Beynin notu: pazar mektubu, sabah notu ya da son düzlük mektubu. */
export function AciklamaKarti({ aciklama, buyuk = false, baslik = "Bu haftanın mektubu" }: { aciklama?: HaftalikAciklama | null; buyuk?: boolean; baslik?: string }) {
  if (!aciklama?.metin) return null;
  return (
    <div className="rounded-2xl px-4 py-3 lg:px-6 lg:py-4 flex gap-3" style={{ background: "var(--tag-school-bg)" }}>
      <Sparkles size={buyuk ? 18 : 15} className="shrink-0 mt-0.5" style={{ color: "var(--tag-school-text)" }} />
      <div className="min-w-0">
        <p className={`${buyuk ? "text-[11px] lg:text-[13px]" : "text-[10px]"} font-semibold uppercase tracking-wide mb-1`} style={{ color: "var(--tag-school-text)" }}>
          {baslik}
        </p>
        {aciklama.metin.split(/\n{2,}/).map((paragraf, i) => (
          <p key={i} className={`${buyuk ? "text-[14px] lg:text-[17px]" : "text-[12px]"} leading-relaxed ${i ? "mt-2" : ""}`} style={{ color: "var(--text-primary)" }}>{paragraf}</p>
        ))}
      </div>
    </div>
  );
}

const turu = (a: HaftalikAciklama) => (/:gun:/.test(a.id ?? "") ? "gun" : /:son:/.test(a.id ?? "") ? "son" : "hafta");

/** Bir haftanın pazar mektubu (hafta: pazartesi tarihi). */
export const haftaninAciklamasi = (liste: HaftalikAciklama[] | undefined, hafta: string | undefined | null) =>
  (hafta && liste?.find((a) => turu(a) === "hafta" && String(a.hafta).slice(0, 10) === String(hafta).slice(0, 10))) || null;

/** Bir günün sabah notu. */
export const gununNotu = (liste: HaftalikAciklama[] | undefined, tarih: string) =>
  liste?.find((a) => turu(a) === "gun" && String(a.hafta).slice(0, 10) === tarih) || null;

/** Bir sınavın son düzlük mektubu. */
export const sonDuzlukMektubu = (liste: HaftalikAciklama[] | undefined, sinavTarihi: string | undefined | null) =>
  (sinavTarihi && liste?.find((a) => turu(a) === "son" && (a.id ?? "").endsWith(`:son:${sinavTarihi}`))) || null;
