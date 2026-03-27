"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useAppStore } from "@/lib/store";

export function DeleteEventConfirmDialog() {
  const { deletingEventId, closeDeleteEventConfirm, deleteEvent, events } = useAppStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  const event = deletingEventId ? events.find((e) => e.id === deletingEventId) : null;

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && deletingEventId) {
        closeDeleteEventConfirm();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deletingEventId, closeDeleteEventConfirm]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      closeDeleteEventConfirm();
    }
  }

  function handleConfirm() {
    if (deletingEventId) {
      deleteEvent(deletingEventId);
      closeDeleteEventConfirm();
    }
  }

  if (!deletingEventId || !event) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "var(--surface-overlay)" }}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl overflow-hidden animate-modal-in"
        style={{
          background: "var(--surface-raised)",
          border: "0.5px solid var(--border-default)",
          boxShadow: "0 25px 50px -12px rgba(44, 37, 24, 0.25)",
        }}
      >
        {/* Icon */}
        <div className="flex flex-col items-center pt-6 pb-2 px-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "var(--priority-urgent-bg)" }}
          >
            <AlertTriangle size={22} style={{ color: "var(--priority-urgent)" }} />
          </div>
          <h3
            className="text-[15px] font-medium text-center"
            style={{ color: "var(--text-primary)" }}
          >
            Etkinliği Sil
          </h3>
          <p
            className="text-[13px] text-center mt-1.5 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <strong style={{ color: "var(--text-primary)" }}>&ldquo;{event.title}&rdquo;</strong>{" "}
            etkinliğini silmek istediğinize emin misiniz?
            {event.recurrence && event.recurrence !== "none" && (
              <span className="block mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                Bu tekrarlayan bir etkinliktir. Tüm tekrarlar silinecektir.
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-6 py-4">
          <button
            onClick={closeDeleteEventConfirm}
            className="cp-btn cp-btn-ghost text-[12px] flex-1 py-2"
          >
            İptal
          </button>
          <button
            onClick={handleConfirm}
            className="cp-btn text-[12px] flex-1 py-2 font-medium"
            style={{
              background: "var(--priority-urgent)",
              color: "var(--text-inverse)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}
