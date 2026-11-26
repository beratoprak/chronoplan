import SwiftUI
import WidgetKit

// MARK: - Veri (GET /api/widget?token=<kullanıcı-id>)

struct WidgetVerisi: Codable {
    struct Etkinlik: Codable {
        let title: String
        let startTime: String?
        let endTime: String?
        let tagColor: String?
        let isAllDay: Bool?
    }
    struct Gorev: Codable {
        let title: String
        let priority: String?
    }
    struct Yaklasan: Codable {
        let date: String
        let title: String
        let type: String
        let time: String?
    }
    let generatedAt: String
    let today: String
    let todayEvents: [Etkinlik]
    let todayTasks: [Gorev]
    let upcoming: [Yaklasan]

    /// Önbellek dünden kaldıysa bugünü "yaklaşan" listesinden kur.
    func kaydir(bugun: String) -> WidgetVerisi {
        guard today != bugun else { return self }
        let bugunku = upcoming.filter { $0.date == bugun }
        return WidgetVerisi(
            generatedAt: generatedAt, today: bugun,
            todayEvents: bugunku.filter { $0.type == "event" }.map {
                Etkinlik(title: $0.title, startTime: $0.time, endTime: nil, tagColor: nil, isAllDay: $0.time == nil)
            },
            todayTasks: bugunku.filter { $0.type == "task" }.map { Gorev(title: $0.title, priority: nil) },
            upcoming: upcoming.filter { $0.date > bugun })
    }
}

struct Satir: Identifiable {
    let id = UUID()
    let renk: Color
    let alt: String
    let baslik: String
}

enum Durum {
    case tamam(WidgetVerisi, cevrimdisi: Bool)
    case girisYok      // kabukta henüz oturum açılmadı
    case baglantiYok   // ağ yok ve önbellek de yok
}

struct Kayit: TimelineEntry {
    let date: Date
    let durum: Durum
}

// MARK: - Zaman çizelgesi

struct Saglayici: TimelineProvider {
    func placeholder(in context: Context) -> Kayit { Kayit(date: .now, durum: .tamam(Ornek.veri, cevrimdisi: false)) }

    func getSnapshot(in context: Context, completion: @escaping (Kayit) -> Void) {
        if context.isPreview { return completion(placeholder(in: context)) }
        Task { completion(await kayit()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Kayit>) -> Void) {
        Task {
            let (simdi, veri, cevrimdisi) = await durum()
            var kayitlar = [simdi]
            // Tek çekişten sonraki iki günü de diz: telefon gece boyunca ağsız kalsa bile
            // sabah doğru gün görünür (bugünler "yaklaşan" listesinden kurulur).
            if let veri {
                let takvim = Calendar.current
                for ileri in 1...2 {
                    guard let gun = takvim.date(byAdding: .day, value: ileri, to: takvim.startOfDay(for: .now)) else { continue }
                    let o = veri.kaydir(bugun: Tarih.iso(gun))
                    kayitlar.append(Kayit(date: gun, durum: .tamam(o, cevrimdisi: cevrimdisi)))
                }
            }
            // Uygulama arka plana geçince ayrıca tazeler; bu yalnız sigorta.
            let dakika: Double = (cevrimdisi || veri == nil) ? 10 : 20
            completion(Timeline(entries: kayitlar, policy: .after(.now.addingTimeInterval(dakika * 60))))
        }
    }

    private func kayit() async -> Kayit { await durum().0 }

    /// Şu anki kayıt + ileriki günleri kurmak için kullanılan veri.
    private func durum() async -> (Kayit, WidgetVerisi?, Bool) {
        guard let kimlik = Ortak.kimlik, !kimlik.isEmpty else { return (Kayit(date: .now, durum: .girisYok), nil, false) }
        let bugun = Tarih.iso(.now)
        if let taze = await cek(kimlik: kimlik) {
            return (Kayit(date: .now, durum: .tamam(taze.kaydir(bugun: bugun), cevrimdisi: false)), taze, false)
        }
        if let eski = Onbellek.yukle(kimlik: kimlik) {
            return (Kayit(date: .now, durum: .tamam(eski.kaydir(bugun: bugun), cevrimdisi: true)), eski, true)
        }
        return (Kayit(date: .now, durum: .baglantiYok), nil, false)
    }

    /// Tek seferlik ağ aksaklığı eski veriyi göstermesin: bir kez daha dene (İkarus'taki gibi).
    private func cek(kimlik: String) async -> WidgetVerisi? {
        if let v = await tekCek(kimlik: kimlik) { return v }
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        return await tekCek(kimlik: kimlik)
    }

    private func tekCek(kimlik: String) async -> WidgetVerisi? {
        var bilesen = URLComponents(url: Ortak.site.appendingPathComponent("api/widget"), resolvingAgainstBaseURL: false)!
        bilesen.queryItems = [URLQueryItem(name: "token", value: kimlik)]
        var istek = URLRequest(url: bilesen.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        istek.setValue("application/json", forHTTPHeaderField: "Accept")
        guard let (veri, yanit) = try? await URLSession.shared.data(for: istek),
              (yanit as? HTTPURLResponse)?.statusCode == 200,
              let cozulen = try? JSONDecoder().decode(WidgetVerisi.self, from: veri) else { return nil }
        Onbellek.kaydet(veri, kimlik: kimlik)
        return cozulen
    }
}

/// Son iyi yanıt widget'ın kendi kabında (başka yere gitmez). Kimlikle eşlenir:
/// hesap değişirse ya da çıkış yapılırsa eski kişinin programı gösterilmez.
enum Onbellek {
    static let anahtar = "son-yanit"
    static func yukle(kimlik: String) -> WidgetVerisi? {
        let d = UserDefaults.standard
        guard d.string(forKey: anahtar + ".kimlik") == kimlik, let veri = d.data(forKey: anahtar) else { return nil }
        return try? JSONDecoder().decode(WidgetVerisi.self, from: veri)
    }
    static func kaydet(_ veri: Data, kimlik: String) {
        UserDefaults.standard.set(veri, forKey: anahtar)
        UserDefaults.standard.set(kimlik, forKey: anahtar + ".kimlik")
    }
}

// MARK: - Tasarım (Cream paleti, Scriptable widget'ıyla aynı dil)

enum Renk {
    static func hex(_ h: UInt32, _ a: Double = 1) -> Color {
        Color(red: Double((h >> 16) & 0xFF) / 255, green: Double((h >> 8) & 0xFF) / 255,
              blue: Double(h & 0xFF) / 255, opacity: a)
    }
    static let zemin = hex(0xF3EDE0)
    static let espresso = hex(0x3B2A20)
    static let metin2 = hex(0x6B5B3E)
    static let soluk = hex(0x3B2A20, 0.4)
    static let altin = hex(0xA0825C)
    static let etiket: [String: Color] = [
        "work": hex(0xD14342), "personal": hex(0x178A65), "project": hex(0x6C63CF), "meeting": hex(0xA86A15),
    ]
    static let oncelik: [String: Color] = [
        "urgent": hex(0xD14342), "high": hex(0xC24E27), "medium": hex(0xA86A15), "low": hex(0x178A65),
    ]
}

enum Tarih {
    static let aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    static let gunler = ["PAZAR", "PAZARTESİ", "SALI", "ÇARŞAMBA", "PERŞEMBE", "CUMA", "CUMARTESİ"]
    static let takvim = Calendar(identifier: .gregorian)

    static func iso(_ d: Date) -> String {
        let c = takvim.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
    static func gunAy(_ iso: String) -> String {
        let p = iso.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return iso }
        return "\(p[2]) \(aylar[p[1] - 1])"
    }
    static func gunAdi(_ d: Date) -> String { gunler[takvim.component(.weekday, from: d) - 1] }
    static func ay(_ d: Date) -> String { aylar[takvim.component(.month, from: d) - 1] }
    static func gun(_ d: Date) -> String { String(takvim.component(.day, from: d)) }
}

extension WidgetVerisi {
    var satirlar: [Satir] {
        todayEvents.map { e in
            let alt: String
            if e.isAllDay == true || e.startTime == nil { alt = "Tüm gün" }
            else if let bitis = e.endTime { alt = "\(e.startTime!) – \(bitis)" }
            else { alt = e.startTime! }
            return Satir(renk: Renk.etiket[e.tagColor ?? ""] ?? Renk.altin, alt: alt, baslik: e.title)
        } + todayTasks.map { Satir(renk: Renk.oncelik[$0.priority ?? ""] ?? Renk.altin, alt: "Görev", baslik: $0.title) }
    }

    var cevrimdisiNotu: String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let d = f.date(from: generatedAt) ?? ISO8601DateFormatter().date(from: generatedAt) else { return "Çevrimdışı" }
        let c = Tarih.takvim.dateComponents([.day, .month, .hour, .minute], from: d)
        return String(format: "Çevrimdışı · %d %@ %02d:%02d", c.day!, Tarih.aylar[c.month! - 1], c.hour!, c.minute!)
    }
}

struct SatirGorunumu: View {
    let satir: Satir
    let buyuk: Bool
    var body: some View {
        HStack(spacing: 7) {
            RoundedRectangle(cornerRadius: 1.5).fill(satir.renk).frame(width: 3, height: buyuk ? 30 : 26)
            VStack(alignment: .leading, spacing: 0) {
                Text(satir.baslik).font(.system(size: buyuk ? 15 : 13, weight: .semibold))
                    .foregroundStyle(Renk.espresso).lineLimit(1)
                Text(satir.alt).font(.system(size: buyuk ? 13 : 11)).foregroundStyle(Renk.metin2).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }
}

struct EpocheWidgetGorunumu: View {
    @Environment(\.widgetFamily) var boyut
    let kayit: Kayit

    var body: some View {
        Group {
            switch boyut {
            case .accessoryRectangular: kilitDikdortgen
            case .accessoryInline: kilitSatir
            case .accessoryCircular: kilitYuvarlak
            case .systemSmall: kucuk
            case .systemLarge, .systemExtraLarge: buyuk
            default: orta
            }
        }
        .containerBackground(for: .widget) {
            if boyut.kilitEkrani { Color.clear } else { Renk.zemin }
        }
        .widgetURL(Ortak.site)
    }

    // MARK: Kilit ekranı (sistem rengiyle; palet ana ekranda)

    /// Sıradaki ya da şu anki ilk kayıt.
    private var ilk: Satir? { satirlar.first }

    private var kilitDikdortgen: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(Tarih.gunAdi(kayit.date).capitalized(with: Locale(identifier: "tr"))) \(Tarih.gun(kayit.date))")
                .font(.system(size: 13, weight: .semibold)).widgetAccentable()
            if satirlar.isEmpty {
                Text(kayit.durumKisa ?? "Bugün plan yok").font(.system(size: 13)).lineLimit(2)
            } else {
                ForEach(satirlar.prefix(2)) { s in
                    Text("\(s.alt == "Görev" ? "◦" : s.alt.components(separatedBy: " ").first ?? "") \(s.baslik)")
                        .font(.system(size: 13)).lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var kilitSatir: some View {
        if let ilk { Text("\(ilk.alt == "Görev" ? "" : ilk.alt.components(separatedBy: " ").first.map { $0 + " " } ?? "")\(ilk.baslik)") }
        else { Text(kayit.durumKisa ?? "Bugün plan yok") }
    }

    private var kilitYuvarlak: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: -2) {
                Image(systemName: "calendar").font(.system(size: 12, weight: .semibold))
                Text("\(satirlar.count)").font(.system(size: 20, weight: .bold)).widgetAccentable()
            }
        }
        .accessibilityLabel("Bugün \(satirlar.count) kayıt")
    }

    private var veri: WidgetVerisi? { if case .tamam(let v, _) = kayit.durum { v } else { nil } }
    private var satirlar: [Satir] { veri?.satirlar ?? [] }

    private var bosMetin: String {
        switch kayit.durum {
        case .girisYok: "Epoche'yi açıp giriş yap"
        case .baglantiYok: "Bağlantı yok"
        case .tamam: "Bugün plan yok ✨"
        }
    }

    @ViewBuilder private var not: some View {
        if case .tamam(let v, true) = kayit.durum {
            Text(v.cevrimdisiNotu).font(.system(size: 10)).foregroundStyle(Renk.soluk)
        }
    }

    private var marka: some View {
        Text("Epoche").font(.custom("Georgia-Bold", size: 14)).foregroundStyle(Renk.altin)
    }

    // Orta: sol büyük gün/tarih, sağ liste
    private var orta: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 0) {
                Text(Tarih.gunAdi(kayit.date)).font(.system(size: 13, weight: .bold)).foregroundStyle(Renk.altin)
                Text(Tarih.gun(kayit.date)).font(.system(size: 44, weight: .bold)).foregroundStyle(Renk.espresso)
                Text(Tarih.ay(kayit.date)).font(.system(size: 14, weight: .medium)).foregroundStyle(Renk.metin2)
                Spacer(minLength: 0)
                marka
            }
            VStack(alignment: .leading, spacing: 6) {
                if satirlar.isEmpty {
                    Text(bosMetin).font(.system(size: 15, weight: .medium)).foregroundStyle(Renk.metin2)
                        .padding(.top, 8)
                    if let sonraki = veri?.upcoming.first {
                        Text("Sıradaki: \(Tarih.gunAy(sonraki.date)) — \(sonraki.title)")
                            .font(.system(size: 12)).foregroundStyle(Renk.soluk).lineLimit(2)
                    }
                } else {
                    ForEach(satirlar.prefix(3)) { SatirGorunumu(satir: $0, buyuk: true) }
                    if satirlar.count > 3 {
                        Text("+\(satirlar.count - 3) tane daha").font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Renk.soluk)
                    }
                }
                Spacer(minLength: 0)
                not
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var kucuk: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(Tarih.gunAdi(kayit.date)).font(.system(size: 11, weight: .bold)).foregroundStyle(Renk.altin)
            Text(Tarih.gun(kayit.date)).font(.system(size: 34, weight: .bold)).foregroundStyle(Renk.espresso)
                .padding(.bottom, 6)
            if satirlar.isEmpty {
                Text(kayit.durumKisa ?? "Plan yok ✨").font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Renk.metin2)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(satirlar.prefix(2)) { SatirGorunumu(satir: $0, buyuk: false) }
                    if satirlar.count > 2 {
                        Text("+\(satirlar.count - 2)").font(.system(size: 11, weight: .medium)).foregroundStyle(Renk.soluk)
                    }
                }
            }
            Spacer(minLength: 0)
            not
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var buyuk: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .bottom, spacing: 10) {
                Text(Tarih.gun(kayit.date)).font(.system(size: 40, weight: .bold)).foregroundStyle(Renk.espresso)
                VStack(alignment: .leading, spacing: 0) {
                    Text(Tarih.gunAdi(kayit.date)).font(.system(size: 14, weight: .bold)).foregroundStyle(Renk.altin)
                    Text("\(Tarih.ay(kayit.date)) \(String(Tarih.takvim.component(.year, from: kayit.date)))")
                        .font(.system(size: 13, weight: .medium)).foregroundStyle(Renk.metin2)
                }
                Spacer()
                Text("Epoche").font(.custom("Georgia-Bold", size: 16)).foregroundStyle(Renk.altin)
            }
            .padding(.bottom, 12)

            VStack(alignment: .leading, spacing: 7) {
                if satirlar.isEmpty {
                    Text(bosMetin).font(.system(size: 15, weight: .medium)).foregroundStyle(Renk.metin2)
                } else {
                    ForEach(satirlar.prefix(8)) { SatirGorunumu(satir: $0, buyuk: true) }
                }
            }

            let yaklasan = Array((veri?.upcoming ?? []).prefix(max(0, 8 - satirlar.count)))
            if !yaklasan.isEmpty {
                Text("YAKLAŞAN").font(.system(size: 11, weight: .bold)).foregroundStyle(Renk.soluk)
                    .padding(.top, 10).padding(.bottom, 5)
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(Array(yaklasan.enumerated()), id: \.offset) { _, u in
                        SatirGorunumu(satir: Satir(renk: Renk.altin, alt: Tarih.gunAy(u.date), baslik: u.title), buyuk: false)
                    }
                }
            }
            Spacer(minLength: 0)
            not
        }
    }
}

private extension WidgetFamily {
    var kilitEkrani: Bool { [.accessoryRectangular, .accessoryInline, .accessoryCircular].contains(self) }
}

private extension Kayit {
    var durumKisa: String? {
        switch durum {
        case .girisYok: "Giriş yap"
        case .baglantiYok: "Bağlantı yok"
        case .tamam: nil
        }
    }
}

// MARK: - Widget

@main
struct EpocheWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Ortak.widgetTuru, provider: Saglayici()) { EpocheWidgetGorunumu(kayit: $0) }
            .configurationDisplayName("Epoche")
            .description("Bugünün programı ve görevleri; internet yokken son kayıt.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

enum Ornek {
    static let veri = WidgetVerisi(
        generatedAt: "2026-11-26T08:00:00.000Z", today: Tarih.iso(.now),
        todayEvents: [
            .init(title: "Sinyaller ve Sistemler", startTime: "10:00", endTime: "11:50", tagColor: "work", isAllDay: false),
            .init(title: "Bera ile toplantı", startTime: "14:00", endTime: nil, tagColor: "meeting", isAllDay: false),
        ],
        todayTasks: [.init(title: "Ödev 3", priority: "high")],
        upcoming: [.init(date: Tarih.iso(.now.addingTimeInterval(86_400)), title: "Vize", type: "event", time: "09:00")])
}

#Preview(as: .systemMedium) {
    EpocheWidget()
} timeline: {
    Kayit(date: .now, durum: .tamam(Ornek.veri, cevrimdisi: true))
}
