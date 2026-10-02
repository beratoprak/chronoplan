"use client";

import { CheckCircle2 } from "lucide-react";
import type { UnitProgress } from "@/lib/study-plan";
import { ADIM_ETIKETI, ilerlemeKatsayisi, isaretliAdimlar, type Adim } from "@/lib/ilerleme";

/**
 * Konunun dört adımlı checklist'i: Oku · İzle · Soru çöz · Hakimim.
 * Konuda olmayan adım (videosuz, sorusuz) hiç gösterilmez. Her adım ayrı
 * işaretlenir ve ayrı kaldırılır; yanında konunun yüzdesi durur.
 */
export function KonuChecklist({ kayit, mevcut, mesgul, onDegis }: {
  kayit?: UnitProgress;
  mevcut: Adim[];
  mesgul: boolean;
  onDegis: (adim: Adim, isaretli: boolean) => void;
}) {
  const isaretli = new Set(isaretliAdimlar(kayit, mevcut));
  const yuzde = Math.round(ilerlemeKatsayisi(kayit, mevcut) * 100);
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Konu adımları">
      {mevcut.map((adim) => {
        const acik = isaretli.has(adim);
        return (
          <button
            key={adim}
            onClick={() => onDegis(adim, !acik)}
            disabled={mesgul}
            aria-pressed={acik}
            className="cp-btn min-h-11 px-3 text-[11px] gap-1.5 disabled:opacity-50"
            style={acik
              ? { background: "var(--priority-low-bg)", color: "var(--priority-low-text)", border: "0.5px solid transparent" }
              : { background: "transparent", color: "var(--text-secondary)", border: "0.5px solid var(--border-default)" }}
          >
            <span
              aria-hidden
              className="w-3.5 h-3.5 rounded-[4px] flex items-center justify-center shrink-0"
              style={acik
                ? { background: "var(--priority-low-text)" }
                : { border: "1.5px solid var(--border-strong)" }}
            >
              {acik && <CheckCircle2 size={10} color="var(--surface-raised)" strokeWidth={3} />}
            </span>
            {ADIM_ETIKETI[adim]}
          </button>
        );
      })}
      <span className="text-[11px] font-semibold tabular-nums ml-1" style={{ color: yuzde === 100 ? "var(--priority-low-text)" : "var(--text-tertiary)" }}>
        %{yuzde}
      </span>
    </div>
  );
}
