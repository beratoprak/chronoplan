import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {}, isSupabaseConfigured: false }));

import { useAppStore } from "./store";
import type { CalendarEvent } from "@/types";

const planEtkinligi = { id: "ybs-plan-2026-10-05", title: "📘 Plan", date: "2026-10-05", source: "ybs-haftalik-plan", isAllDay: true, recurrence: "none" } as CalendarEvent;
const randevu = { id: "e1", title: "Diş", date: "2026-10-05", isAllDay: false, recurrence: "none" } as CalendarEvent;

describe("takvimde plan etkinliğine tıklama", () => {
  beforeEach(() => useAppStore.setState({ isDemoMode: false, gunSayfasiTarihi: null, isEventModalOpen: false }));

  it("gün sayfasını açar, düzenleme penceresini açmaz", () => {
    useAppStore.getState().openEventModal(planEtkinligi);
    expect(useAppStore.getState().gunSayfasiTarihi).toBe("2026-10-05");
    expect(useAppStore.getState().isEventModalOpen).toBe(false);
  });

  it("'Etkinliği düzenle' ile pencere açılır", () => {
    useAppStore.getState().openEventModal(planEtkinligi, undefined, { duzenle: true });
    expect(useAppStore.getState().isEventModalOpen).toBe(true);
    expect(useAppStore.getState().gunSayfasiTarihi).toBeNull();
  });

  it("başka etkinlikler eskisi gibi pencerede açılır", () => {
    useAppStore.getState().openEventModal(randevu);
    expect(useAppStore.getState().isEventModalOpen).toBe(true);
    expect(useAppStore.getState().gunSayfasiTarihi).toBeNull();
  });
});
