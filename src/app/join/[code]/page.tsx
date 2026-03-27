"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAppStore } from "@/lib/store";
import { ShieldCheck } from "lucide-react";

// ── Davet kodlari ──────────────────────────────────────────
// Yeni kod eklemek icin bu diziye ekle
const VALID_INVITE_CODES = [
  "berat2026",
  "chronoplan-vip",
];

export default function JoinPage() {
  const { user, authLoading } = useAppStore();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (VALID_INVITE_CODES.includes(code)) {
      setIsValid(true);
    } else {
      setIsValid(false);
      // Gecersiz kod — 2sn sonra landing'e yonlendir
      setTimeout(() => router.replace("/landing"), 2000);
    }
  }, [code, router]);

  // Zaten giris yapmissa ana sayfaya yonlendir
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // Yukleniyor
  if (isValid === null || authLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--surface-base)" }}
      >
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{
            borderColor: "var(--border-strong) var(--border-strong) var(--border-strong) var(--brand-gold)",
          }}
        />
      </div>
    );
  }

  // Gecersiz kod
  if (!isValid) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3 px-4"
        style={{ background: "var(--surface-base)" }}
      >
        <div
          className="text-sm px-4 py-3 rounded-lg text-center"
          style={{
            background: "var(--priority-urgent-bg)",
            color: "var(--priority-urgent-text)",
            border: "0.5px solid var(--priority-urgent)",
          }}
        >
          Gecersiz davet kodu. Ana sayfaya yonlendiriliyorsunuz...
        </div>
      </div>
    );
  }

  // Gecerli kod — kayit formunu goster
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-4 gap-4"
      style={{ background: "var(--surface-base)" }}
    >
      {/* Davet badge */}
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium"
        style={{
          background: "var(--priority-low-bg)",
          color: "var(--priority-low-text)",
          border: "0.5px solid var(--priority-low)",
        }}
      >
        <ShieldCheck size={14} />
        Davetlisiniz — Hosgeldiniz!
      </div>

      <AuthForm />
    </div>
  );
}
