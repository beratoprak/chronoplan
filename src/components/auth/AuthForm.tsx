"use client";

import { useState } from "react";
import { Mail, Lock, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";

type Mode = "login" | "signup" | "magic";

export function AuthForm() {
  const { signIn, signUp, signInWithMagicLink } = useAppStore();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === "magic") {
      const { error } = await signInWithMagicLink(email);
      if (error) {
        setError(error.message);
      } else {
        setSuccess("E-posta gönderildi! Gelen kutunuzu kontrol edin.");
      }
    } else if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) setError(error.message);
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Hesap oluşturuldu! E-postanızı doğrulayın.");
      }
    }

    setLoading(false);
  }

  return (
    <div
      className="w-full max-w-sm"
      style={{
        background: "var(--surface-raised)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-xl)",
        padding: "2rem",
        boxShadow: "0 8px 32px rgba(107, 91, 62, 0.12)",
      }}
    >
      {/* Logo */}
      <div className="text-center mb-7">
        <h1
          className="text-2xl"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 600,
            color: "var(--brand-gold)",
            letterSpacing: "0.02em",
          }}
        >
          ChronoPlan
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Profesyonel takvim & planlama
        </p>
      </div>

      {/* Mode tabs */}
      <div
        className="flex mb-5"
        style={{
          background: "var(--surface-sunken)",
          borderRadius: "var(--radius-md)",
          padding: "3px",
          gap: "2px",
        }}
      >
        {(["login", "signup", "magic"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); setSuccess(null); }}
            className="flex-1 text-center"
            style={{
              padding: "6px 4px",
              fontSize: "12px",
              fontWeight: mode === m ? 500 : 400,
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              background: mode === m ? "var(--surface-raised)" : "transparent",
              color: mode === m ? "var(--brand-gold)" : "var(--text-secondary)",
              transition: "all var(--transition-fast)",
              boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {m === "login" ? "Giriş Yap" : m === "signup" ? "Kayıt Ol" : "Magic Link"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Email */}
        <div className="relative">
          <Mail
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 12px 10px 34px",
              fontSize: "13px",
              border: "0.5px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-base)",
              color: "var(--text-primary)",
              outline: "none",
              transition: "border-color var(--transition-fast)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--brand-gold)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
          />
        </div>

        {/* Password — sadece login/signup modunda */}
        {mode !== "magic" && (
          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px 10px 34px",
                fontSize: "13px",
                border: "0.5px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-base)",
                color: "var(--text-primary)",
                outline: "none",
                transition: "border-color var(--transition-fast)",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--brand-gold)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            />
          </div>
        )}

        {/* Magic link açıklama */}
        {mode === "magic" && (
          <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
            E-posta adresinize oturum açma bağlantısı gönderilecek.
          </p>
        )}

        {/* Error / success mesajı */}
        {error && (
          <p
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--priority-urgent-bg)", color: "var(--priority-urgent-text)" }}
          >
            {error}
          </p>
        )}
        {success && (
          <p
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: "var(--priority-low-bg)", color: "var(--priority-low-text)" }}
          >
            {success}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="cp-btn cp-btn-primary w-full mt-1 gap-2"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : mode === "magic" ? (
            <Sparkles size={15} />
          ) : (
            <ArrowRight size={15} />
          )}
          {mode === "login" ? "Giriş Yap" : mode === "signup" ? "Hesap Oluştur" : "Bağlantı Gönder"}
        </button>
      </form>
    </div>
  );
}
