"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useAppStore } from "@/lib/store";
import {
  Plus,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Type,
} from "lucide-react";

interface NoteEditorProps {
  date: string;
}

const BLOCK_TYPES = [
  { label: "Metin", icon: Type,         insert: () => ({ type: "paragraph" as const, content: [] }) },
  { label: "Başlık 1", icon: Heading1,   insert: () => ({ type: "heading" as const, props: { level: 1 as const }, content: [] }) },
  { label: "Başlık 2", icon: Heading2,   insert: () => ({ type: "heading" as const, props: { level: 2 as const }, content: [] }) },
  { label: "Başlık 3", icon: Heading3,   insert: () => ({ type: "heading" as const, props: { level: 3 as const }, content: [] }) },
  { label: "Madde listesi", icon: List,  insert: () => ({ type: "bulletListItem" as const, content: [] }) },
  { label: "Numaralı liste", icon: ListOrdered, insert: () => ({ type: "numberedListItem" as const, content: [] }) },
  { label: "Yapılacaklar", icon: CheckSquare, insert: () => ({ type: "checkListItem" as const, props: { checked: false as const }, content: [] }) },
  { label: "Alıntı", icon: Quote,        insert: () => ({ type: "quote" as const, content: [] }) },
  { label: "Kod",    icon: Code,         insert: () => ({ type: "codeBlock" as const, props: { language: "plain text" as const } }) },
  { label: "Ayraç", icon: Minus,         insert: () => ({ type: "paragraph" as const, content: [{ type: "text" as const, text: "---", styles: {} }] }) },
] as const;

export function NoteEditor({ date }: NoteEditorProps) {
  const { notes, saveNote } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const existingNote = notes.find((n) => n.date === date);

  const initialContent = (() => {
    if (existingNote?.content) {
      try { return JSON.parse(existingNote.content); }
      catch { return undefined; }
    }
    return undefined;
  })();

  const editor = useCreateBlockNote({ initialContent });

  // Mount'ta otomatik fokusla
  useEffect(() => {
    const t = setTimeout(() => { try { editor.focus(); } catch { /* */ } }, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gün değişince içeriği yükle + fokusla
  useEffect(() => {
    if (!editor) return;
    const note = notes.find((n) => n.date === date);
    const parsed = (() => {
      if (note?.content) { try { return JSON.parse(note.content); } catch { /* */ } }
      return [{ type: "paragraph", content: [] }];
    })();
    editor.replaceBlocks(editor.document, parsed);
    setTimeout(() => { try { editor.focus(); } catch { /* */ } }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Auto-save 500ms debounce
  const handleChange = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const contentJSON = JSON.stringify(editor.document);
      const plainText = editor.document
        .map((b: Record<string, unknown>) => {
          const c = b.content;
          if (Array.isArray(c))
            return c.map((i: Record<string, unknown>) =>
              i.type === "text" && typeof i.text === "string" ? i.text : ""
            ).join("");
          return "";
        })
        .join("\n")
        .trim();
      saveNote(date, contentJSON, plainText);
    }, 500);
  }, [date, editor, saveNote]);

  // Dropdown dışına tıklayınca kapat
  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [dropdownOpen]);

  // Blok ekle
  function insertBlock(blockFn: () => Record<string, unknown>) {
    setDropdownOpen(false);
    const block = blockFn() as Parameters<typeof editor.insertBlocks>[0][0];
    try {
      const pos = editor.getTextCursorPosition();
      editor.insertBlocks([block], pos.block, "after");
    } catch {
      const last = editor.document[editor.document.length - 1];
      editor.insertBlocks([block], last, "after");
    }
    setTimeout(() => { try { editor.focus(); } catch { /* */ } }, 50);
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
            title="Blok ekle"
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
              {BLOCK_TYPES.map(({ label, icon: Icon, insert }) => (
                <button
                  key={label}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertBlock(insert); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors"
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

        <span className="ml-auto text-[11px]" style={{ color: "var(--text-muted)" }}>
          / ile de ekleyebilirsin
        </span>
      </div>

      {/* Editör — tıklayınca fokuslanır */}
      <div
        className="flex-1 overflow-auto cursor-text"
        onClick={() => { try { editor.focus(); } catch { /* */ } }}
      >
        <BlockNoteView
          editor={editor}
          onChange={handleChange}
          theme="light"
        />
      </div>
    </div>
  );
}
