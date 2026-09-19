import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { EzberKartiBlock, KazanimBlock, MateryalBlock, SoruBlock } from "./school-blocks";

/**
 * Editörün blok şeması.
 *
 * Özel bloklar HER editörde kayıtlı olmak zorunda: şemada olmayan bir blok
 * tipi içeren not açıldığında BlockNote çöküyor. Bu yüzden şema tek yerde
 * tanımlanıp her kullanıma buradan veriliyor.
 */
export const okulSemasi = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // 0.54'te createReactBlockSpec spec değil fabrika döndürüyor; çağrılmalı.
    kazanim: KazanimBlock(),
    materyal: MateryalBlock(),
    soru: SoruBlock(),
    ezberKarti: EzberKartiBlock(),
  },
});

export type OkulSemasi = typeof okulSemasi;
