"use client";

// Sınav dilimindeki durumun grafiği (11 Kasım, Berat: "şu anki vaziyetin
// detaylı bir sunumu"). Her ders bir çubuk, her konu çubukta bir dilim:
// genişliği sınavda getirdiği soru kadar, rengi hali kadar. Dikey çizgi 12
// doğru eşiği. Derse basınca konuları tek tek açılır.

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { BarChart3, ChevronRight } from "lucide-react";
import { KONU_HALI_SIRASI, soruSayisi, type DersDurumu, type KonuHali } from "@/lib/ders-paneli";

export const HAL: Record<KonuHali, { ad: string; renk: string; aciklama: string }> = {
  bitti: { ad: "Bitti", renk: "var(--priority-low-text)", aciklama: "Hakimim dedin ya da bütün adımları yaptın" },
  planda: { ad: "Planda", renk: "var(--tag-school)", aciklama: "Sınava kadarki planda var" },
  basladin: { ad: "Başladın", renk: "var(--priority-medium-text)", aciklama: "Bir adımı yaptın ama planda yok" },
  dokunulmadi: { ad: "Çalışılmadı", renk: "var(--border-strong)", aciklama: "Hiç dokunmadın ve planda yok" },
};

const kisaKonu = (baslik: string) => baslik.replace(/^\s*\d+\s*[-.]\s*/, "");

export function DurumGrafigi({ durumlar, dersAdi, dilimAdi, onDers }: {
  durumlar: DersDurumu[];
  dersAdi: (kod: string) => string;
  dilimAdi: string;
  onDers: (kod: string) => void;
}) {
  const [acik, setAcik] = useState<string | null>(null);
  if (!durumlar.length) return null;

  const tum = durumlar.flatMap((d) => d.konular);
  const sayac = Object.fromEntries(KONU_HALI_SIRASI.map((h) => [h, tum.filter((k) => k.hal === h).length])) as Record<KonuHali, number>;
  const esikte = durumlar.filter((d) => d.esikte).length;
  const planlaEsikte = durumlar.filter((d) => d.planlaEsikte).length;
  const kalan = tum.length - sayac.bitti;

  return (
    <section className="cp-card p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={17} style={{ color: "var(--tag-school)" }} />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{dilimAdi}deki durumun</h2>
        </div>
        <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>{sayac.bitti}/{tum.length} konu bitti</span>
      </div>

      {/* Genel tablo: dört sayı ve bütün konuların tek çubuğu. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {KONU_HALI_SIRASI.map((h) => (
          <div key={h} className="rounded-xl px-3 py-2" style={{ background: "var(--surface-sunken)" }} title={HAL[h].aciklama}>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: HAL[h].renk }} />{HAL[h].ad}
            </span>
            <strong className="block text-[22px] leading-tight tabular-nums">{sayac[h]}</strong>
            <span className="block text-[10px]" style={{ color: "var(--text-tertiary)" }}>konu</span>
          </div>
        ))}
      </div>
      <div className="flex h-3 rounded-full overflow-hidden mt-3" style={{ background: "var(--surface-sunken)" }} aria-hidden>
        {KONU_HALI_SIRASI.map((h) => sayac[h] > 0 && (
          <span key={h} style={{ width: `${(sayac[h] / tum.length) * 100}%`, background: HAL[h].renk }} />
        ))}
      </div>
      <p className="text-[12px] mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {dilimAdi} kapsamında {tum.length} konu var; {kalan} tanesi bitmedi. Şu an {esikte} derste 12 doğru eşiğindesin.
        Plandaki konuları bitirirsen {planlaEsikte} ders eşiğe ulaşıyor.
        {sayac.basladin + sayac.dokunulmadi > 0 && ` Planda olmayan ${sayac.basladin + sayac.dokunulmadi} konu daha var; gün sayfasında her dersin altında duruyorlar.`}
      </p>

      {/* Ders ders: dilim genişliği = konunun soru değeri; çizgi = 12 doğru. */}
      <ul className="mt-3">
        {durumlar.map((d) => {
          const ac = acik === d.kod;
          return (
            <li key={d.kod} style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
              <button onClick={() => setAcik(ac ? null : d.kod)} aria-expanded={ac} className="w-full text-left py-3 min-h-14">
                <span className="flex items-baseline gap-2">
                  <ChevronRight size={13} className="shrink-0 transition-transform self-center" style={{ transform: ac ? "rotate(90deg)" : undefined, color: "var(--text-tertiary)" }} />
                  <span className="flex-1 min-w-0 text-[13px] font-medium truncate">{dersAdi(d.kod)}</span>
                  <span className="text-[11px] shrink-0 tabular-nums" style={{ color: "var(--text-tertiary)" }}>{d.sayac.bitti}/{d.konular.length} konu</span>
                </span>
                <span className="relative flex h-4 mt-2 rounded-md overflow-hidden" style={{ background: "var(--surface-sunken)" }}>
                  {d.konular.map((k) => (
                    <span
                      key={k.id}
                      title={`${kisaKonu(k.baslik)} · ${HAL[k.hal].ad}`}
                      style={{ width: `${d.toplam ? (k.soru / d.toplam) * 100 : 0}%`, background: HAL[k.hal].renk, borderRight: "1.5px solid var(--surface-raised)" }}
                    />
                  ))}
                  <span className="absolute -inset-y-0 w-0.5" style={{ left: `${d.esikYeri}%`, background: "var(--text-primary)" }} aria-hidden />
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {KONU_HALI_SIRASI.filter((h) => d.sayac[h] > 0).map((h) => <span key={h}>{HAL[h].ad} {d.sayac[h]}</span>)}
                  <span className="ml-auto" style={{ color: d.esikte ? "var(--priority-low-text)" : d.planlaEsikte ? "var(--tag-school-text)" : "var(--priority-high-text)" }}>
                    {d.esikte ? "eşikte ✓" : d.planlaEsikte ? "plan bitince eşikte" : `eşiğe ${soruSayisi(d.esige_kalan)}`}
                  </span>
                </span>
              </button>
              {ac && (
                <div className="pb-3 pl-5">
                  <ul className="space-y-1">
                    {d.konular.map((k) => (
                      <li key={k.id} className="flex items-start gap-2 text-[12px] leading-snug">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-[3px]" style={{ background: HAL[k.hal].renk }} />
                        <span className="flex-1 min-w-0">
                          {k.konu_no ? `${k.konu_no}. ` : ""}{kisaKonu(k.baslik)}
                          <span style={{ color: "var(--text-tertiary)" }}>
                            {" · "}{HAL[k.hal].ad}{k.planTarihi && ` (${format(parseISO(k.planTarihi), "d MMMM", { locale: tr })})`} · ~{soruSayisi(k.soru)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => onDers(d.kod)} className="cp-btn cp-btn-ghost min-h-9 mt-2 text-[11px]">Ders sayfasını aç<ChevronRight size={13} /></button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>
        Çubuktaki her parça bir konu; genişliği sınavda getirdiği tahmini soru kadar. Siyah çizgi 12 doğru.
      </p>
    </section>
  );
}
