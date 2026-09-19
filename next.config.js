const path = require("node:path");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Workbox tarafından üretilen ana worker'a Epoche'nin Web Push olaylarını ekle.
  importScripts: ["/push-sw.js"],
  // app-build-manifest.json bir derleme artefaktıdır; App Router onu servis
  // etmez (404). Workbox precache listesinde kalırsa tek bir 404 yüzünden
  // service worker kurulumu tamamen reddedilir ve worker redundant olur —
  // bu da çevrimdışı önbelleği ve Web Push'u sessizce devre dışı bırakır.
  buildExcludes: [/app-build-manifest\.json$/],
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts",
        expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
      },
    },
    {
      // Anında yükleme: önce önbellekten sun, arka planda güncelle.
      // (NetworkFirst + 10sn timeout "sürekli yükleniyor" hissinin nedeniydi.)
      urlPattern: /\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-code",
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\.(?:woff2?|png|jpg|jpeg|gif|svg|ico)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
  fallbacks: {
    document: "/offline",
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Derleme kimliği — istemci, /api/version ile karşılaştırıp
    // yeni sürüm çıktığında kullanıcıya "Güncelle" gösterir.
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7),
  },
  transpilePackages: [
    "@blocknote/core",
    "@blocknote/react",
    "@blocknote/mantine",
  ],
  webpack: (config) => {
    // ProseMirror paketleri tek örnek olmak zorunda: aynı paketin ESM ve CJS
    // derlemeleri ayrı modül sayıldığında bir derlemeden çıkan düğüm diğerine
    // geçemiyor ve editör "multiple versions of prosemirror-model" diye çöküyor.
    // Daha önce yalnız prosemirror-view takma adlanmıştı; bu, view'i CJS'e
    // sabitleyip model'i ESM'de bırakarak sorunu çözmek yerine üretiyordu.
    // Paket dizinine takma ad vermek yetmiyor: her paketin hem ESM hem CJS
    // derlemesi var ve webpack ithal eden kodun biçimine göre birini seçiyor.
    // İki derleme ayrı modül örneği demek; birinden çıkan düğüm diğerine
    // geçemiyor. Bu yüzden doğrudan ESM dosyasına, tam eşleşmeyle bağlanıyor.
    const pmEsm = (ad) => path.join(__dirname, "node_modules", ad, "dist", "index.js");
    config.resolve.alias = {
      ...config.resolve.alias,
      "prosemirror-model$": pmEsm("prosemirror-model"),
      "prosemirror-state$": pmEsm("prosemirror-state"),
      "prosemirror-view$": pmEsm("prosemirror-view"),
      "prosemirror-transform$": pmEsm("prosemirror-transform"),
    };
    return config;
  },
};

module.exports = withPWA(nextConfig);
