// PDF'in düz metni, tarayıcıda (9 Kasım: sınav giriş belgesi). Dosya cihazdan çıkmaz.
//
// `getTextContent` kullanılmaz: pdf.js onu `for await (… of ReadableStream)` ile
// yazıyor, Safari (Dock'taki uygulama) akışı böyle gezemiyor ve okuma düşüyordu
// (9 Kasım). Akış `getReader()` ile elle okunur — PdfReader'ın yazı katmanı da
// `streamTextContent` kullanıyor.

import { pdfPolyfill } from "./pdf-polyfill";

type MetinParcasi = { str?: string; hasEOL?: boolean };

/** Bir sayfanın metin akışını satır sonlarıyla düz metne çevirir. */
export async function akisMetni(akis: ReadableStream<{ items: MetinParcasi[] }>): Promise<string> {
  const okuyucu = akis.getReader();
  let metin = "";
  for (;;) {
    const { done, value } = await okuyucu.read();
    if (done) break;
    for (const x of value.items) metin += (x.str ?? "") + (x.hasEOL ? "\n" : " ");
  }
  return metin;
}

export async function pdfMetni(dosya: File): Promise<string> {
  pdfPolyfill();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker-${pdfjs.version}.min.mjs`;
  const belge = await pdfjs.getDocument({ data: new Uint8Array(await dosya.arrayBuffer()) }).promise;
  let metin = "";
  for (let i = 1; i <= belge.numPages; i++) {
    const sayfa = await belge.getPage(i);
    metin += (await akisMetni(sayfa.streamTextContent() as unknown as ReadableStream<{ items: MetinParcasi[] }>)) + "\n";
  }
  await belge.destroy();
  return metin;
}
