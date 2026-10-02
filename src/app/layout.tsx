import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";

/**
 * Yazı tipleri `next/font` ile kuruluyor, CSS `@import` ile değil.
 *
 * Eskisi globals.css'in içinde, @tailwind satırlarının ardındaki bir
 * `@import url(fonts.googleapis.com…)` idi: CSS'te @import en başta olmak
 * zorunda, ayrıca her açılışta Google'a ek bir gidiş-dönüş demek ve font
 * yüklenene kadar yazı zıplıyor. next/font dosyaları derleme anında kendi
 * alanımıza alıp `font-display: swap` ve ölçü eşleştirmesiyle veriyor.
 *
 * `latin-ext` alt kümesi şart: ğ ı ş İ Ç Ö Ü orada.
 */
const sans = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

/** Notun gövdesi ve başlıkları. Uzun metin okumak için çizilmiş bir serif —
 *  bir not uygulamasında gözün en çok durduğu yer burası. */
const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-serif",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  // Next 14'te Newsreader için ölçü eşleştirme verisi yok; açık bırakınca
  // her derlemede uyarı basıyor. Yedek font zaten Georgia — ölçüsü yakın.
  adjustFontFallback: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Epoche — Takvimin Üzerindeki Dijital Ajanda",
  description: "Notlarınızı, görevlerinizi, takviminizi ve odak zamanınızı aynı günlük akışta birleştirin.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Epoche",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#8A6B43",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // iPhone çentik/home bar güvenli alanları
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegistrar />
        {children}
        <UpdateNotifier />
      </body>
    </html>
  );
}
