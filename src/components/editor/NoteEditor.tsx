"use client";

import { useEffect, useCallback, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useAppStore } from "@/lib/store";

interface NoteEditorProps {
  date: string;
}

export function NoteEditor({ date }: NoteEditorProps) {
  const { notes, saveNote } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const existingNote = notes.find((n) => n.date === date);

  const initialContent = (() => {
    if (existingNote?.content) {
      try {
        return JSON.parse(existingNote.content);
      } catch {
        return undefined;
      }
    }
    return undefined;
  })();

  const editor = useCreateBlockNote({ initialContent });

  // Editör hazır olunca otomatik fokusla
  useEffect(() => {
    if (editor) {
      // Kısa gecikme — BlockNote DOM'u hazırlaması için
      const t = setTimeout(() => {
        try { editor.focus(); } catch { /* ignore */ }
      }, 100);
      return () => clearTimeout(t);
    }
  // Sadece ilk mount'ta çalışsın
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Farklı güne geçince içeriği yükle ve fokusla
  useEffect(() => {
    if (!editor) return;
    const note = notes.find((n) => n.date === date);
    if (note?.content) {
      try {
        const parsed = JSON.parse(note.content);
        editor.replaceBlocks(editor.document, parsed);
      } catch {
        editor.replaceBlocks(editor.document, [
          { type: "paragraph", content: [] },
        ]);
      }
    } else {
      editor.replaceBlocks(editor.document, [
        { type: "paragraph", content: [] },
      ]);
    }
    // Gün değişince de fokusla
    setTimeout(() => {
      try { editor.focus(); } catch { /* ignore */ }
    }, 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Auto-save — 500ms debounce
  const handleChange = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const contentJSON = JSON.stringify(editor.document);
      const plainText = editor.document
        .map((b: Record<string, unknown>) => {
          const content = b.content;
          if (Array.isArray(content)) {
            return content
              .map((i: Record<string, unknown>) =>
                i.type === "text" && typeof i.text === "string" ? i.text : ""
              )
              .join("");
          }
          return "";
        })
        .join("\n")
        .trim();
      saveNote(date, contentJSON, plainText);
    }, 500);
  }, [date, editor, saveNote]);

  // Wrapper'a tıklayınca editörü fokusla (metin yoksa da yazılabilsin)
  function handleWrapperClick(e: React.MouseEvent<HTMLDivElement>) {
    // Tıklama zaten editörün içine geldiyse tekrar fokuslama
    if (wrapperRef.current && !wrapperRef.current.querySelector(".bn-editor")?.contains(e.target as Node)) {
      try { editor.focus(); } catch { /* ignore */ }
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="flex-1 rounded-lg min-h-[360px] overflow-auto cp-blocknote-wrapper cursor-text"
      style={{
        background: "var(--surface-raised)",
        border: "0.5px solid var(--border-default)",
      }}
      onClick={handleWrapperClick}
    >
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme="light"
      />
    </div>
  );
}
