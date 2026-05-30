"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Trash2, Copy, Check, ExternalLink } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Reference, ReferenceType, CitationStyle } from "@/types";

const REF_TYPE_LABELS: Record<ReferenceType, string> = {
  article: "Makale",
  book: "Kitap",
  chapter: "Bölüm",
  thesis: "Tez",
  conference: "Konferans",
  website: "Web",
  other: "Diğer",
};

const REF_TYPE_COLORS: Record<ReferenceType, string> = {
  article: "var(--tag-work)",
  book: "var(--tag-project)",
  chapter: "var(--tag-meeting)",
  thesis: "var(--tag-personal)",
  conference: "#8B5CF6",
  website: "#6B7280",
  other: "var(--text-muted)",
};

function formatCitation(ref: Reference, style: CitationStyle): string {
  const authors = ref.authors.length > 0 ? ref.authors : ["Yazar Yok"];
  const year = ref.year ? `(${ref.year})` : "";
  const title = ref.title;
  const journal = ref.journal || "";
  const vol = ref.volume ? `${ref.volume}` : "";
  const issue = ref.issue ? `(${ref.issue})` : "";
  const pages = ref.pages ? `, ${ref.pages}` : "";
  const doi = ref.doi ? ` https://doi.org/${ref.doi}` : ref.url ? ` ${ref.url}` : "";

  if (style === "apa") {
    const authStr = authors.length > 1
      ? authors.slice(0, -1).join(", ") + ", & " + authors[authors.length - 1]
      : authors[0];
    if (ref.type === "article") {
      return `${authStr} ${year}. ${title}. *${journal}*, ${vol}${issue}${pages}.${doi}`;
    }
    if (ref.type === "book") {
      return `${authStr} ${year}. *${title}*. ${ref.publisher || ""}${doi}`;
    }
    return `${authStr} ${year}. ${title}.${doi}`;
  }

  if (style === "chicago") {
    const authStr = authors.join(", ");
    if (ref.type === "article") {
      return `${authStr}. "${title}." *${journal}* ${vol}${issue} ${year}${pages}.${doi}`;
    }
    return `${authStr}. *${title}*. ${ref.publisher || ""}, ${ref.year || ""}.`;
  }

  if (style === "ieee") {
    const authStr = authors.map((a) => {
      const parts = a.split(", ");
      return parts.length > 1 ? `${parts[1].charAt(0)}. ${parts[0]}` : a;
    }).join(", ");
    if (ref.type === "article") {
      return `${authStr}, "${title}," *${journal}*, vol. ${vol}, no. ${ref.issue || "-"}, pp. ${ref.pages || "-"}, ${ref.year || ""}.`;
    }
    return `${authStr}, *${title}*, ${ref.publisher || ""}, ${ref.year || ""}`;
  }

  // MLA
  const authStr = authors.length > 1 ? `${authors[0]}, et al.` : authors[0];
  if (ref.type === "article") {
    return `${authStr}. "${title}." *${journal}*, vol. ${vol}, no. ${ref.issue || ""}, ${ref.year || ""}, pp. ${ref.pages || ""}.${doi}`;
  }
  return `${authStr}. *${title}*. ${ref.publisher || ""}, ${ref.year || ""}.`;
}

function AddRefModal({ onClose, onAdd }: { onClose: () => void; onAdd: (r: Omit<Reference, "id" | "createdAt" | "updatedAt">) => void }) {
  const [type, setType] = useState<ReferenceType>("article");
  const [title, setTitle] = useState("");
  const [authorsRaw, setAuthorsRaw] = useState(""); // "Soyadı, Ad; Soyadı2, Ad2"
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  const [publisher, setPublisher] = useState("");
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  const [abstract, setAbstract] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  function submit() {
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      authors: authorsRaw.split(";").map((a) => a.trim()).filter(Boolean),
      year: year ? parseInt(year) : undefined,
      journal: journal.trim() || undefined,
      volume: volume.trim() || undefined,
      issue: issue.trim() || undefined,
      pages: pages.trim() || undefined,
      publisher: publisher.trim() || undefined,
      doi: doi.trim() || undefined,
      url: url.trim() || undefined,
      abstract: abstract.trim() || undefined,
      notes: notes.trim() || undefined,
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
    });
    onClose();
  }

  const inputStyle = {
    background: "var(--surface-sunken)",
    border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Kaynak Ekle</h3>

        {/* Type */}
        <div className="flex flex-wrap gap-1">
          {(Object.keys(REF_TYPE_LABELS) as ReferenceType[]).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-all"
              style={{ background: type === t ? REF_TYPE_COLORS[t] : "var(--surface-sunken)", color: type === t ? "#fff" : "var(--text-secondary)" }}>
              {REF_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Başlık *" className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
          <input value={authorsRaw} onChange={(e) => setAuthorsRaw(e.target.value)}
            placeholder='Yazarlar (Soyadı, Ad; Soyadı2, Ad2)' className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
          <div className="grid grid-cols-2 gap-2">
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Yıl" type="number"
              className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
            {(type === "article" || type === "chapter" || type === "conference") && (
              <input value={journal} onChange={(e) => setJournal(e.target.value)}
                placeholder={type === "article" ? "Dergi" : type === "conference" ? "Konferans" : "Kitap adı"}
                className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
            )}
            {(type === "book" || type === "thesis") && (
              <input value={publisher} onChange={(e) => setPublisher(e.target.value)}
                placeholder={type === "book" ? "Yayınevi" : "Üniversite"}
                className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
            )}
          </div>
          {(type === "article" || type === "conference") && (
            <div className="grid grid-cols-3 gap-2">
              <input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="Cilt"
                className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
              <input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Sayı"
                className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
              <input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Sayfalar"
                className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
            </div>
          )}
          <input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="DOI (10.xxxx/...)"
            className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL"
            className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
          <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder="Özet..."
            rows={2} className="px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kişisel notlar..."
            rows={2} className="px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
          <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="Etiketler (virgülle ayır)"
            className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg"
            style={{ color: "var(--text-secondary)", background: "var(--surface-sunken)" }}>İptal</button>
          <button onClick={submit} disabled={!title.trim()}
            className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40"
            style={{ background: "var(--brand-gold)", color: "#fff" }}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function RefCard({ ref: r, style }: { ref: Reference; style: CitationStyle }) {
  const { deleteReference } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [showAbstract, setShowAbstract] = useState(false);

  const citation = formatCitation(r, style);

  function copyCitation() {
    navigator.clipboard.writeText(citation.replace(/\*/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group rounded-xl p-3.5 flex flex-col gap-2 transition-all"
      style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col flex-1 min-w-0 gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: REF_TYPE_COLORS[r.type] + "22", color: REF_TYPE_COLORS[r.type] }}>
              {REF_TYPE_LABELS[r.type]}
            </span>
            {r.tags.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}>{t}</span>
            ))}
          </div>
          <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>{r.title}</p>
          {r.authors.length > 0 && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {r.authors.join("; ")} {r.year && `· ${r.year}`}
            </p>
          )}
          {r.journal && (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
              {r.journal}{r.volume && `, ${r.volume}`}{r.issue && `(${r.issue})`}{r.pages && `, s. ${r.pages}`}
            </p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {r.doi && (
            <button onClick={() => window.open(`https://doi.org/${r.doi}`, "_blank")}
              className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }} title="DOI aç">
              <ExternalLink size={12} />
            </button>
          )}
          <button onClick={copyCitation} className="p-1 rounded hover:opacity-70"
            style={{ color: copied ? "var(--tag-project)" : "var(--text-muted)" }} title="Atıf kopyala">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <button onClick={() => deleteReference(r.id)} className="p-1 rounded hover:opacity-70"
            style={{ color: "var(--text-muted)" }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Citation preview */}
      <div className="text-[11px] px-3 py-2 rounded-lg leading-relaxed"
        style={{ background: "var(--surface-sunken)", color: "var(--text-secondary)", fontFamily: "Georgia, serif" }}>
        {citation.replace(/\*/g, "")}
      </div>

      {r.abstract && (
        <div>
          <button onClick={() => setShowAbstract((v) => !v)}
            className="text-[10px] underline" style={{ color: "var(--text-muted)" }}>
            {showAbstract ? "Özeti gizle" : "Özeti göster"}
          </button>
          {showAbstract && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r.abstract}</p>
          )}
        </div>
      )}
      {r.notes && (
        <p className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>📝 {r.notes}</p>
      )}
    </div>
  );
}

export function ReferencesView() {
  const { references, addReference } = useAppStore();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ReferenceType | "all">("all");
  const [citStyle, setCitStyle] = useState<CitationStyle>("apa");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return references.filter((r) => {
      const matchType = filterType === "all" || r.type === filterType;
      const matchSearch = !q || r.title.toLowerCase().includes(q)
        || r.authors.some((a) => a.toLowerCase().includes(q))
        || r.tags.some((t) => t.toLowerCase().includes(q))
        || (r.journal || "").toLowerCase().includes(q);
      return matchType && matchSearch;
    });
  }, [references, search, filterType]);

  return (
    <div className="flex flex-col gap-4 h-full animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Kaynaklarda ara..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg outline-none"
            style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)", color: "var(--text-primary)" }} />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterType("all")}
            className="text-[10px] px-2 py-1 rounded-full"
            style={{ background: filterType === "all" ? "var(--brand-gold)" : "var(--surface-raised)", color: filterType === "all" ? "#fff" : "var(--text-muted)" }}>
            Tümü ({references.length})
          </button>
          {(Object.keys(REF_TYPE_LABELS) as ReferenceType[]).map((t) => {
            const count = references.filter((r) => r.type === t).length;
            if (count === 0) return null;
            return (
              <button key={t} onClick={() => setFilterType(t)}
                className="text-[10px] px-2 py-1 rounded-full"
                style={{ background: filterType === t ? REF_TYPE_COLORS[t] : "var(--surface-raised)", color: filterType === t ? "#fff" : "var(--text-muted)" }}>
                {REF_TYPE_LABELS[t]} ({count})
              </button>
            );
          })}
        </div>

        {/* Citation style */}
        <div className="flex gap-1 ml-auto">
          {(["apa", "chicago", "ieee", "mla"] as CitationStyle[]).map((s) => (
            <button key={s} onClick={() => setCitStyle(s)}
              className="text-[10px] px-2 py-1 rounded-full uppercase font-mono"
              style={{ background: citStyle === s ? "var(--brand-gold)" : "var(--surface-raised)", color: citStyle === s ? "#fff" : "var(--text-muted)" }}>
              {s}
            </button>
          ))}
        </div>

        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium hover:opacity-80"
          style={{ background: "var(--brand-gold)", color: "#fff" }}>
          <Plus size={13} />
          Kaynak Ekle
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {references.length === 0 ? "Henüz kaynak eklenmedi. + butonuyla başla." : "Eşleşen kaynak yok."}
            </p>
          </div>
        ) : (
          filtered.map((r) => <RefCard key={r.id} ref={r} style={citStyle} />)
        )}
      </div>

      {showAdd && <AddRefModal onClose={() => setShowAdd(false)} onAdd={addReference} />}
    </div>
  );
}
