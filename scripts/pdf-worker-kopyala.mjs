// pdf.js işçisini public/ altına sürümüyle birlikte kopyalar.
//
// Neden: işçinin adresi `new URL("pdfjs-dist/...", import.meta.url)` ile
// kuruluyordu. Webpack bu .mjs dosyasını "javascript/auto" kuralıyla
// işlediği için import.meta.url çözülmüyor, adres kurulurken
// "e.replace is not a function" hatası çıkıyor ve okuyucu "PDF yükleniyor…"da
// takılı kalıyordu (2 Ekim canlı testinde bulundu). Sabit bir adresten sunmak
// derleyicinin işin içine girmesini tümüyle kaldırıyor. Dosya adındaki sürüm,
// pdfjs güncellenince tarayıcı önbelleğinin eski işçiyi vermesini engelliyor.
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("node_modules/pdfjs-dist/package.json", "utf8"));
const hedef = `pdf.worker-${version}.min.mjs`;
for (const eski of readdirSync("public").filter((f) => /^pdf\.worker-.*\.min\.mjs$/.test(f) && f !== hedef)) {
  unlinkSync(`public/${eski}`);
}
// İşçinin başına Map.getOrInsertComputed yaması (src/lib/pdf-polyfill.ts ile aynı):
// bu yöntemi bilmeyen tarayıcıda işçi çöküyor, sayfa beyaz kalıyordu.
const yama = `(()=>{for(const S of [Map,WeakMap]){if(!S.prototype.getOrInsert)S.prototype.getOrInsert=function(k,v){if(!this.has(k))this.set(k,v);return this.get(k)};if(!S.prototype.getOrInsertComputed)S.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k)}}})();\n`;
writeFileSync(`public/${hedef}`, yama + readFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "utf8"));
console.log(`pdf.js işçisi → public/${hedef}`);
