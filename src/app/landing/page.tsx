"use client";

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  FileText,
  Search,
  Zap,
  Shield,
  ArrowRight,
  Play,
  Moon,
  Smartphone,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Gerçek Ajanda",
    desc: "Günlük sayfa, süreli haftalık takvim, aylık görünüm ve görev planı tek yerde.",
  },
  {
    icon: FileText,
    title: "Not Odaklı Günlük",
    desc: "Her güne özel, şablonlu ve otomatik kaydedilen düşünme alanı.",
  },
  {
    icon: Columns3,
    title: "Zamanlanan Görevler",
    desc: "Görevleri son tarihten bağımsız olarak takvimde gerçek bir çalışma saatine yerleştirin.",
  },
  {
    icon: Search,
    title: "Hızlı Arama",
    desc: "Cmd+K ile günlükler, bağımsız notlar, görevler ve etkinlikler arasında arayın.",
  },
  {
    icon: Moon,
    title: "Karanlık Mod",
    desc: "Göz yormayan koyu tema. Sistem tercihinize göre otomatik geçiş.",
  },
  {
    icon: Shield,
    title: "Güvenli Veri",
    desc: "Offline-first kayıt, kalıcı yazma kuyruğu ve kullanıcı bazlı erişim güvenliği.",
  },
  {
    icon: Zap,
    title: "Çevrimdışı Çalışma",
    desc: "İnternet olmadan çalışın; değişiklikler bağlantı geldiğinde otomatik eşitlensin.",
  },
  {
    icon: Smartphone,
    title: "Her Cihazda",
    desc: "Telefonunuza PWA olarak yükleyin veya masaüstünde kullanın.",
  },
];

const TECH_STACK = [
  "Next.js 14",
  "TypeScript",
  "Zustand",
  "Supabase",
  "Tailwind CSS",
  "BlockNote.js",
  "Electron",
  "PWA",
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
          <span style={{ color: "var(--brand-gold)" }}>Epoche</span>
        </h1>
        <button
          onClick={() => router.push("/demo")}
          className="cp-btn cp-btn-primary text-xs gap-1.5"
        >
          <Play size={13} />
          Demoyu incele
        </button>
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
          <Zap size={12} /> Dijital ajanda ve düşünme alanı
        </div>
        <h2
          className="text-3xl md:text-5xl font-semibold leading-tight mb-4"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: "var(--text-primary)",
          }}
        >
          Takvimin üzerinde yaşayan{" "}
          <span style={{ color: "var(--brand-gold)" }}>dijital ajandanız.</span>
        </h2>
        <p
          className="text-base md:text-lg mb-8 max-w-2xl mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          Epoche; düşünceleri, görevleri ve zamanı aynı günlük akışta birleştirir.
          Önce not alın, sonra önceliklendirin, takvime yerleştirin ve odaklanın.
        </p>
        <button
          onClick={() => router.push("/demo")}
          className="cp-btn cp-btn-primary text-sm px-6 py-2.5 gap-2"
        >
          Epoche&apos;yi incele <ArrowRight size={16} />
        </button>
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
            Özellikler
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="cp-card p-5">
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
                  <p
                    className="text-[13px] leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {f.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h3
            className="text-2xl md:text-3xl font-semibold mb-8"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--text-primary)",
            }}
          >
            Teknoloji
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 rounded-lg text-[13px] font-medium"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-secondary)",
                  border: "0.5px solid var(--border-default)",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section
        className="px-6 md:px-12 py-16 text-center"
        style={{ background: "var(--surface-raised)" }}
      >
        <div className="max-w-2xl mx-auto">
          <h3
            className="text-2xl md:text-3xl font-semibold mb-3"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: "var(--text-primary)",
            }}
          >
            Merak ettiniz mi?
          </h3>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Demo modunda uygulamanin tum gorunumlerini ve ozelliklerini kesfedebilirsiniz.
          </p>
          <button
            onClick={() => router.push("/demo")}
            className="cp-btn cp-btn-primary text-sm px-8 py-2.5 gap-2"
          >
            <Play size={15} />
            Demoyu Incele
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
          &copy; 2026 Epoche — beratoprak.com
        </span>
        <span className="text-xs">Made with cream & gold</span>
      </footer>
    </div>
  );
}
