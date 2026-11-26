import SwiftUI
import WebKit
import WidgetKit

/// Epoche web arayüzünü tam ekran saran ince kabuk (AlmilaShell'in kardeşi).
/// localStorage ve oturum kalıcı varsayılan veri deposunda tutulur;
/// Epoche dışındaki bağlantılar Safari'de açılır.
let home = Ortak.site

/// <html data-theme> değiştikçe kabuğa haber verir.
private let temaBetigi = """
(function () {
  var r = document.documentElement;
  var s = function () { try { window.webkit.messageHandlers.tema.postMessage(r.getAttribute('data-theme') || ''); } catch (e) {} };
  new MutationObserver(s).observe(r, { attributes: true, attributeFilter: ['data-theme'] });
  s();
})();
"""

/// Supabase oturumunun kullanıcı kimliğini (sb-…-auth-token) widget için kabuğa verir.
/// Giriş/çıkış aynı pencerede `storage` olayı üretmediği için birkaç saniyede bir bakılır.
private let kimlikBetigi = """
(function () {
  var son = null;
  var bak = function () {
    var id = '';
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^sb-.+-auth-token$/.test(k)) continue;
        var v = JSON.parse(localStorage.getItem(k) || 'null');
        var u = v && (v.user || (v.currentSession && v.currentSession.user));
        if (u && u.id) { id = u.id; break; }
      }
    } catch (e) {}
    if (id !== son) { son = id; try { window.webkit.messageHandlers.kimlik.postMessage(id); } catch (e) {} }
  };
  bak();
  setInterval(bak, 4000);
})();
"""

struct WebShell: UIViewRepresentable {
    @ObservedObject var tema: Tema

    func makeCoordinator() -> Coordinator { Coordinator(tema: tema) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = "EpocheShell/0.1"
        config.userContentController.addUserScript(
            WKUserScript(source: temaBetigi, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "tema")
        config.userContentController.addUserScript(
            WKUserScript(source: kimlikBetigi, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "kimlik")

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = tema.zemin
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never

        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor(red: 0x8A/255, green: 0x6B/255, blue: 0x43/255, alpha: 1)
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.reload(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh

        context.coordinator.web = web
        web.load(URLRequest(url: home))
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        web.backgroundColor = tema.zemin
        web.scrollView.backgroundColor = tema.zemin
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        weak var web: WKWebView?
        let tema: Tema
        init(tema: Tema) { self.tema = tema }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let deger = message.body as? String else { return }
            if message.name == "kimlik" { return kimlikGeldi(deger) }
            let koyu = deger == "dark"
                || (deger != "light" && UITraitCollection.current.userInterfaceStyle == .dark)
            if tema.koyu != koyu { tema.koyu = koyu }
        }

        /// Oturum açıldı, kapandı ya da hesap değişti: widget'a yaz ve yenilet.
        /// Boş kimlik yalnız sitede gerçekten oturum yoksa gelir. Widget'ın önbelleği kimlikle
        /// eşlendiği için eski kişinin programı ayrıca silinmeden gösterilmez.
        private func kimlikGeldi(_ id: String) {
            guard web?.url?.host == home.host else { return }
            let yeni = id.isEmpty ? nil : id
            guard Ortak.kimlik != yeni else { return }
            Ortak.kimlik = yeni
            WidgetCenter.shared.reloadTimelines(ofKind: Ortak.widgetTuru)
        }

        @objc func reload(_ sender: UIRefreshControl) {
            web?.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            let html = """
            <meta name=viewport content="width=device-width,initial-scale=1">
            <body style="background:#F5F0E8;color:#2C2518;font:17px -apple-system;display:grid;place-items:center;height:90vh;text-align:center">
            <div><p>Epoche'ye ulaşılamadı.</p><p style="opacity:.6;font-size:14px">\(error.localizedDescription)</p>
            <p style="opacity:.6;font-size:14px">Yenilemek için aşağı çek.</p></div></body>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }

        // Epoche dışındaki bağlantılar (mail, harici siteler) Safari'de açılır.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.allow) }
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "about" || scheme == "blob" || scheme == "data" { return decisionHandler(.allow) }
            if (scheme == "https" || scheme == "http"), url.host == home.host { return decisionHandler(.allow) }
            if action.targetFrame?.isMainFrame == false { return decisionHandler(.allow) }  // gömülü çerçeveler
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }

        // target=_blank: aynı görünümde aç (Epoche içiyse) ya da Safari'ye ver.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url {
                if url.host == home.host { webView.load(action.request) } else { UIApplication.shared.open(url) }
            }
            return nil
        }

        // Sunucu kapısı (Caddy basic_auth): şifre bir kez sorulur, iOS Anahtarlık'ında
        // kalıcı saklanır. Yanlışsa ya da değiştiyse yeniden sorar.
        func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge,
                     completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
            let space = challenge.protectionSpace
            guard space.authenticationMethod == NSURLAuthenticationMethodHTTPBasic, space.host == home.host else {
                return completionHandler(.performDefaultHandling, nil)
            }
            let depo = URLCredentialStorage.shared
            if challenge.previousFailureCount == 0, let kayitli = depo.defaultCredential(for: space) {
                return completionHandler(.useCredential, kayitli)
            }
            if challenge.previousFailureCount > 0, let eski = depo.defaultCredential(for: space) {
                depo.remove(eski, for: space)
            }
            sifreSor(hatali: challenge.previousFailureCount > 0) { kullanici, sifre in
                guard let kullanici, let sifre else { return completionHandler(.cancelAuthenticationChallenge, nil) }
                let kimlik = URLCredential(user: kullanici, password: sifre, persistence: .permanent)
                depo.setDefaultCredential(kimlik, for: space)
                completionHandler(.useCredential, kimlik)
            }
        }

        private func sifreSor(hatali: Bool, tamam: @escaping (String?, String?) -> Void) {
            let alert = UIAlertController(title: "Epoche",
                                          message: hatali ? "Kullanıcı adı ya da şifre yanlış." : "Giriş bilgilerini yaz.",
                                          preferredStyle: .alert)
            alert.addTextField { $0.placeholder = "Kullanıcı adı"; $0.text = "osman"
                $0.autocapitalizationType = .none; $0.textContentType = .username }
            alert.addTextField { $0.placeholder = "Şifre"; $0.isSecureTextEntry = true; $0.textContentType = .password }
            alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in tamam(nil, nil) })
            alert.addAction(UIAlertAction(title: "Giriş", style: .default) { _ in
                tamam(alert.textFields?[0].text, alert.textFields?[1].text)
            })
            guard let top = enUstteki() else { return tamam(nil, nil) }
            top.present(alert, animated: true)
        }

        private func enUstteki() -> UIViewController? {
            var top = UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }.first
            while let next = top?.presentedViewController { top = next }
            return top
        }

        // window.alert / confirm, uygulama içinde yerel uyarıyla.
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            present(message, ok: { completionHandler() }, cancel: nil)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            present(message, ok: { completionHandler(true) }, cancel: { completionHandler(false) })
        }

        private func present(_ message: String, ok: @escaping () -> Void, cancel: (() -> Void)?) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            if let cancel { alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in cancel() }) }
            alert.addAction(UIAlertAction(title: "Tamam", style: .default) { _ in ok() })
            let root = UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }.first
            var top = root
            while let next = top?.presentedViewController { top = next }
            guard let top else { (cancel ?? ok)(); return }
            top.present(alert, animated: true)
        }
    }
}
