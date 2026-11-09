"use client";

// Okul → Sınav programı (Plan v3, Faz H).
//
// Sınav giriş belgesi çıkınca bütün dersler tek yerde girilir: hangi gün,
// kaçıncı oturum. Girildikten sonra aynı yerde gün ve oturuma göre toplu
// görünür; planlayıcı da tekrar günlerini buna göre dizer.
//
// Giriş belgesi (9 Kasım): PDF seçilince metni cihazda pdf.js ile okunur,
// form doldurulur, kullanıcı bakıp Kaydet'e basar. Dosya hiçbir yere
// gönderilmez, saklanmaz (belgede T.C. kimlik no var).

import { useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarCheck, FileUp, Loader2, Pencil } from "lucide-react";
import { sinavProgramiKaydet, type SchoolCourse, type SinavOturumu } from "@/lib/school-data";
import { girisBelgesiCoz, oturumGruplari } from "@/lib/sinav-programi";
import { pdfMetni } from "@/lib/pdf-metni";


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
  const [bilgi, setBilgi] = useState<string | null>(null);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);
  const ad = (kod: string) => dersler.find((d) => d.kod === kod)?.ad ?? kod;
  const gunAdi = (tarih: string) => format(parseISO(tarih), "d MMMM EEEE", { locale: tr });
  const sinavAdi = sinav.dilim === "final" ? "Final" : "Ara sınav";

  const ac = () => {
    setTaslak(Object.fromEntries(dersler.map((d) => {
      const o = bu.find((x) => x.ders_kodu === d.kod);
      return [d.kod, { tarih: o?.tarih ?? gunler[0], oturum: o?.oturum ?? "" }];
    })));
    setHata(null);
    setBilgi(null);
    setDuzenle(true);
  };

  const belgeYukle = async (dosya: File | undefined) => {
    if (!dosya) return;
    setMesgul(true);
    setHata(null);
    setBilgi(null);
    try {
      const { satirlar, bilinmeyen } = girisBelgesiCoz(await pdfMetni(dosya), dersler.map((d) => d.kod));
      const uygun = satirlar.filter((x) => gunler.includes(x.tarih));
      if (!uygun.length) {
        setHata(satirlar.length
          ? `Belgedeki tarihler (${Array.from(new Set(satirlar.map((x) => gunAdi(x.tarih)))).join(", ")}) bu sınavın günleriyle uyuşmuyor. Doğru belgeyi seçtiğinden emin ol.`
          : "Bu PDF'te sınav oturumu bulamadım. OBS'den indirdiğin sınava giriş belgesini seç.");
        return;
      }
      const yeni = Object.fromEntries(dersler.map((d) => {
        const o = uygun.find((x) => x.ders_kodu === d.kod) ?? bu.find((x) => x.ders_kodu === d.kod);
        return [d.kod, { tarih: o?.tarih ?? gunler[0], oturum: o?.oturum ?? "" }];
      })) as typeof taslak;
      setTaslak(yeni);
      setDuzenle(true);
      const eksik = dersler.filter((d) => !uygun.some((x) => x.ders_kodu === d.kod)).map((d) => d.ad);
      setBilgi(`Belgeden ${uygun.length} ders okundu. Bir bak, doğruysa Kaydet'e bas.`
        + (eksik.length ? ` Belgede bulunmayan: ${eksik.join(", ")}.` : "")
        + (bilinmeyen.length ? ` Ders listende olmayan kodlar atlandı: ${bilinmeyen.join(", ")}.` : ""));
    } catch (e) {
      // Ayrıntı küçük yazıyla: bir dahaki hatada nedeni ekran görüntüsünden okunabilsin.
      setHata(`PDF okunamadı; elle doldurabilirsin. (${e instanceof Error ? e.message : String(e)})`);
    } finally {
      setMesgul(false);
      if (dosyaGirdisi.current) dosyaGirdisi.current.value = "";
    }
  };

  const belgeDugmesi = userId && (
    <>
      <input ref={dosyaGirdisi} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void belgeYukle(e.target.files?.[0])} />
      <button onClick={() => dosyaGirdisi.current?.click()} disabled={mesgul} className="cp-btn cp-btn-ghost min-h-11 text-[12px] disabled:opacity-50">
        {mesgul ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}Giriş belgesini yükle (PDF)
      </button>
    </>
  );

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
        <>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Sınav giriş belgen çıkınca derslerin gününü ve oturumunu buraya gir: OBS'den indirdiğin PDF'i
            yükle, ya da "Gir"e basıp elle doldur. Plan son günlerin tekrarını buna göre dizer.
          </p>
          <div className="mt-2">{belgeDugmesi}</div>
          {hata && <p className="text-[11px] mt-2" role="alert" style={{ color: "var(--priority-high-text)" }}>{hata}</p>}
        </>
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
          <div className="mb-2">{belgeDugmesi}</div>
          {bilgi && <p className="text-[11px] mb-2 leading-relaxed" role="status" style={{ color: "var(--text-secondary)" }}>{bilgi}</p>}
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
