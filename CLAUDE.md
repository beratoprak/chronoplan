# Epoche — çalışırken bilinmesi gerekenler

Next.js 14 + Supabase + Zustand + BlockNote ile yazılmış takvim/not uygulaması.
Canlı: `chronoplan-three.vercel.app` (main'e push → Vercel otomatik yayınlar).
Canlı sürümü doğrulamak: `curl https://chronoplan-three.vercel.app/api/version`.

**Bu repo herkese açık.** Kişisel bilgi, not içeriği, kullanıcı kimliği ya da anahtar
yazma — commit mesajına da. Projenin planı, kararları ve nerede kalındığı özel
`beratoprak/ybs-panel` reposunda: `DURUM.md`, `YAPILACAKLAR.md`, `PLAN-SISTEM.md`.
Oturumda o repo da varsa **iş yapmadan önce onları oku**, iş bitince `DURUM.md`'yi güncelle.

## Sağlık kontrolü

```bash
npx vitest run        # anahtar gerektirmez
npx tsc --noEmit
npm run build         # prebuild pdf.js işçisini public/'e kopyalar
```

`next build`'i dev sunucusu açıkken çalıştırma: `.next`'i ezip dev sunucusunu bozuyor.

## Okul (YBS) parçası — dosya haritası

| Dosya | Ne yapar |
|---|---|
| `src/components/views/SchoolView.tsx` | Okul sekmesi: Bu hafta, Çalışma, Bütün konular, Tekrar |
| `src/lib/school-data.ts` | Okul tablolarını okur (12 sn zaman aşımı + önbellek), ilerleme yazar |
| `src/lib/ilerleme.ts` | Konu checklist'i: Oku · İzle · Soru çöz · Hakimim → katsayı |
| `src/lib/study-plan.ts` | Ders eşik hesabı (20 soruda 12) ve günün önerileri |
| `src/lib/haftalik-plan.ts` | Haftalık planlayıcı (saf, teste bağlı) |
| `src/lib/haftalik-plan-kayit.ts` | Planı `ybs_haftalik_plan`'a ve takvime yazar |
| `src/lib/useHaftalikPlanlayici.ts` | Pazar 21:00 sonrası ilk açılışta planı kurar |
| `src/components/school/GunSayfasi.tsx` | Gün sayfası: plan etkinliğine tıklayınca o günün iki dersi tam ekran |
| `src/lib/gun-sayfasi.ts` | Gün sayfasının saf hesapları: soru sırası, tekrar günü konuları, materyal |
| `src/components/editor/` | Blok not editörü, okul blokları, "/" menüsü, PDF okuyucu |
| `supabase/migration-epoche-v*.sql` | Şema değişiklikleri (Supabase SQL Editor'de elle çalıştırılır) |

## Kurallar

- `ilerleme.ts` motordaki `ybs-panel/src/lib/ilerleme.js`'in ikizi. Birini değiştirirsen
  diğerini ve iki repodaki `ilerleme-vakalari.json` kopyalarını da değiştir.
- Plan etkinliğine tıklama `store.openEventModal`'da gün sayfasına yönlendiriliyor;
  düzenleme penceresi yalnız `{ duzenle: true }` ile açılır.
- Motorun yazdığı kayıtlar `is_managed = true`. Plan etkinlikleri `source = 'ybs-haftalik-plan'`,
  kimlik `ybs-plan-<tarih>`. Kullanıcının kendi kayıtlarının üzerine yazma.
- Eski tablolarda (`tasks`, `events`, `rich_notes`) zaman damgaları **metin** kolonu.
  Şema değiştiren SQL'i vermeden önce yerel bir PostgreSQL taklidinde dene.
- Bağımlılık değiştirince Vercel gibi doğrula: `rm -rf node_modules && npm install && npm run build`.
- Açıklamalar ve arayüz metinleri Türkçe. Kodda yorum dili Türkçe, "neden"i anlatır.
