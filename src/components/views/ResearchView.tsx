"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, ChevronRight, MapPin, Eye, Lightbulb, MessageSquare, ArrowLeft, BookMarked } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates";
import type { ResearchProject, ResearchStatus, FieldNote } from "@/types";

const STATUS_LABELS: Record<ResearchStatus, string> = {
  planning: "Planlama",
  active: "Aktif",
  writing: "Yazım",
  done: "Tamamlandı",
};

const STATUS_COLORS: Record<ResearchStatus, string> = {
  planning: "var(--text-muted)",
  active: "var(--brand-gold)",
  writing: "var(--tag-work)",
  done: "var(--tag-project)",
};

const NOTE_TYPE_ICONS = {
  observation: Eye,
  informative: Lightbulb,
  reflection: MessageSquare,
};

const NOTE_TYPE_LABELS = {
  observation: "Gözlem",
  informative: "Bilgi",
  reflection: "Yorum",
};

function NewProjectModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (p: Omit<ResearchProject, "id" | "createdAt" | "updatedAt">) => void;
}) {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  const inputStyle = {
    background: "var(--surface-sunken)",
    border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)",
  };

  function submit() {
    if (!title.trim() || !question.trim()) return;
    onAdd({
      title: title.trim(),
      question: question.trim(),
      hypothesis: hypothesis.trim() || undefined,
      description: description.trim() || undefined,
      status: "planning",
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      fieldNotes: [],
      referenceIds: [],
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl p-5 flex flex-col gap-4"
        style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Yeni Araştırma Projesi</h3>
        <div className="flex flex-col gap-3">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Proje başlığı *" className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="Araştırma sorusu *" rows={2} className="px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
          <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Hipotez (opsiyonel)" rows={2} className="px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama, metodoloji..." rows={2} className="px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
          <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="Etiketler (virgülle ayır)" className="px-3 py-2 text-sm rounded-lg outline-none" style={inputStyle} />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg"
            style={{ color: "var(--text-secondary)", background: "var(--surface-sunken)" }}>İptal</button>
          <button onClick={submit} disabled={!title.trim() || !question.trim()}
            className="px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-40"
            style={{ background: "var(--brand-gold)", color: "#fff" }}>Oluştur</button>
        </div>
      </div>
    </div>
  );
}

function FieldNoteItem({ note, onDelete }: { note: FieldNote; onDelete: () => void }) {
  const Icon = NOTE_TYPE_ICONS[note.noteType];
  return (
    <div className="group flex gap-2.5 p-3 rounded-lg"
      style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
      <Icon size={14} className="shrink-0 mt-0.5" style={{ color: "var(--brand-gold)" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-medium" style={{ color: "var(--brand-gold)" }}>
            {NOTE_TYPE_LABELS[note.noteType]}
          </span>
          {note.location && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <MapPin size={9} />{note.location}
            </span>
          )}
          <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
            {formatDate(note.createdAt, "d MMM HH:mm")}
          </span>
        </div>
        <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{note.content}</p>
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded shrink-0 self-start"
        style={{ color: "var(--text-muted)" }}>
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function AddFieldNoteForm({ onAdd }: { onAdd: (note: Omit<FieldNote, "id" | "createdAt">) => void }) {
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<FieldNote["noteType"]>("observation");
  const [location, setLocation] = useState("");

  const inputStyle = {
    background: "var(--surface-sunken)",
    border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)",
  };

  function submit() {
    if (!content.trim()) return;
    onAdd({ content: content.trim(), noteType, location: location.trim() || undefined });
    setContent("");
    setLocation("");
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl"
      style={{ background: "var(--surface-sunken)", border: "0.5px solid var(--border-default)" }}>
      <div className="flex gap-1.5">
        {(["observation", "informative", "reflection"] as const).map((t) => {
          const Icon = NOTE_TYPE_ICONS[t];
          return (
            <button key={t} onClick={() => setNoteType(t)}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full transition-all"
              style={{
                background: noteType === t ? "var(--brand-gold)" : "var(--surface-raised)",
                color: noteType === t ? "#fff" : "var(--text-muted)",
              }}>
              <Icon size={10} />
              {NOTE_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
        placeholder="Alan notu gir... (Cmd+Enter kaydeder)"
        rows={3} className="px-3 py-2 text-sm rounded-lg outline-none resize-none" style={inputStyle} />
      <div className="flex gap-2 items-center">
        <MapPin size={12} style={{ color: "var(--text-muted)" }} />
        <input value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="Konum (opsiyonel)"
          className="flex-1 px-2 py-1 text-xs rounded-lg outline-none" style={inputStyle} />
        <button onClick={submit} disabled={!content.trim()}
          className="px-3 py-1 text-xs rounded-lg font-medium disabled:opacity-40"
          style={{ background: "var(--brand-gold)", color: "#fff" }}>
          Ekle
        </button>
      </div>
    </div>
  );
}

function ProjectDetail({ project }: { project: ResearchProject }) {
  const { updateResearchProject, deleteResearchProject, addFieldNote, deleteFieldNote, references } = useAppStore();
  const [filterType, setFilterType] = useState<FieldNote["noteType"] | "all">("all");

  const projectRefs = useMemo(
    () => references.filter((r) => project.referenceIds.includes(r.id)),
    [references, project.referenceIds]
  );

  const filteredNotes = useMemo(
    () => filterType === "all" ? project.fieldNotes : project.fieldNotes.filter((n) => n.noteType === filterType),
    [project.fieldNotes, filterType]
  );

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <select value={project.status}
            onChange={(e) => updateResearchProject(project.id, { status: e.target.value as ResearchStatus })}
            className="text-[11px] px-2 py-1 rounded-full border-0 outline-none cursor-pointer font-medium"
            style={{ background: STATUS_COLORS[project.status] + "22", color: STATUS_COLORS[project.status] }}>
            {(Object.keys(STATUS_LABELS) as ResearchStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {project.tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--surface-raised)", color: "var(--text-muted)" }}>{t}</span>
          ))}
        </div>
        <div className="p-3 rounded-xl" style={{ background: "var(--surface-sunken)" }}>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Araştırma Sorusu</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{project.question}</p>
        </div>
        {project.hypothesis && (
          <div className="p-3 rounded-xl" style={{ background: "var(--surface-sunken)" }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Hipotez</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{project.hypothesis}</p>
          </div>
        )}
      </div>

      {/* Field Notes */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Alan Notları ({project.fieldNotes.length})
          </span>
          <div className="flex gap-1 ml-auto">
            {(["all", "observation", "informative", "reflection"] as const).map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: filterType === t ? "var(--brand-gold)" : "var(--surface-raised)", color: filterType === t ? "#fff" : "var(--text-muted)" }}>
                {t === "all" ? "Tümü" : NOTE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <AddFieldNoteForm onAdd={(note) => addFieldNote(project.id, note)} />
        <div className="flex flex-col gap-2">
          {filteredNotes.slice().reverse().map((note) => (
            <FieldNoteItem key={note.id} note={note}
              onDelete={() => deleteFieldNote(project.id, note.id)} />
          ))}
          {filteredNotes.length === 0 && (
            <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>
              Henüz alan notu yok
            </p>
          )}
        </div>
      </div>

      {/* Linked References */}
      {projectRefs.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Bağlı Kaynaklar ({projectRefs.length})
          </span>
          {projectRefs.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border-default)" }}>
              <BookMarked size={12} style={{ color: "var(--brand-gold)" }} />
              <span className="text-xs flex-1 truncate" style={{ color: "var(--text-primary)" }}>{r.title}</span>
              {r.year && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{r.year}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResearchView() {
  const { researchProjects, addResearchProject, deleteResearchProject } = useAppStore();
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = researchProjects.find((p) => p.id === selectedId) || null;

  return (
    <div className="flex gap-0 h-full rounded-xl overflow-hidden animate-fade-in"
      style={{ border: "0.5px solid var(--border-default)" }}>
      {/* Sidebar list */}
      <div className="flex flex-col w-64 shrink-0 h-full"
        style={{ borderRight: "0.5px solid var(--border-default)", background: "var(--surface-sunken)" }}>
        <div className="p-3 flex items-center justify-between"
          style={{ borderBottom: "0.5px solid var(--border-default)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            Araştırma Projeleri
          </span>
          <button onClick={() => setShowNew(true)}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-80"
            style={{ background: "var(--brand-gold)", color: "#fff" }}>
            <Plus size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 p-2">
          {researchProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 py-8 gap-2">
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                Henüz proje yok. + ile başla.
              </p>
            </div>
          )}
          {researchProjects.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={cn("group text-left flex flex-col gap-0.5 px-2.5 py-2 rounded-lg transition-all")}
              style={{
                background: selectedId === p.id ? "var(--surface-raised)" : "transparent",
                outline: selectedId === p.id ? "1px solid var(--brand-gold)" : "none",
              }}>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: STATUS_COLORS[p.status] }} />
                <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                  {p.title}
                </span>
                <button onClick={(e) => { e.stopPropagation(); deleteResearchProject(p.id); if (selectedId === p.id) setSelectedId(null); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                  style={{ color: "var(--text-muted)" }}>
                  <Trash2 size={10} />
                </button>
              </div>
              <p className="text-[10px] line-clamp-2 pl-2.5" style={{ color: "var(--text-muted)" }}>
                {p.question}
              </p>
              <div className="flex items-center gap-1 pl-2.5 mt-0.5">
                <span className="text-[9px]" style={{ color: STATUS_COLORS[p.status] }}>
                  {STATUS_LABELS[p.status]}
                </span>
                <span className="text-[9px] ml-auto" style={{ color: "var(--text-muted)" }}>
                  {p.fieldNotes.length} not
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto" style={{ background: "var(--surface-base)" }}>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-serif, Georgia, serif)" }}>
                {selected.title}
              </h2>
              {selected.description && (
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{selected.description}</p>
              )}
            </div>
          </div>
          <ProjectDetail project={selected} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: "var(--surface-base)" }}>
          <FlaskConical size={40} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Bir proje seç veya yeni proje oluştur
          </p>
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onAdd={addResearchProject} />}
    </div>
  );
}

function FlaskConical({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/>
      <path d="M8.5 2h7"/>
      <path d="M7 16h10"/>
    </svg>
  );
}
