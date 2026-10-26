"use client";

// Sınav taktikleri (Plan v4, 26 Ekim). Okul sekmesinde ve son düzlükte
// görünür. Yalnız kesin bilinen şeyler: sınav 20 soru / 30 dk, geçmek için
// 12 doğru. Yanlışın doğruyu götürüp götürmediği resmî kaynaktan
// doğrulanmadığı için kural olarak yazılmıyor, kontrol etmesi söyleniyor.

import { Target } from "lucide-react";

const TAKTIKLER: { baslik: string; metin: string }[] = [
  { baslik: "Önce çıkmış sorular", metin: "Aynı kalıplar tekrar gelir. Konuyu okumadan önce sorularına bak: neyin önemli olduğunu gösterir, okurken onu ararsın." },
  { baslik: "Kazanım cümlesi = soru kökü", metin: "\"…açıklayabilecek\", \"…sayabilecek\" diye biten her kazanımı bir soru gibi oku ve cevabını kendine söyle." },
  { baslik: "Kısa derslerden garanti al", metin: "Türk Dili, Atatürk ve İngilizce az emekle 12'yi geçer. Önce bunları sağlama al, zor derslere zaman kalır." },
  { baslik: "Hedef 12, mükemmel değil", metin: "Her konuyu bitirmek zorunda değilsin. Plan her dersi geçme çizgisine taşıyacak konuları seçiyor; bırakılanlara takılma." },
  { baslik: "Sınavda iki tur", metin: "20 soru, 30 dakika: soru başına bir buçuk dakika. İlk turda bildiklerini işaretle, takıldığında geç; ikinci turda kalanlara dön." },
  { baslik: "Şık ele", metin: "İki şıkka indirdiğin soruda tahmin çoğu zaman tutar. Yanlışın doğruyu götürüp götürmediğini giriş belgesinden kontrol et; götürmüyorsa hiçbir soruyu boş bırakma." },
  { baslik: "Son 4 gün yeni konu yok", metin: "Tekrar, çıkmış soru ve ezber kartı. Yeni konu açmak bildiğini de bulandırır." },
  { baslik: "Sınav günü", metin: "Kimlik ve giriş belgesi yanında olsun. Konya'ya erken çık; oturum aralarında sıradaki dersin özetine son kez bak." },
];

export function SinavTaktikleri({ acik = false, buyuk = false }: { acik?: boolean; buyuk?: boolean }) {
  return (
    <details open={acik} className="cp-card p-4 sm:p-5 group">
      <summary className="flex items-center gap-2 cursor-pointer list-none">
        <Target size={17} style={{ color: "var(--tag-school)" }} />
        <h2 className={`${buyuk ? "text-[17px] lg:text-[22px]" : "text-[15px]"} font-semibold flex-1`}>Sınav taktikleri</h2>
        <span className="text-[11px] group-open:hidden" style={{ color: "var(--text-tertiary)" }}>Aç</span>
      </summary>
      <ol className="mt-3 space-y-2.5">
        {TAKTIKLER.map((t, i) => (
          <li key={t.baslik} className={`flex gap-2 ${buyuk ? "text-[13px] lg:text-[15px]" : "text-[12px]"} leading-relaxed`}>
            <span className="font-semibold tabular-nums shrink-0" style={{ color: "var(--tag-school-text)" }}>{i + 1}.</span>
            <span><strong className="font-semibold">{t.baslik}.</strong> <span style={{ color: "var(--text-secondary)" }}>{t.metin}</span></span>
          </li>
        ))}
      </ol>
    </details>
  );
}
