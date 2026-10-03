"use client";

// Okul → Sınav programı (Plan v3, Faz H).
//
// Sınav giriş belgesi çıkınca bütün dersler tek yerde girilir: hangi gün,
// kaçıncı oturum. Girildikten sonra aynı yerde gün ve oturuma göre toplu
// görünür; planlayıcı da tekrar günlerini buna göre dizer.

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarCheck, Loader2, Pencil } from "lucide-react";
import { sinavProgramiKaydet, type SchoolCourse, type SinavOturumu } from "@/lib/school-data";
import { oturumGruplari } from "@/lib/sinav-programi";

const OTURUMLAR = [1, 2, 3, 4];

export function SinavProgrami({ sinav, dersler, oturumlar, userId, onKaydedildi }: {
  sinav: { tarih: string; dilim: "vize" | "final" };
  dersler: SchoolCourse[];
  oturumlar: SinavOturumu[];
  userId: string | null;
  onKaydedildi: () => void;
}) {
  const bu = useMemo(() => oturumlar.filter((o) => o.dilim === sinav.dilim), [oturumlar, sinav.dilim]);
  const gunler = useMemo(() => [sinav.tarih, format(addDays(parseISO(sinav.tarih), 1), "yyyy-MM-dd")], [sinav.tarih]);
  const [duzenle, setDuzenle] = useState(false);
  const [taslak, setTaslak] = useState<Record<string, { tarih: string; oturum: number | "" }>>({});
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const ad = (kod: string) => dersler.find((d) => d.kod === kod)?.ad ?? kod;
  const gunAdi = (tarih: string) => format(parseISO(tarih), "d MMMM EEEE", { locale: tr });
  const sinavAdi = sinav.dilim === "final" ? "Final" : "Ara sınav";

  const ac = () => {
    setTaslak(Object.fromEntries(dersler.map((d) => {
      const o = bu.find((x) => x.ders_kodu === d.kod);
      return [d.kod, { tarih: o?.tarih ?? gunler[0], oturum: o?.oturum ?? "" }];
    })));
    setHata(null);
    setDuzenle(true);
  };

  const kaydet = async () => {
    if (!userId) return;
    setMesgul(true);
    setHata(null);
    try {
      const satirlar = Object.entries(taslak)
        .filter(([, v]) => v.oturum !== "")
        .map(([ders_kodu, v]) => ({ ders_kodu, tarih: v.tarih, oturum: Number(v.oturum) }));
      await sinavProgramiKaydet(userId, sinav.dilim, satirlar);
      setDuzenle(false);
      onKaydedildi();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setMesgul(false);
    }
  };

  return (
    <section className="cp-card p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarCheck size={17} style={{ color: "var(--tag-school)" }} />
          <h2 className="text-[15px] font-semibold">Sınav programı</h2>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{sinavAdi} · Konya</span>
        </div>
        {!duzenle && userId && (
          <button onClick={ac} className="cp-btn cp-btn-ghost text-[11px] shrink-0">
            <Pencil size={13} />{bu.length ? "Düzenle" : "Gir"}
          </button>
        )}
      </div>

      {!duzenle && !bu.length && (
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Sınav giriş belgen çıkınca derslerin gününü ve oturumunu buraya topluca gir. Plan son günlerin
          tekrarını buna göre dizer; sınav günü hangi oturumda ne olduğunu burada ve gün sayfasında görürsün.
        </p>
      )}

      {!duzenle && bu.length > 0 && (
        <div className="space-y-3">
          {oturumGruplari(bu).map(([tarih, gruplar]) => (
            <div key={tarih}>
              <p className="text-[12px] font-semibold mb-1">{gunAdi(tarih)}</p>
              <ul className="space-y-1">
                {gruplar.map(([oturum, kodlar]) => (
                  <li key={oturum} className="rounded-xl px-3 py-2 text-[12px] flex gap-3" style={{ background: "var(--surface-sunken)" }}>
                    <span className="w-16 shrink-0 font-semibold" style={{ color: "var(--tag-school-text)" }}>{oturum}. oturum</span>
                    <span className="min-w-0">{kodlar.map(ad).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {bu.length < dersler.length && (
            <p className="text-[11px]" style={{ color: "var(--priority-medium-text)" }}>
              {dersler.length - bu.length} dersin oturumu girilmedi: {dersler.filter((d) => !bu.some((o) => o.ders_kodu === d.kod)).map((d) => d.ad).join(", ")}
            </p>
          )}
        </div>
      )}

      {duzenle && (
        <div>
          <ul className="space-y-1.5">
            {dersler.map((d) => {
              const v = taslak[d.kod] ?? { tarih: gunler[0], oturum: "" as const };
              const degistir = (yeni: Partial<typeof v>) => setTaslak((t) => ({ ...t, [d.kod]: { ...v, ...yeni } }));
              return (
                <li key={d.kod} className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface-sunken)" }}>
                  <span className="text-[12px] font-medium flex-1 min-w-[140px]">{d.ad}</span>
                  <select
                    value={v.tarih}
                    onChange={(e) => degistir({ tarih: e.target.value })}
                    className="min-h-11 rounded-lg px-2 text-[12px]"
                    style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}
                    aria-label={`${d.ad} sınav günü`}
                  >
                    {gunler.map((g) => <option key={g} value={g}>{format(parseISO(g), "d MMM EEE", { locale: tr })}</option>)}
                  </select>
                  <select
                    value={v.oturum}
                    onChange={(e) => degistir({ oturum: e.target.value ? Number(e.target.value) : "" })}
                    className="min-h-11 rounded-lg px-2 text-[12px]"
                    style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}
                    aria-label={`${d.ad} oturum`}
                  >
                    <option value="">Oturum?</option>
                    {OTURUMLAR.map((o) => <option key={o} value={o}>{o}. oturum</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
          {hata && <p className="text-[11px] mt-2" role="alert" style={{ color: "var(--priority-high-text)" }}>{hata}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => void kaydet()} disabled={mesgul} className="cp-btn cp-btn-primary min-h-11 text-[12px] disabled:opacity-50">
              {mesgul && <Loader2 size={13} className="animate-spin" />}Kaydet
            </button>
            <button onClick={() => setDuzenle(false)} className="cp-btn cp-btn-ghost min-h-11 text-[12px]">Vazgeç</button>
          </div>
        </div>
      )}
    </section>
  );
}
