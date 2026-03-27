"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Topbar } from "@/components/topbar/Topbar";
import { ViewSwitcher } from "@/components/views/ViewSwitcher";
import { TaskModal } from "@/components/shared/TaskModal";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { EventModal } from "@/components/shared/EventModal";
import { DeleteEventConfirmDialog } from "@/components/shared/DeleteEventConfirmDialog";
import { SearchModal } from "@/components/search/SearchModal";
import { SettingsPanel } from "@/components/shared/SettingsPanel";
import { WorkspaceModal } from "@/components/workspace/WorkspaceModal";
import { useAppStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function Home() {
  const { user, authLoading, initAuth, theme, sidebarOpen } = useAppStore();
  const router = useRouter();

  // Faz 7 — Keyboard shortcuts
  useKeyboardShortcuts();

  // Faz 7 — Dark mode: tema uygula
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

  // Auth durumunu başlat (Supabase yapılandırılmışsa)
  useEffect(() => {
    if (isSupabaseConfigured) {
      initAuth();
    }
  }, [initAuth]);

  // Giriş yapılmamışsa → landing page'e yönlendir
  useEffect(() => {
    if (isSupabaseConfigured && !authLoading && !user) {
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  // Yükleniyor ekranı (Supabase yapılandırılmışsa)
  if (isSupabaseConfigured && authLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--surface-base)" }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{
            borderColor:
              "var(--border-strong) var(--border-strong) var(--border-strong) var(--brand-gold)",
          }}
        />
      </div>
    );
  }

  // Supabase yapılandırılmış ama kullanıcı henüz yönlendirilmedi
  if (isSupabaseConfigured && !user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => useAppStore.getState().toggleSidebar()}
        />
      )}
      <Sidebar />

      {/* Main content */}
      <main
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ background: "var(--surface-raised)" }}
      >
        <Topbar />
        <ViewSwitcher />
      </main>

      {/* Faz 3 — Global Modal'lar */}
      <TaskModal />
      <DeleteConfirmDialog />

      {/* Faz 4 — Etkinlik Modal'ları */}
      <EventModal />
      <DeleteEventConfirmDialog />

      {/* Faz 6 — Global Arama */}
      <SearchModal />

      {/* Faz 7 — Ayarlar Paneli */}
      <SettingsPanel />

      {/* Faz 8 — Workspace Modal */}
      <WorkspaceModal />
    </div>
  );
}
