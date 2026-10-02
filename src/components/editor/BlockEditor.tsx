"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { okulSemasi } from "./blocks/schema";
import { menuyuSuz, slashMenuOgeleri, type OkulBaglami } from "./blocks/slash-menu";
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
  /** Notun bağlı olduğu konu — eklenen ezber kartı dersini buradan alıyor. */
  okul?: OkulBaglami;
}

export function BlockEditor({ content, onChange, noteId, editable = true, okul }: Props) {
  const theme = useAppStore((s) => s.theme);
  // İlk içerik yalnızca not değiştiğinde yeniden okunur: her tuş vuruşunda
  // editörü yeniden kurmak imleci başa atar ve yazmayı imkânsız kılar.
  const initialContent = useMemo(() => bloklariOku(content) as NoteBlock[], [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Şema her editörde aynı olmak zorunda: kayıtlı olmayan bir blok tipi içeren
  // not açıldığında BlockNote çöküyor. Özel bloklar tek yerden veriliyor.
  const editor = useCreateBlockNote({ schema: okulSemasi, initialContent: initialContent as never }, [noteId]);
  const sonYazilan = useRef(content);
  /** Son tuş vuruşunun zamanı — yazarken dışarıdan tazeleme yapılmıyor. */
  const sonDokunus = useRef(0);

  useEffect(() => {
    editor.isEditable = editable;
  }, [editor, editable]);

  // Not dışarıdan değiştiyse (başka cihazdan senkron) editörü tazele.
  //
  // Bu tazeleme yazarken ASLA çalışmamalı: `replaceBlocks` tüm belgeyi
  // değiştiriyor, yani imleci kaybettiriyor ve o an yapılan blok bölmesini
  // (Enter) geri alıyordu. Bir tur eski bir `content` prop'u geldiğinde
  // yazdığın satır gözünün önünde birleşiyordu. Artık yalnız editör odakta
  // değilken ve son dokunuştan sonra sessizlik varken tazeleniyor.
  useEffect(() => {
    if (content === sonYazilan.current) return;
    const odakta = typeof document !== "undefined" && document.activeElement?.closest?.(".bn-editor");
    if (odakta || Date.now() - sonDokunus.current < 2000) return;
    sonYazilan.current = content;
    editor.replaceBlocks(editor.document, bloklariOku(content) as never);
  }, [content, editor]);

  const ogeler = useCallback(
    async (sorgu: string) => menuyuSuz(slashMenuOgeleri(editor as never, okul ?? {}), sorgu),
    [editor, okul],
  );

  return (
    <BlockNoteView
      editor={editor}
      theme={theme === "dark" ? "dark" : "light"}
      editable={editable}
      slashMenu={false}
      onChange={() => {
        sonDokunus.current = Date.now();
        const yazilan = bloklariYaz(editor.document as unknown as NoteBlock[]);
        sonYazilan.current = yazilan;
        onChange(yazilan);
      }}
    >
      {/* Varsayılan menü kapatılıp Türkçeleştirilmiş sürümü veriliyor;
          okul blokları da buradan ekleniyor. */}
      <SuggestionMenuController triggerCharacter="/" getItems={ogeler} />
    </BlockNoteView>
  );
}
