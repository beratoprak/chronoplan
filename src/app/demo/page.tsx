"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Topbar } from "@/components/topbar/Topbar";
import { ViewSwitcher } from "@/components/views/ViewSwitcher";
import { SearchModal } from "@/components/search/SearchModal";
import { SettingsPanel } from "@/components/shared/SettingsPanel";
import { useAppStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { Eye, ArrowLeft } from "lucide-react";

export default function DemoPage() {
  const { theme, sidebarOpen, setDemoMode, demoToast } = useAppStore();
  const router = useRouter();

  useKeyboardShortcuts();

  // Demo modunu aktifle + mobilde sidebar kapat
  useEffect(() => {
    setDemoMode(true);
    // Mobilde sidebar'i kapat
    if (window.innerWidth < 1024 && useAppStore.getState().sidebarOpen) {
      useAppStore.getState().toggleSidebar();
    }
    return () => setDemoMode(false);
  }, [setDemoMode]);

  // Dark mode
  useEffect(() => {
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Demo Banner — sabit ust bar */}
        <div
          className="flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 shrink-0"
          style={{
            background: "var(--brand-gold)",
            color: "var(--text-inverse)",
          }}
        >
          <Eye size={14} className="shrink-0" />
          <span className="text-[11px] sm:text-[13px] font-medium">
            Demo Modu — Sadece goruntuleyebilirsiniz
          </span>
          <button
            onClick={() => router.push("/landing")}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-[12px] font-medium transition-all hover:opacity-90 shrink-0"
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "var(--text-inverse)",
            }}
          >
            <ArrowLeft size={12} />
            Ana Sayfa
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/30 lg:hidden"
              onClick={() => useAppStore.getState().toggleSidebar()}
            />
          )}
          <Sidebar />

          <main
            className="flex-1 flex flex-col min-w-0 overflow-hidden"
            style={{ background: "var(--surface-raised)" }}
          >
            <Topbar />
            <ViewSwitcher />
          </main>
        </div>
      </div>

      {/* Search & Settings work in demo too */}
      <SearchModal />
      <SettingsPanel />

      {/* Demo Toast */}
      {demoToast && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-lg shadow-lg text-[13px] font-medium"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-primary)",
            border: "1px solid var(--brand-gold)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {demoToast}
        </div>
      )}
    </>
  );
}
