"use client";

// Okul blokları — notun içine gömülen canlı, bağlı veri.
//
// Metne link yapıştırmakla bunun farkı şu: blok kendi kimliğini taşıyor.
// Kazanımı notta işaretlediğinde panel bunu görebiliyor, soruyu notta
// çözdüğünde deneme kaydediliyor. Blok içeriği metin olarak da duruyor ki
// not kendi başına okunabilir kalsın — veri kaybolursa not boşalmasın.

import { createReactBlockSpec } from "@blocknote/react";
import { Check, FileText, Headphones, Video } from "lucide-react";

const kutu = {
  borderRadius: "10px",
  padding: "10px 12px",
  background: "var(--surface-sunken)",
  margin: "4px 0",
} as const;

/** Kazanım: konunun öğrenme hedefi. İşaretlenmesi ilerlemeye sayılır. */
export const KazanimBlock = createReactBlockSpec(
  {
    type: "kazanim",
    propSchema: {
      outcomeId: { default: "" },
      unitId: { default: "" },
      metin: { default: "" },
      checked: { default: false },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { metin, checked } = block.props;
      return (
        <div style={{ ...kutu, display: "flex", gap: 10, alignItems: "flex-start" }} data-kazanim={block.props.outcomeId}>
          <button
            type="button"
            onClick={() => editor.updateBlock(block, { props: { checked: !checked } })}
            aria-pressed={checked}
            aria-label={checked ? "Kazanımı işaretlemeyi kaldır" : "Kazanımı öğrendim olarak işaretle"}
            style={{
              flexShrink: 0, width: 18, height: 18, marginTop: 2, borderRadius: 5, cursor: "pointer",
              border: checked ? "none" : "1.5px solid var(--border-default)",
              background: checked ? "var(--priority-low-text)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {checked && <Check size={12} color="white" strokeWidth={3} />}
          </button>
          <span style={{
            fontSize: 13, lineHeight: 1.45,
            color: checked ? "var(--text-tertiary)" : "var(--text-primary)",
            textDecoration: checked ? "line-through" : "none",
          }}>
            {metin || "Kazanım metni yok"}
          </span>
        </div>
      );
    },
  },
);

/** Materyal: kitap bölümü, ses metni ya da video. Tek tıkla açılır. */
export const MateryalBlock = createReactBlockSpec(
  {
    type: "materyal",
    propSchema: {
      moduleId: { default: "" },
      ad: { default: "" },
      etiket: { default: "Dosya" },
      url: { default: "" },
      dakika: { default: 0 },
    },
    content: "none",
  },
  {
    render: ({ block }) => {
      const { ad, etiket, url, dakika } = block.props;
      const Ikon = etiket === "Video" ? Video : etiket === "Ses" ? Headphones : FileText;
      const govde = (
        <>
          <Ikon size={15} style={{ flexShrink: 0, color: "var(--tag-school-text)" }} />
          <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{ad || "Materyal"}</span>
          {dakika > 0 && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{dakika} dk</span>}
        </>
      );
      return url ? (
        <a href={url} target="_blank" rel="noreferrer"
           style={{ ...kutu, display: "flex", gap: 10, alignItems: "center", textDecoration: "none", color: "var(--text-primary)" }}>
          {govde}
        </a>
      ) : (
        <div style={{ ...kutu, display: "flex", gap: 10, alignItems: "center" }}>{govde}</div>
      );
    },
  },
);

/** Çıkmış soru: notun içinde çözülür, doğru/yanlış anında görünür. */
export const SoruBlock = createReactBlockSpec(
  {
    type: "soru",
    propSchema: {
      questionId: { default: "" },
      govde: { default: "" },
      // Şıklar JSON dizesi olarak taşınıyor: blok prop'ları düz değer kabul ediyor.
      secenekler: { default: "[]" },
      dogru: { default: "" },
      verilen: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const { govde, dogru, verilen } = block.props;
      let secenekler: { harf: string; metin: string }[] = [];
      try { secenekler = JSON.parse(block.props.secenekler || "[]"); } catch { secenekler = []; }
      const cevaplandi = Boolean(verilen);
      return (
        <div style={{ ...kutu }} data-soru={block.props.questionId}>
          <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.45, margin: "0 0 8px" }}>{govde || "Soru metni yok"}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {secenekler.map((s) => {
              const secili = verilen === s.harf;
              const dogruSik = cevaplandi && s.harf === dogru;
              return (
                <button
                  key={s.harf}
                  type="button"
                  disabled={cevaplandi}
                  onClick={() => editor.updateBlock(block, { props: { verilen: s.harf } })}
                  style={{
                    textAlign: "left", fontSize: 12, lineHeight: 1.4, padding: "6px 9px", borderRadius: 7, border: "none",
                    cursor: cevaplandi ? "default" : "pointer",
                    background: dogruSik ? "var(--priority-low-bg)" : secili ? "var(--priority-high-bg)" : "var(--surface-raised)",
                    color: dogruSik ? "var(--priority-low-text)" : secili ? "var(--priority-high-text)" : "var(--text-primary)",
                  }}
                >
                  <strong style={{ marginRight: 6 }}>{s.harf})</strong>{s.metin}
                </button>
              );
            })}
          </div>
          {cevaplandi && (
            <p style={{ fontSize: 11, margin: "8px 0 0", color: verilen === dogru ? "var(--priority-low-text)" : "var(--priority-high-text)" }}>
              {verilen === dogru ? "Doğru." : `Yanlış — doğrusu ${dogru}.`}
            </p>
          )}
        </div>
      );
    },
  },
);
