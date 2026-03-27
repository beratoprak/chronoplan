"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAppStore } from "@/lib/store";

export default function AuthPage() {
  const { user, authLoading } = useAppStore();
  const router = useRouter();

  // Zaten giriş yapmışsa ana sayfaya yönlendir
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
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

  if (user) return null;

  return (
    <div
      className="flex items-center justify-center min-h-screen px-4"
      style={{ background: "var(--surface-base)" }}
    >
      <AuthForm />
    </div>
  );
}
