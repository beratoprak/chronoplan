"use client";

import { useEffect, useMemo, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useAppStore } from "@/lib/store";
import { bloklariOku, bloklariYaz, type NoteBlock } from "@/lib/note-content";

interface Props {
  /** Ham not içeriği — blok JSON'ı ya da eski düz metin. Biçim okunurken seziliyor. */
  content: string;
  /** Düzenleme sırasında her değişiklikte çağrılır; çağıran erteleyip kaydeder. */
  onChange: (content: string) => void;
  /** Aynı notta kalırken yeniden kurulumu engellemek için not kimliği. */
  noteId: string;
  editable?: boolean;
}

export function BlockEditor({ content, onChange, noteId, editable = true }: Props) {
  const theme = useAppStore((s) => s.theme);
  // İlk içerik yalnızca not değiştiğinde yeniden okunur: her tuş vuruşunda
  // editörü yeniden kurmak imleci başa atar ve yazmayı imkânsız kılar.
  const initialContent = useMemo(() => bloklariOku(content) as NoteBlock[], [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote({ initialContent: initialContent as never }, [noteId]);
  const sonYazilan = useRef(content);

  useEffect(() => {
    editor.isEditable = editable;
  }, [editor, editable]);

  // Not dışarıdan değiştiyse (başka cihazdan senkron) editörü tazele; kendi
  // yazdığımız içerikte tazelemek imleci kaybettirir, o yüzden karşılaştırıyoruz.
  useEffect(() => {
    if (content === sonYazilan.current) return;
    sonYazilan.current = content;
    editor.replaceBlocks(editor.document, bloklariOku(content) as never);
  }, [content, editor]);

  return (
    <BlockNoteView
      editor={editor}
      theme={theme === "dark" ? "dark" : "light"}
      editable={editable}
      onChange={() => {
        const yazilan = bloklariYaz(editor.document as unknown as NoteBlock[]);
        sonYazilan.current = yazilan;
        onChange(yazilan);
      }}
    />
  );
}
