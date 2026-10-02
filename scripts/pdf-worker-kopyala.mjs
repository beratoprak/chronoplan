// pdf.js işçisini public/ altına sürümüyle birlikte kopyalar.
//
// Neden: işçinin adresi `new URL("pdfjs-dist/...", import.meta.url)` ile
// kuruluyordu. Webpack bu .mjs dosyasını "javascript/auto" kuralıyla
// işlediği için import.meta.url çözülmüyor, adres kurulurken
// "e.replace is not a function" hatası çıkıyor ve okuyucu "PDF yükleniyor…"da
// takılı kalıyordu (2 Ekim canlı testinde bulundu). Sabit bir adresten sunmak
// derleyicinin işin içine girmesini tümüyle kaldırıyor. Dosya adındaki sürüm,
// pdfjs güncellenince tarayıcı önbelleğinin eski işçiyi vermesini engelliyor.
import { copyFileSync, readFileSync, readdirSync, unlinkSync } from "node:fs";

const { version } = JSON.parse(readFileSync("node_modules/pdfjs-dist/package.json", "utf8"));
const hedef = `pdf.worker-${version}.min.mjs`;
for (const eski of readdirSync("public").filter((f) => /^pdf\.worker-.*\.min\.mjs$/.test(f) && f !== hedef)) {
  unlinkSync(`public/${eski}`);
}
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", `public/${hedef}`);
console.log(`pdf.js işçisi → public/${hedef}`);
