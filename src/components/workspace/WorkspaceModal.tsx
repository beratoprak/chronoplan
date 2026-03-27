"use client";

import { useState } from "react";
import { X, Plus, Users, Crown, Shield, User, Copy, Check, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { WorkspaceRole } from "@/types";

const ROLE_CONFIG: Record<WorkspaceRole, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: "Sahip", icon: Crown, color: "var(--brand-gold)" },
  admin: { label: "Yonetici", icon: Shield, color: "var(--status-active-text)" },
  member: { label: "Uye", icon: User, color: "var(--text-secondary)" },
};

export function WorkspaceModal() {
  const { isWorkspaceModalOpen, closeWorkspaceModal, currentWorkspace, workspaces } = useAppStore();
  const [tab, setTab] = useState<"overview" | "members" | "create">("overview");
  const [inviteEmail, setInviteEmail] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isWorkspaceModalOpen) return null;

  const ws = currentWorkspace;

  function handleCopyInvite() {
    const link = `${window.location.origin}/invite/${ws?.slug || "workspace"}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "var(--surface-overlay)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWorkspaceModal();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden animate-modal-in"
        style={{
          background: "var(--surface-raised)",
          border: "0.5px solid var(--border-default)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "0.5px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: "var(--brand-gold)" }} />
            <h2 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              Workspace
            </h2>
          </div>
          <button
            onClick={closeWorkspaceModal}
            className="p-1 rounded-lg transition-colors hover:bg-cream-200"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex px-5 gap-4"
          style={{ borderBottom: "0.5px solid var(--border-default)" }}
        >
          {(["overview", "members", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-2.5 text-[12px] font-medium transition-colors relative"
              style={{
                color: tab === t ? "var(--brand-gold)" : "var(--text-tertiary)",
                borderBottom: tab === t ? "2px solid var(--brand-gold)" : "2px solid transparent",
              }}
            >
              {t === "overview" ? "Genel" : t === "members" ? "Uyeler" : "Yeni Olustur"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(85vh - 120px)" }}>
          {/* Overview */}
          {tab === "overview" && (
            <div className="flex flex-col gap-4">
              {workspaces.length === 0 ? (
                <div className="text-center py-8">
                  <Users size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                    Henuz workspace olusturmadiniz
                  </p>
                  <p className="text-[11px] mb-4" style={{ color: "var(--text-tertiary)" }}>
                    Bir workspace olusturarak takiminizla birlikte calisabilirsiniz.
                  </p>
                  <button
                    onClick={() => setTab("create")}
                    className="cp-btn cp-btn-primary text-xs gap-1.5"
                  >
                    <Plus size={14} />
                    Workspace Olustur
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Workspace&apos;leriniz
                  </p>
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      className="flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:ring-1 hover:ring-[var(--border-accent)]"
                      style={{
                        border: ws?.id === workspace.id
                          ? "1.5px solid var(--brand-gold)"
                          : "0.5px solid var(--border-default)",
                        background: ws?.id === workspace.id
                          ? "var(--brand-gold-light)"
                          : "var(--surface-base)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-medium"
                        style={{
                          background: "var(--brand-gold)",
                          color: "var(--text-inverse)",
                        }}
                      >
                        {workspace.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {workspace.name}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                          {workspace.members.length} uye · {workspace.plan} plan
                        </div>
                      </div>
                      {workspace.isPersonal && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{
                            background: "var(--surface-sunken)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          Kisisel
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Members */}
          {tab === "members" && (
            <div className="flex flex-col gap-4">
              {/* Invite */}
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                  Uye Davet Et
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@ornek.com"
                    className="flex-1 px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
                    style={{
                      border: "0.5px solid var(--border-default)",
                      background: "var(--surface-base)",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--brand-gold)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-default)";
                    }}
                  />
                  <button className="cp-btn cp-btn-primary text-xs">
                    Davet Et
                  </button>
                </div>
              </div>

              {/* Copy invite link */}
              <button
                onClick={handleCopyInvite}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all"
                style={{
                  border: "0.5px solid var(--border-default)",
                  background: "var(--surface-base)",
                  color: "var(--text-secondary)",
                }}
              >
                {copied ? <Check size={14} style={{ color: "var(--priority-low)" }} /> : <Copy size={14} />}
                {copied ? "Kopyalandi!" : "Davet linkini kopyala"}
              </button>

              {/* Member list */}
              <div>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                  Mevcut Uyeler
                </p>
                {ws?.members && ws.members.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {ws.members.map((member) => {
                      const role = ROLE_CONFIG[member.role];
                      const RoleIcon = role.icon;
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg"
                          style={{ background: "var(--surface-base)" }}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                            style={{
                              background: "var(--surface-sunken)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {(member.name || member.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {member.name || member.email}
                            </div>
                            <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                              {member.email}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <RoleIcon size={12} style={{ color: role.color }} />
                            <span className="text-[10px]" style={{ color: role.color }}>
                              {role.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
                    Henuz uye yok. Yukaridaki form ile davet edin.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Create workspace */}
          {tab === "create" && (
            <div className="flex flex-col gap-4">
              <div>
                <label
                  className="text-[11px] uppercase tracking-wider mb-1.5 block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Workspace Adi
                </label>
                <input
                  type="text"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="Ornek: Bera'nin Takimi"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-all"
                  style={{
                    border: "0.5px solid var(--border-default)",
                    background: "var(--surface-base)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--brand-gold)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-default)";
                  }}
                />
              </div>

              <div
                className="rounded-lg p-3"
                style={{ background: "var(--surface-base)" }}
              >
                <p className="text-[12px] font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Free planda:
                </p>
                <ul className="flex flex-col gap-1">
                  {["1 workspace", "Sinirsiz gorev", "5 uye limiti"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      <Check size={12} style={{ color: "var(--priority-low)" }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                className="cp-btn cp-btn-primary w-full text-xs gap-1.5"
                disabled={!newWsName.trim()}
                style={{
                  opacity: newWsName.trim() ? 1 : 0.5,
                }}
              >
                <Plus size={14} />
                Workspace Olustur
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
