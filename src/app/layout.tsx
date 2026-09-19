import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import { ServiceWorkerRegistrar } from "@/components/shared/ServiceWorkerRegistrar";

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
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
