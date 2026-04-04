"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Plus, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Code, Minus, Type,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

interface NoteEditorProps {
  date: string;
}

const INSERTS = [
  { label: "Metin",          icon: Type,         prefix: ""         },
  { label: "Başlık 1",       icon: Heading1,      prefix: "# "       },
  { label: "Başlık 2",       icon: Heading2,      prefix: "## "      },
  { label: "Başlık 3",       icon: Heading3,      prefix: "### "     },
  { label: "Madde listesi",  icon: List,          prefix: "• "       },
  { label: "Numaralı liste", icon: ListOrdered,   prefix: "1. "      },
  { label: "Yapılacaklar",   icon: CheckSquare,   prefix: "☐ "       },
  { label: "Alıntı",         icon: Quote,         prefix: "> "       },
  { label: "Kod",            icon: Code,          prefix: "```\n"    },
  { label: "Ayraç",          icon: Minus,         prefix: "\n---\n"  },
];

function extractText(content: string): string {
  // Eğer BlockNote JSON ise plainText çıkar, değilse direkt kullan
  try {
    const parsed = JSON.parse(content);
    // JSON string kaydedilmişse (kendi formatımız)
    if (typeof parsed === "string") return parsed;
    // BlockNote block array ise
    if (Array.isArray(parsed)) {
      return parsed
        .map((b: Record<string, unknown>) => {
          const c = b.content;
          if (Array.isArray(c))
            return c
              .map((i: Record<string, unknown>) =>
                i.type === "text" && typeof i.text === "string" ? i.text : ""
              )
              .join("");
          return "";
        })
        .join("\n");
    }
  } catch { /* */ }
  return content;
}

export function NoteEditor({ date }: NoteEditorProps) {
  const { notes, saveNote } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Gün değişince notu yükle + fokusla
  useEffect(() => {
    const note = notes.find((n) => n.date === date);
    const text = note
      ? (note.plainText || extractText(note.content))
      : "";
    setValue(text);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Auto-resize
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.max(ta.scrollHeight, 320) + "px";
  }, [value]);

  // Değişince 500ms debounce ile kaydet
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setValue(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveNote(date, JSON.stringify(text), text);
      }, 500);
    },
    [date, saveNote]
  );

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    if (!dropdownOpen) return;
    function onOutside(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [dropdownOpen]);

  // Enter'da liste devamı
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    const ta = textareaRef.current;
    if (!ta) return;

    // DOM'dan oku — stale state sorununu önler
    const currentValue = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = currentValue.slice(0, start);
    const after = currentValue.slice(end);

    // Mevcut satırı bul
    const lastNewline = before.lastIndexOf("\n");
    const currentLine = before.slice(lastNewline + 1);

    // Liste pattern'lerini kontrol et
    let prefix = "";
    const trimmed = currentLine.trimStart();

    // Boş liste satırı → listeyi bitir (prefix'i sil)
    if (/^(☐\s*|☑\s*|•\s*|\d+\.\s*|>\s*)$/.test(trimmed)) {
      e.preventDefault();
      const lineStart = lastNewline + 1;
      const newValue = currentValue.slice(0, lineStart) + after;
      setValue(newValue);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveNote(date, JSON.stringify(newValue), newValue);
      }, 500);
      requestAnimationFrame(() => {
        ta.setSelectionRange(lineStart, lineStart);
      });
      return;
    }

    // Checklist
    if (/^☐\s/.test(trimmed)) prefix = "☐ ";
    else if (/^☑\s/.test(trimmed)) prefix = "☐ ";
    // Madde listesi
    else if (/^•\s/.test(trimmed)) prefix = "• ";
    // Numaralı liste
    else if (/^(\d+)\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s/);
      if (match) prefix = `${parseInt(match[1]) + 1}. `;
    }
    // Alıntı
    else if (/^>\s/.test(trimmed)) prefix = "> ";

    if (!prefix) return;

    e.preventDefault();
    const indent = currentLine.match(/^(\s*)/)?.[1] || "";
    const insertion = "\n" + indent + prefix;
    const newValue = before + insertion + after;
    const newPos = start + insertion.length;
    setValue(newValue);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveNote(date, JSON.stringify(newValue), newValue);
    }, 500);
    requestAnimationFrame(() => {
      ta.setSelectionRange(newPos, newPos);
    });
  }

  // Cursor pozisyonuna metin ekle
  function handleInsert(prefix: string) {
    setDropdownOpen(false);
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(ta.selectionEnd ?? start);
    const needsNewline = before.length > 0 && !before.endsWith("\n");
    const insertion = (needsNewline ? "\n" : "") + prefix;
    const newValue = before + insertion + after;

    setValue(newValue);
    const newPos = start + insertion.length;

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveNote(date, JSON.stringify(newValue), newValue);
      }, 500);
    }, 0);
  }

  return (
    <div
      className="flex-1 flex flex-col rounded-lg overflow-hidden"
      style={{
        background: "var(--surface-raised)",
        border: "0.5px solid var(--border-default)",
        minHeight: "360px",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center px-3 py-1.5 shrink-0"
        style={{ borderBottom: "0.5px solid var(--border-subtle)" }}
      >
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-colors"
            style={{
              border: "0.5px solid var(--border-default)",
              background: dropdownOpen ? "var(--surface-sunken)" : "transparent",
              color: "var(--text-secondary)",
            }}
          >
            <Plus size={13} />
            Ekle
          </button>

          {dropdownOpen && (
            <div
              className="absolute left-0 top-full mt-1 z-50 py-1 rounded-lg overflow-hidden"
              style={{
                background: "var(--surface-raised)",
                border: "0.5px solid var(--border-default)",
                boxShadow: "0 8px 24px rgba(44,37,24,0.12)",
                minWidth: "180px",
              }}
            >
              {INSERTS.map(({ label, icon: Icon, prefix }) => (
                <button
                  key={label}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleInsert(prefix); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left"
                  style={{ color: "var(--text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Icon size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Serbest yazma alanı */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Bugün ne düşünüyorsun..."
        className="flex-1 resize-none outline-none p-4 text-[14px] leading-relaxed"
        style={{
          background: "transparent",
          color: "var(--text-primary)",
          fontFamily: "'DM Sans', sans-serif",
          border: "none",
          minHeight: "320px",
          caretColor: "var(--brand-gold)",
        }}
      />
    </div>
  );
}
