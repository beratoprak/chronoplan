import Foundation
import Security

/// Uygulama ile widget'ın paylaştığı tek kaynak: site adresi ve kullanıcı kimliği.
/// İkarus'la aynı kalıp (26 Kas 2026): kimlik paylaşılan anahtarlık grubunda, App Group yok.
enum Ortak {
    /// Kabuğun açtığı ve widget'ın veri çektiği Epoche yayını: Bera'nın Vercel'i (asıl ürün).
    /// Osman'ın deneme sunucusu (epoche.osmanevski.com, ayrı Supabase) yalnız
    /// `xcodebuild ... SWIFT_ACTIVE_COMPILATION_CONDITIONS='$(inherited) DENEME'` ile derlenen kopyada.
    #if DENEME
    static let site = URL(string: "https://epoche.osmanevski.com/")!
    #else
    static let site = URL(string: "https://chronoplan-three.vercel.app/")!
    #endif
    static let widgetTuru = "EpocheWidget"

    /// Sitedeki Supabase oturumunun kullanıcı kimliği; /api/widget?token= bu.
    static var kimlik: String? {
        get { Anahtarlik.oku("kullanici-kimligi") }
        set { Anahtarlik.yaz("kullanici-kimligi", newValue) }
    }
}

/// Kimlik yalnız anahtarlıkta durur; widget aynı gruptan okur.
/// Grup iki hedefin `keychain-access-groups` yetkisinde aynı (project.yml).
enum Anahtarlik {
    static let servis = "com.osmanevski.epoche"
    static let grup = "2Y8L4BFX79.com.osmanevski.epoche.paylasim"

    static func oku(_ hesap: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                kSecAttrService as String: servis,
                                kSecAttrAccount as String: hesap,
                                kSecReturnData as String: true,
                                kSecMatchLimit as String: kSecMatchLimitOne]
        var cikti: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &cikti) == errSecSuccess,
              let veri = cikti as? Data else { return nil }
        return String(data: veri, encoding: .utf8)
    }

    @discardableResult
    static func yaz(_ hesap: String, _ deger: String?) -> Bool {
        let taban: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: servis,
                                    kSecAttrAccount as String: hesap]
        SecItemDelete(taban as CFDictionary)
        guard let deger, !deger.isEmpty else { return true }
        var ekle = taban
        ekle[kSecValueData as String] = Data(deger.utf8)
        // Widget kilitli ekranda da okuyabilsin.
        ekle[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ekle[kSecAttrAccessGroup as String] = grup
        if SecItemAdd(ekle as CFDictionary, nil) == errSecSuccess { return true }
        // Paylaşım yetkisi olmayan derleme: uygulamanın kendi grubuna yaz (widget göremez).
        ekle.removeValue(forKey: kSecAttrAccessGroup as String)
        return SecItemAdd(ekle as CFDictionary, nil) == errSecSuccess
    }
}
