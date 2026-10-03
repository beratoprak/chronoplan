"use client";

// Ayarlar → Figürlerim: köşede sallanan resimleri yükle, sil, gizle.

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { DEGISTI, EN_FAZLA, GORUNUR, figurEkle, figurSil, figurleriGetir, type Figur } from "@/lib/figurler";

export function Figurlerim() {
  const { user, isDemoMode } = useAppStore();
  const [liste, setListe] = useState<Figur[]>([]);
  const [gorunur, setGorunur] = useState(true);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);

  const tazele = () => {
    try { setGorunur(localStorage.getItem(GORUNUR) !== "kapali"); } catch { /* açık */ }
    if (user?.id && !isDemoMode) figurleriGetir(user.id).then(setListe).catch((e) => setHata(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(tazele, [user?.id, isDemoMode]);

  const gorunurDegistir = () => {
    const yeni = !gorunur;
    try { localStorage.setItem(GORUNUR, yeni ? "acik" : "kapali"); } catch { /* yalnız bu oturum */ }
    setGorunur(yeni);
    window.dispatchEvent(new Event(DEGISTI));
  };

  const ekle = async (dosyalar: FileList | null) => {
    if (!dosyalar?.length || !user?.id) return;
    setMesgul(true);
    setHata(null);
    try {
      let sira = liste.length;
      for (const d of Array.from(dosyalar).slice(0, Math.max(0, EN_FAZLA - liste.length))) await figurEkle(user.id, d, sira++);
      tazele();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setMesgul(false);
      if (girdi.current) girdi.current.value = "";
    }
  };

  const sil = async (id: string) => {
    if (!user?.id) return;
    await figurSil(user.id, id).catch((e) => setHata(e.message));
    tazele();
  };

  return (
    <div className="rounded-lg p-3" style={{ background: "var(--surface-base)", border: "0.5px solid var(--border-default)" }}>
      <div className="flex items-center gap-3">
        <p className="text-[13px] font-medium flex-1" style={{ color: "var(--text-primary)" }}>Köşede sallanan figürler</p>
        <button onClick={gorunurDegistir} className="cp-btn cp-btn-ghost text-[11px] px-2.5 py-1.5">{gorunur ? "Gizle" : "Göster"}</button>
      </div>
      <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
        En fazla {EN_FAZLA} resim. Yalnız senin hesabında durur. Resim eklemezsen hazır figürler (robot, uzaylı, ejderha) sallanır.
        Arka planı şeffaf PNG'ler en güzel durur.
      </p>
      {!isDemoMode && user && (
        <div className="flex flex-wrap gap-2 mt-3">
          {liste.map((f) => (
            <div key={f.id} className="relative w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-sunken)" }}>
              <img src={f.resim} alt={f.ad ?? "figür"} className="max-w-12 max-h-12 object-contain" />
              <button onClick={() => void sil(f.id)} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }} aria-label={`${f.ad ?? "Figürü"} sil`}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {liste.length < EN_FAZLA && (
            <button onClick={() => girdi.current?.click()} disabled={mesgul} className="w-14 h-14 rounded-lg flex items-center justify-center disabled:opacity-50" style={{ border: "1px dashed var(--border-strong)", color: "var(--text-tertiary)" }} aria-label="Resim ekle">
              {mesgul ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={18} />}
            </button>
          )}
          <input ref={girdi} type="file" accept="image/*" multiple hidden onChange={(e) => void ekle(e.target.files)} />
        </div>
      )}
      {hata && <p className="text-[10px] mt-2" role="alert" style={{ color: "var(--priority-high-text)" }}>{hata}</p>}
    </div>
  );
}
