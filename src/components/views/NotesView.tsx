"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Search, Trash2, Pin, PinOff, Tag, X, Edit3 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates";
import type { RichNote } from "@/types";

function generateTagColor(tag: string): string {
  const colors = [
    "var(--tag-work)",
    "var(--tag-personal)",
    "var(--tag-project)",
    "var(--tag-meeting)",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function NotesView() {
  const { richNotes, addRichNote, updateRichNote, deleteRichNote } = useAppStore();

  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    richNotes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [richNotes]);

  const filtered = useMemo(() => {
    return richNotes
      .filter((n) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q));
        const matchTag = !filterTag || n.tags.includes(filterTag);
        return matchSearch && matchTag;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [richNotes, search, filterTag]);

  const selected = richNotes.find((n) => n.id === selectedId) || null;

  function openNote(note: RichNote) {
    if (isDirty && selectedId) saveCurrentNote();
    setSelectedId(note.id);
    setEditingTitle(note.title);
    setEditingContent(note.content);
    setEditingTags([...note.tags]);
    setIsDirty(false);
  }

  function saveCurrentNote() {
    if (!selectedId) return;
    updateRichNote(selectedId, {
      title: editingTitle || "Başlıksız",
      content: editingContent,
      tags: editingTags,
    });
    setIsDirty(false);
  }

  function handleContentChange(val: string) {
    setEditingContent(val);
    setIsDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCurrentNote(), 1500);
  }

  function handleTitleChange(val: string) {
    setEditingTitle(val);
    setIsDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCurrentNote(), 1500);
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,/g, "");
      if (!editingTags.includes(tag)) {
        const newTags = [...editingTags, tag];
        setEditingTags(newTags);
        updateRichNote(selectedId!, { tags: newTags });
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    const newTags = editingTags.filter((t) => t !== tag);
    setEditingTags(newTags);
    updateRichNote(selectedId!, { tags: newTags });
  }

  function createNote() {
    if (isDirty && selectedId) saveCurrentNote();
    addRichNote({ title: "Yeni Not", content: "", tags: [], pinned: false });
    setTimeout(() => {
      const latest = useAppStore.getState().richNotes[0];
      if (latest) openNote(latest);
    }, 50);
  }

  function togglePin(id: string) {
    const note = richNotes.find((n) => n.id === id);
    if (note) updateRichNote(id, { pinned: !note.pinned });
  }

  function handleDelete(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setIsDirty(false);
    }
    deleteRichNote(id);
  }

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentNote();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div
      className="flex h-full gap-0 rounded-xl overflow-hidden animate-fade-in"
      style={{ border: "0.5px solid var(--border-default)", background: "var(--surface-base)" }}
    >
      {/* Left panel — note list */}
      <div
        className="flex flex-col w-64 shrink-0 h-full"
        style={{ borderRight: "0.5px solid var(--border-default)", background: "var(--surface-sunken)" }}
      >
        {/* Search + New */}
        <div className="p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Notlarda ara..."
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md"
                style={{
                  background: "var(--surface-base)",
                  border: "0.5px solid var(--border-default)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            </div>
            <button
              onClick={createNote}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-opacity hover:opacity-80"
              style={{ background: "var(--brand-gold)", color: "#fff" }}
              title="Yeni not"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  className="text-[10px] px-1.5 py-0.5 rounded-full transition-opacity"
                  style={{
                    background: filterTag === tag ? generateTagColor(tag) : "var(--surface-raised)",
                    color: filterTag === tag ? "#fff" : "var(--text-secondary)",
                    border: `0.5px solid ${generateTagColor(tag)}`,
                    opacity: filterTag && filterTag !== tag ? 0.5 : 1,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-2 pb-2">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 py-8">
              <Edit3 size={24} style={{ color: "var(--text-muted)" }} />
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                {richNotes.length === 0 ? "Henüz not yok.\n+ ile başla." : "Eşleşen not bulunamadı."}
              </p>
            </div>
          )}
          {filtered.map((note) => (
            <div
              key={note.id}
              onClick={() => openNote(note)}
              className={cn(
                "group flex flex-col gap-0.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all",
                selectedId === note.id ? "ring-1" : "hover:opacity-90"
              )}
              style={{
                background: selectedId === note.id ? "var(--surface-raised)" : "transparent",
                outline: selectedId === note.id ? "1px solid var(--brand-gold)" : "none",
              }}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className="text-xs font-medium truncate flex-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {note.pinned && <span style={{ color: "var(--brand-gold)" }}>📌 </span>}
                  {note.title || "Başlıksız"}
                </span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(note.id); }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {note.pinned ? <PinOff size={10} /> : <Pin size={10} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] line-clamp-2" style={{ color: "var(--text-muted)" }}>
                {note.content || "Boş not"}
              </p>
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                {note.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-[9px] px-1 py-0.5 rounded-full"
                    style={{ background: generateTagColor(t) + "33", color: generateTagColor(t) }}
                  >
                    {t}
                  </span>
                ))}
                <span className="text-[9px] ml-auto" style={{ color: "var(--text-muted)" }}>
                  {formatDate(note.updatedAt, "d MMM")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — editor */}
      {selected ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Title */}
          <div className="px-6 pt-5 pb-2" style={{ borderBottom: "0.5px solid var(--border-default)" }}>
            <input
              value={editingTitle}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Başlık..."
              className="w-full text-xl font-semibold bg-transparent outline-none"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)",
              }}
            />
            {/* Tags row */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Tag size={11} style={{ color: "var(--text-muted)" }} />
              {editingTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: generateTagColor(tag) + "33", color: generateTagColor(tag) }}
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 opacity-60 hover:opacity-100">
                    <X size={9} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Etiket ekle..."
                className="text-[11px] bg-transparent outline-none"
                style={{ color: "var(--text-secondary)", minWidth: 80 }}
              />
            </div>
          </div>

          {/* Content */}
          <textarea
            ref={contentRef}
            value={editingContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Notunu buraya yaz... (Markdown desteklenir)"
            className="flex-1 resize-none bg-transparent outline-none px-6 py-4 text-sm leading-relaxed"
            style={{
              color: "var(--text-primary)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          />

          {/* Footer */}
          <div
            className="px-6 py-2 flex items-center justify-between"
            style={{ borderTop: "0.5px solid var(--border-default)" }}
          >
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {isDirty ? "Kaydediliyor..." : `Kaydedildi · ${formatDate(selected.updatedAt, "d MMM HH:mm")}`}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {editingContent.split(/\s+/).filter(Boolean).length} kelime
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Edit3 size={40} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Bir not seç veya yeni not oluştur
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Sol panelden bir nota tıkla ya da + butonuna bas
            </p>
          </div>
          <button
            onClick={createNote}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--brand-gold)", color: "#fff" }}
          >
            <Plus size={14} />
            Yeni Not
          </button>
        </div>
      )}
    </div>
  );
}
