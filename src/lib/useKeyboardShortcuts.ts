"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import { format, parseISO, addDays, subDays } from "date-fns";
import type { ViewType } from "@/types";

/**
 * Faz 7 — Global Keyboard Shortcuts
 *
 * Arrow Keys:  ← → gün değiştir
 * 1-4:         View değiştir (modal açık değilken)
 * Cmd+N:       Yeni görev
 * Cmd+E:       Yeni etkinlik
 * Cmd+K:       Arama (zaten mevcut)
 * Cmd+,:       Ayarlar
 * Escape:      Modal kapat (zaten mevcut)
 */
export function useKeyboardShortcuts() {
  const store = useAppStore;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = store.getState();
      const target = e.target as HTMLElement;

      // Input/textarea/contenteditable'da ise kısayolları atla (Cmd kombinasyonları hariç)
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+N → Yeni görev
      if (isMeta && e.key === "n") {
        e.preventDefault();
        state.openTaskModal();
        return;
      }

      // Cmd+E → Yeni etkinlik
      if (isMeta && e.key === "e") {
        e.preventDefault();
        state.openEventModal();
        return;
      }

      // Cmd+, → Ayarlar
      if (isMeta && e.key === ",") {
        e.preventDefault();
        if (state.isSettingsOpen) {
          state.closeSettings();
        } else {
          state.openSettings();
        }
        return;
      }

      // Herhangi bir modal açıksa ve typing modundaysak kısayolları atla
      if (isTyping) return;

      // Herhangi bir modal açıkken sadece Escape çalışsın
      const anyModalOpen =
        state.isTaskModalOpen ||
        state.isEventModalOpen ||
        state.isSearchOpen ||
        state.isSettingsOpen ||
        state.isWorkspaceModalOpen;

      if (anyModalOpen) return;

      // ← → Gün değiştir
      if (e.key === "ArrowLeft" && !isMeta) {
        e.preventDefault();
        const prev = format(subDays(parseISO(state.selectedDate), 1), "yyyy-MM-dd");
        state.setSelectedDate(prev);
        return;
      }
      if (e.key === "ArrowRight" && !isMeta) {
        e.preventDefault();
        const next = format(addDays(parseISO(state.selectedDate), 1), "yyyy-MM-dd");
        state.setSelectedDate(next);
        return;
      }

      // Bugüne dön
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        state.setSelectedDate(format(new Date(), "yyyy-MM-dd"));
        return;
      }

      // 1-4: View değiştir
      const viewMap: Record<string, ViewType> = {
        "1": "daily",
        "2": "weekly",
        "3": "monthly",
        "4": "kanban",
      };
      if (viewMap[e.key]) {
        e.preventDefault();
        state.setView(viewMap[e.key]);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
