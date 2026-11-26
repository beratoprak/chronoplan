# Epoche iOS

Epoche'nin iPhone uygulaması: web arayüzünü tam ekran saran ince bir kabuk ve yerel ana ekran widget'ı.
Arayüzün tamamı sitedir (`https://chronoplan-three.vercel.app`); sitede yapılan değişiklik uygulamaya
yeni sürüm gerekmeden yansır. Yayın (TestFlight / App Store) Osman'ın Apple geliştirici hesabından yapılır.

## Parçalar

- `Epoche/` — WKWebView kabuğu. Sitenin temasına uyan durum çubuğu, dış bağlantılar Safari'de.
  Sitedeki Supabase oturumundan (`sb-…-auth-token` → `user.id`) kullanıcı kimliğini alıp widget'a verir;
  uygulama arka plana geçince widget'ı tazeler.
- `EpocheWidget/` — WidgetKit widget'ı. Küçük/orta/büyük ana ekran (Scriptable widget'ının krem tasarımı)
  ve kilit ekranı. `GET /api/widget?token=<kullanıcı-id>` çeker, son iyi yanıtı saklar; internet yokken
  ondan çizer ("Çevrimdışı · tarih saat").
- `Ortak/` — iki hedefin paylaştığı site adresi ve anahtarlık erişimi
  (grup `2Y8L4BFX79.com.osmanevski.epoche.paylasim`).

Scriptable artık gerekmez; `scriptable/epoche-widget.js` uygulamayı kullanmayanlar için duruyor.

## Derleme

```bash
cd ios
xcodegen generate
open EpocheShell.xcodeproj
```

- Deneme sunucusuna (epoche.osmanevski.com) bağlanan kopya: `SWIFT_ACTIVE_COMPILATION_CONDITIONS='$(inherited) DENEME'`.
- TestFlight paketi: `tools/testflight/hazirla.sh` (sürüm numarasını önce `project.yml`'da artır).

## Siteye bağımlılıklar

Widget yalnız `/api/widget` yanıtının biçimine güvenir: `today`, `todayEvents`, `todayTasks`,
`upcoming` (`date`, `title`, `type`, `time`), `generatedAt`. Bu alanlar değişirse widget da güncellenmeli.
