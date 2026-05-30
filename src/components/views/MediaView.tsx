"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Star, BookOpen, Film, ChevronDown, Scroll } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaType, MediaStatus } from "@/types";

const STATUS_LABELS: Record<MediaType, Record<MediaStatus, string>> = {
  book: { want: "Okunacak", in_progress: "Okunuyor", done: "Okundu" },
  movie: { want: "İzlenecek", in_progress: "İzleniyor", done: "İzlendi" },
  paper: { want: "Okunacak", in_progress: "Okunuyor", done: "Okundu" },
};

const STATUS_COLORS: Record<MediaStatus, string> = {
  want: "var(--text-muted)",
  in_progress: "var(--brand-gold)",
  done: "var(--tag-project)",
};

function StarRating({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star === value ? 0 : star)}
          style={{ color: (value || 0) >= star ? "#C8A951" : "var(--border-strong)" }}
          className="transition-colors hover:text-yellow-500"
        >
          <Star size={13} fill={(value || 0) >= star ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function AddItemModal({
  type,
  onClose,
  onAdd,
}: {
  type: MediaType;
  onClose: () => void;
  onAdd: (item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<MediaStatus>("want");

  function submit() {
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      author: type !== "movie" ? author.trim() || undefined : undefined,
      director: type === "movie" ? author.trim() || undefined : undefined,
      year: year ? parseInt(year) : undefined,
      notes: notes.trim() || undefined,
      status,
      rating: undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-80 rounded-xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {type === "book" ? "Kitap Ekle" : type === "movie" ? "Film Ekle" : "Makale Ekle"}
        </h3>

        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={type === "book" ? "Kitap adı..." : type === "movie" ? "Film adı..." : "Makale başlığı..."}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{
              background: "var(--surface-sunken)",
              border: "0.5px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={type === "book" ? "Yazar..." : type === "movie" ? "Yönetmen..." : "Yazar(lar)..."}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none"
            style={{
              background: "var(--surface-sunken)",
              border: "0.5px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex gap-2">
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Yıl"
              type="number"
              className="w-24 px-3 py-2 text-sm rounded-lg outline-none"
              style={{
                background: "var(--surface-sunken)",
                border: "0.5px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaStatus)}
              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
              style={{
                background: "var(--surface-sunken)",
                border: "0.5px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {Object.entries(STATUS_LABELS[type]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Not (opsiyonel)..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg outline-none resize-none"
            style={{
              background: "var(--surface-sunken)",
              border: "0.5px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg"
            style={{ color: "var(--text-secondary)", background: "var(--surface-sunken)" }}
          >
            İptal
          </button>
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40"
            style={{ background: "var(--brand-gold)", color: "#fff" }}
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  const { updateMediaItem, deleteMediaItem } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(item.notes || "");

  const statusLabels = STATUS_LABELS[item.type];

  return (
    <div
      className="flex flex-col rounded-xl p-3 gap-2 group transition-all"
      style={{
        background: "var(--surface-raised)",
        border: "0.5px solid var(--border-default)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col flex-1 gap-0.5 min-w-0">
          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {item.title}
          </span>
          {(item.author || item.director) && (
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {item.author || item.director}
              {item.year && ` · ${item.year}`}
            </span>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <select
              value={item.status}
              onChange={(e) => updateMediaItem(item.id, { status: e.target.value as MediaStatus })}
              className="text-[10px] px-1.5 py-0.5 rounded-full border-0 outline-none cursor-pointer"
              style={{
                background: STATUS_COLORS[item.status] + "22",
                color: STATUS_COLORS[item.status],
              }}
            >
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <StarRating
              value={item.rating}
              onChange={(v) => updateMediaItem(item.id, { rating: v })}
            />
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded-md hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
          </button>
          <button
            onClick={() => deleteMediaItem(item.id)}
            className="p-1 rounded-md hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <textarea
          value={editingNotes}
          onChange={(e) => setEditingNotes(e.target.value)}
          onBlur={() => updateMediaItem(item.id, { notes: editingNotes.trim() || undefined })}
          placeholder="Not ekle..."
          rows={2}
          className="text-xs resize-none rounded-lg px-2.5 py-2 outline-none"
          style={{
            background: "var(--surface-sunken)",
            border: "0.5px solid var(--border-default)",
            color: "var(--text-secondary)",
          }}
        />
      )}
    </div>
  );
}

function MediaColumn({
  type,
  items,
  onAdd,
}: {
  type: MediaType;
  items: MediaItem[];
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<MediaStatus | "all">("all");

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);
  const Icon = type === "book" ? BookOpen : type === "movie" ? Film : Scroll;
  const label = type === "book" ? "Kitaplar" : type === "movie" ? "Filmler" : "Makaleler";
  const statusLabels = STATUS_LABELS[type];

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-xl"
        style={{ background: "var(--surface-sunken)", borderBottom: "0.5px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          <Icon size={15} style={{ color: "var(--brand-gold)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {label}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-opacity hover:opacity-80"
          style={{ background: "var(--brand-gold)", color: "#fff" }}
        >
          <Plus size={12} />
          Ekle
        </button>
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-1 px-3 py-2"
        style={{ background: "var(--surface-sunken)", borderBottom: "0.5px solid var(--border-default)" }}
      >
        {(["all", "want", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn("text-[10px] px-2 py-0.5 rounded-full transition-all")}
            style={{
              background: filter === s ? "var(--brand-gold)" : "var(--surface-raised)",
              color: filter === s ? "#fff" : "var(--text-muted)",
            }}
          >
            {s === "all" ? "Tümü" : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Items */}
      <div
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 rounded-b-xl"
        style={{ background: "var(--surface-base)" }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Icon size={32} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {items.length === 0 ? `Henüz ${label.toLowerCase()} eklenmedi` : "Eşleşen öğe yok"}
            </p>
          </div>
        ) : (
          filtered.map((item) => <MediaCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

export function MediaView() {
  const { mediaItems, addMediaItem } = useAppStore();
  const [addingType, setAddingType] = useState<MediaType | null>(null);

  const books = useMemo(() => mediaItems.filter((m) => m.type === "book"), [mediaItems]);
  const movies = useMemo(() => mediaItems.filter((m) => m.type === "movie"), [mediaItems]);
  const papers = useMemo(() => mediaItems.filter((m) => m.type === "paper"), [mediaItems]);

  return (
    <div className="flex gap-3 h-full animate-fade-in">
      <MediaColumn type="book" items={books} onAdd={() => setAddingType("book")} />
      <MediaColumn type="movie" items={movies} onAdd={() => setAddingType("movie")} />
      <MediaColumn type="paper" items={papers} onAdd={() => setAddingType("paper")} />

      {addingType && (
        <AddItemModal
          type={addingType}
          onClose={() => setAddingType(null)}
          onAdd={addMediaItem}
        />
      )}
    </div>
  );
}
