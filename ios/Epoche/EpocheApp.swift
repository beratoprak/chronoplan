import SwiftUI
import WidgetKit

@main
struct EpocheApp: App {
    @StateObject private var tema = Tema()
    @Environment(\.scenePhase) private var evre

    var body: some Scene {
        WindowGroup {
            WebShell(tema: tema)
                // Üstte durum çubuğunun altında kalır (sitenin üst çubuğu safe-area
                // boşluğu bırakmıyor); altta site env(safe-area-inset-bottom) kullanıyor.
                .ignoresSafeArea(edges: .bottom)
                .background(tema.ust.ignoresSafeArea())
                .preferredColorScheme(tema.koyu ? .dark : .light)
                // Uygulamada eklenen/değişen kayıt widget'a hemen yansısın (İkarus'taki gibi).
                .onChange(of: evre) { _, yeni in
                    if yeni == .background { WidgetCenter.shared.reloadTimelines(ofKind: Ortak.widgetTuru) }
                }
        }
    }
}

/// Sitenin seçili teması (<html data-theme>). Durum çubuğu ve kenar rengi ona uyar;
/// telefonun sistem temasına değil, Epoche'nin kendi Ayarlar > Tema seçimine bakılır.
final class Tema: ObservableObject {
    @Published var koyu = UITraitCollection.current.userInterfaceStyle == .dark

    // globals.css: --surface-raised (üst çubuk) ve --surface-base
    var ust: Color { koyu ? Color(red: 0x1C/255, green: 0x1C/255, blue: 0x1E/255)
                          : Color(red: 0xFD/255, green: 0xFB/255, blue: 0xF7/255) }
    var zemin: UIColor { koyu ? .black : UIColor(red: 0xF5/255, green: 0xF0/255, blue: 0xE8/255, alpha: 1) }
}
