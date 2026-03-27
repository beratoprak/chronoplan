"use client";

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  FileText,
  Search,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Check,
  Star,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "4 Gorunum",
    desc: "Gunluk detay, haftalik timeline, aylik grid ve kanban board — hepsi tek yerde.",
  },
  {
    icon: FileText,
    title: "Notion-tarzi Notlar",
    desc: "Her gune ozel block editor ile serbest not tutma. Otomatik kaydetme.",
  },
  {
    icon: Columns3,
    title: "Kanban Board",
    desc: "Surukle-birak ile gorev yonetimi. Planlanan, devam eden, tamamlanan.",
  },
  {
    icon: Search,
    title: "Hizli Arama",
    desc: "Cmd+K ile aninda arama. Notlar, gorevler ve etkinlikler tek noktada.",
  },
  {
    icon: Zap,
    title: "Offline Calisma",
    desc: "PWA destegi ile internet olmadan da calis. Veriler otomatik senkronize olur.",
  },
  {
    icon: Shield,
    title: "Guvenli Veri",
    desc: "Supabase altyapisi ile veriler guvenle saklanir. Row-level security.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "0",
    period: "sonsuza kadar",
    features: [
      "1 kisisel workspace",
      "Sinisiz gorev & etkinlik",
      "Block editor notlari",
      "4 gorunum modu",
      "PWA & offline destek",
      "CSV/Markdown export",
    ],
    cta: "Ucretsiz Basla",
    accent: false,
  },
  {
    name: "Pro",
    price: "29",
    period: "/ ay",
    features: [
      "Free'deki her sey",
      "5 workspace",
      "Oncelikli destek",
      "Gelismis filtreler",
      "Takvim entegrasyonu",
      "Ozel temalar",
    ],
    cta: "Pro'ya Gec",
    accent: true,
  },
  {
    name: "Team",
    price: "79",
    period: "/ ay",
    features: [
      "Pro'daki her sey",
      "Sinirsiz workspace",
      "Takim yonetimi",
      "Paylasimli kanban",
      "Gercek zamanli isbirligi",
      "Admin paneli",
    ],
    cta: "Takim Plani",
    accent: false,
  },
];

const TESTIMONIALS = [
  {
    name: "Ayse K.",
    role: "UX Designer",
    text: "ChronoPlan gunluk is akisimi tamamen degistirdi. Notion + Calendar + Trello'yu tek uygulamada birlestirmis.",
    stars: 5,
  },
  {
    name: "Mehmet D.",
    role: "Yazilim Gelistirici",
    text: "Offline calisabilme ve hizli arama ozellikleri mukemmel. Artik baska takvim uygulamasi kullanmiyorum.",
    stars: 5,
  },
  {
    name: "Zeynep A.",
    role: "Proje Yoneticisi",
    text: "Takim kanban board'u ile projeleri yonetmek cok daha kolay. Gercek zamanli guncelleme harika.",
    stars: 5,
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-base)" }}>
      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between px-6 md:px-12 py-4"
        style={{ borderBottom: "0.5px solid var(--border-default)" }}
      >
        <h1
          className="text-xl font-medium tracking-wide"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          <span style={{ color: "var(--text-secondary)" }}>Chrono</span>
          <span style={{ color: "var(--brand-gold)" }}>Plan</span>
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/auth")}
            className="cp-btn cp-btn-ghost text-xs"
          >
            Giris Yap
          </button>
          <button
            onClick={() => router.push("/auth")}
            className="cp-btn cp-btn-primary text-xs"
          >
            Ucretsiz Basla
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-16 md:py-24 text-center max-w-4xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium mb-6"
          style={{
            background: "var(--brand-gold-light)",
            color: "var(--brand-gold)",
            border: "0.5px solid var(--brand-gold)",
          }}
        >
          <Zap size={12} /> Yeni: Takim isbirligi ve paylasimli kanban
        </div>
        <h2
          className="text-3xl md:text-5xl font-semibold leading-tight mb-4"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: "var(--text-primary)",
          }}
        >
          Takvim, notlar ve gorevler.{" "}
          <span style={{ color: "var(--brand-gold)" }}>Tek yerde.</span>
        </h2>
        <p
          className="text-base md:text-lg mb-8 max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          ChronoPlan, profesyonel takvim ve planlama uygulamasi. Gunluk notlar, haftalik planlama,
          kanban board ve takvim — hepsi bir arada, cream/gold estetikle.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.push("/auth")}
            className="cp-btn cp-btn-primary text-sm px-6 py-2.5 gap-2"
          >
            Ucretsiz Basla <ArrowRight size={16} />
          </button>
          <button
            onClick={() => {
              document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="cp-btn cp-btn-ghost text-sm px-6 py-2.5"
          >
            Fiyatlandirma
          </button>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section
        className="px-6 md:px-12 py-16"
        style={{ background: "var(--surface-raised)" }}
      >
        <div className="max-w-5xl mx-auto">
          <h3
            className="text-2xl md:text-3xl font-semibold text-center mb-12"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--text-primary)",
            }}
          >
            Neden ChronoPlan?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="cp-card p-5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: "var(--brand-gold-light)" }}
                  >
                    <Icon size={20} style={{ color: "var(--brand-gold)" }} />
                  </div>
                  <h4
                    className="text-[15px] font-medium mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {f.title}
                  </h4>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section className="px-6 md:px-12 py-16">
        <div className="max-w-5xl mx-auto">
          <h3
            className="text-2xl md:text-3xl font-semibold text-center mb-12"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--text-primary)",
            }}
          >
            Kullanicilar ne diyor?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="cp-card p-5">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} fill="var(--brand-gold)" style={{ color: "var(--brand-gold)" }} />
                  ))}
                </div>
                <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div>
                  <div className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
                    {t.name}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    {t.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section
        id="pricing"
        className="px-6 md:px-12 py-16"
        style={{ background: "var(--surface-raised)" }}
      >
        <div className="max-w-5xl mx-auto">
          <h3
            className="text-2xl md:text-3xl font-semibold text-center mb-3"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--text-primary)",
            }}
          >
            Basit fiyatlandirma
          </h3>
          <p className="text-center text-sm mb-12" style={{ color: "var(--text-secondary)" }}>
            Ihtiyacina gore plan sec. Istedigin zaman yukselt veya iptal et.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="rounded-xl p-6 flex flex-col"
                style={{
                  background: plan.accent ? "var(--brand-gold)" : "var(--surface-raised)",
                  border: plan.accent
                    ? "2px solid var(--brand-gold)"
                    : "0.5px solid var(--border-default)",
                  color: plan.accent ? "var(--text-inverse)" : "var(--text-primary)",
                }}
              >
                {plan.accent && (
                  <div
                    className="text-[10px] font-medium uppercase tracking-wider mb-3 text-center py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.2)" }}
                  >
                    En populer
                  </div>
                )}
                <h4 className="text-lg font-medium">{plan.name}</h4>
                <div className="flex items-baseline gap-1 mt-2 mb-4">
                  <span className="text-3xl font-semibold">{plan.price} TL</span>
                  <span
                    className="text-sm"
                    style={{ opacity: 0.7 }}
                  >
                    {plan.period}
                  </span>
                </div>
                <ul className="flex flex-col gap-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[13px]">
                      <Check size={14} style={{ opacity: 0.7 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => router.push("/auth")}
                  className="w-full py-2.5 rounded-lg text-[13px] font-medium transition-all"
                  style={{
                    background: plan.accent
                      ? "var(--text-inverse)"
                      : "var(--brand-gold)",
                    color: plan.accent ? "var(--brand-gold)" : "var(--text-inverse)",
                  }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <Users size={32} className="mx-auto mb-4" style={{ color: "var(--brand-gold)" }} />
          <h3
            className="text-2xl md:text-3xl font-semibold mb-3"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--text-primary)",
            }}
          >
            Takiminla birlikte planla
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Paylasimli kanban board&apos;lar, gercek zamanli isbirligi ve takim yonetimi ile
            projelerini bir ust seviyeye tasidin.
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="cp-btn cp-btn-primary text-sm px-8 py-2.5 gap-2"
          >
            Hemen Basla <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer
        className="px-6 md:px-12 py-6 flex items-center justify-between"
        style={{
          borderTop: "0.5px solid var(--border-default)",
          color: "var(--text-tertiary)",
        }}
      >
        <span className="text-xs">
          &copy; 2026 ChronoPlan — beratoprak.com
        </span>
        <span className="text-xs">
          Made with cream & gold
        </span>
      </footer>
    </div>
  );
}
