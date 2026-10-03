// pdf.js 5.6, tarayıcılara 2025-26'da gelen `Map.prototype.getOrInsertComputed`
// (ve `getOrInsert`) yöntemlerini kullanıyor. Bu yöntemi bilmeyen tarayıcıda
// sayfa çizilmiyor, beyaz kalıyordu (3 Ekim, PDF çalışma alanı denemesinde
// bulundu). Yoksa ekle. Aynı metin işçi dosyasının başına da eklenir
// (scripts/pdf-worker-kopyala.mjs) — işçi ayrı bir ortamda çalışıyor.

let kuruldu = false;
export function pdfPolyfill(): void {
  if (kuruldu || typeof window === "undefined") return;
  kuruldu = true;
  for (const S of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
    if (!S.prototype.getOrInsert) {
      S.prototype.getOrInsert = function (this: Map<unknown, unknown>, k: unknown, v: unknown) { if (!this.has(k)) this.set(k, v); return this.get(k); };
    }
    if (!S.prototype.getOrInsertComputed) {
      S.prototype.getOrInsertComputed = function (this: Map<unknown, unknown>, k: unknown, f: (k: unknown) => unknown) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); };
    }
  }
}
