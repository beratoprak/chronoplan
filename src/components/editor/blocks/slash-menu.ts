// "/" menüsü — Türkçe etiketler ve okul blokları.
//
// Özel bloklar şemaya kayıtlıydı ama menüye hiç eklenmemişti: kullanıcı elle
// ezber kartı ekleyemiyordu, dolayısıyla tekrar sırası hiç dolmuyordu. Menü
// ayrıca tümüyle İngilizceydi; Türkçe bir uygulamada "Heading 1" aramak için
// kullanıcının kelimeyi bilmesi gerekiyordu.

import { getDefaultReactSlashMenuItems, type DefaultReactSuggestionItem } from "@blocknote/react";
import type { okulSemasi } from "./schema";

type Editor = Parameters<typeof getDefaultReactSlashMenuItems<typeof okulSemasi.blockSchema, typeof okulSemasi.inlineContentSchema, typeof okulSemasi.styleSchema>>[0];

/** Varsayılan öğelerin Türkçe adı ve ek arama sözcükleri. */
const TURKCE: Record<string, { baslik: string; grup: string; anahtar: string[] }> = {
  "Heading 1": { baslik: "Başlık 1", grup: "Başlıklar", anahtar: ["baslik", "başlık", "h1"] },
  "Heading 2": { baslik: "Başlık 2", grup: "Başlıklar", anahtar: ["baslik", "başlık", "h2", "bolum", "bölüm"] },
  "Heading 3": { baslik: "Başlık 3", grup: "Başlıklar", anahtar: ["baslik", "başlık", "h3", "alt"] },
  "Numbered List": { baslik: "Numaralı liste", grup: "Temel", anahtar: ["liste", "numara", "sirali", "sıralı"] },
  "Bullet List": { baslik: "Madde listesi", grup: "Temel", anahtar: ["liste", "madde", "nokta"] },
  "Check List": { baslik: "Yapılacak listesi", grup: "Temel", anahtar: ["kutucuk", "yapilacak", "yapılacak", "todo", "onay"] },
  "Paragraph": { baslik: "Paragraf", grup: "Temel", anahtar: ["metin", "yazi", "yazı"] },
  "Quote": { baslik: "Alıntı", grup: "Temel", anahtar: ["alinti", "alıntı", "blok"] },
  "Toggle List": { baslik: "Katlanır liste", grup: "Temel", anahtar: ["katlanir", "katlanır", "ac", "aç", "gizle"] },
  "Table": { baslik: "Tablo", grup: "Temel", anahtar: ["tablo", "satir", "satır", "sutun", "sütun"] },
  "Image": { baslik: "Görsel", grup: "Medya", anahtar: ["gorsel", "görsel", "resim", "foto"] },
  "Video": { baslik: "Video", grup: "Medya", anahtar: ["video", "film"] },
  "Audio": { baslik: "Ses", grup: "Medya", anahtar: ["ses", "kayit", "kayıt"] },
  "File": { baslik: "Dosya", grup: "Medya", anahtar: ["dosya", "ek"] },
  "Emoji": { baslik: "Emoji", grup: "Medya", anahtar: ["emoji", "simge"] },
  "Code Block": { baslik: "Kod bloğu", grup: "Temel", anahtar: ["kod", "code"] },
};

function yeniKartId(): string {
  return `kart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Bloğu imlecin olduğu yere koyar.
 *
 * BlockNote'un kendi `insertOrUpdateBlock` yardımcısı paketin genel
 * girişinden dışa verilmiyor; aynı davranışı burada kuruyoruz: imleçteki blok
 * boş bir paragrafsa onun yerine geçer, değilse altına eklenir.
 */
function blokKoy(editor: Editor, blok: Record<string, unknown>): void {
  const imlec = editor.getTextCursorPosition();
  const mevcut = imlec.block as { id: string; type: string; content?: unknown };
  const bos = mevcut.type === "paragraph" &&
    (!Array.isArray(mevcut.content) || mevcut.content.length === 0);
  if (bos) {
    editor.replaceBlocks([mevcut.id] as never, [blok] as never);
  } else {
    editor.insertBlocks([blok] as never, mevcut.id as never, "after");
  }
}

/** Okul bloğu: ezber kartı. Kimliği ekleme anında veriliyor ki tekrar
 *  zamanlaması kartı takip edebilsin. */
function ezberKartiOgesi(editor: Editor, baglam: OkulBaglami): DefaultReactSuggestionItem {
  return {
    title: "Ezber kartı",
    subtext: "Ön yüz soru, arka yüz cevap. Tekrar sırasına girer.",
    aliases: ["ezber", "kart", "flashcard", "tekrar", "anki"],
    group: "Okul",
    onItemClick: () => {
      blokKoy(editor, {
        type: "ezberKarti",
        props: {
          cardId: yeniKartId(),
          on: "",
          arka: "",
          unitId: baglam.unitId ?? "",
          dersKodu: baglam.dersKodu ?? "",
        },
      });
    },
  };
}

export interface OkulBaglami {
  unitId?: string;
  dersKodu?: string;
}

/** Türkçeleştirilmiş varsayılan öğeler + okul blokları. */
export function slashMenuOgeleri(editor: Editor, baglam: OkulBaglami): DefaultReactSuggestionItem[] {
  const varsayilan = getDefaultReactSlashMenuItems(editor).map((oge) => {
    const tr = TURKCE[oge.title];
    if (!tr) return oge;
    return {
      ...oge,
      title: tr.baslik,
      group: tr.grup,
      // İngilizce adı da aranabilir kalsın: kas hafızası olan kaybolmasın.
      aliases: [...(oge.aliases ?? []), ...tr.anahtar, oge.title.toLowerCase()],
    };
  });
  return [ezberKartiOgesi(editor, baglam), ...varsayilan];
}

/** Yazılan sorguya göre süz — BlockNote'un kendi süzgeci başlığı ve aliasları tarar. */
export function menuyuSuz(ogeler: DefaultReactSuggestionItem[], sorgu: string): DefaultReactSuggestionItem[] {
  const q = sorgu.toLocaleLowerCase("tr-TR").trim();
  if (!q) return ogeler;
  return ogeler.filter((oge) =>
    oge.title.toLocaleLowerCase("tr-TR").includes(q) ||
    (oge.aliases ?? []).some((a) => a.toLocaleLowerCase("tr-TR").includes(q)),
  );
}
