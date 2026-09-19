import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

/**
 * İstemci ilk kullanımda kurulur.
 *
 * Modül yüklenirken kurmak gizli bir bağımlılık yaratıyordu: supabase-js
 * açılışta bir realtime istemcisi örnekliyor ve o da WebSocket arıyor.
 * Node 20'de WebSocket global değil, bu yüzden supabase'e hiç dokunmayan
 * saf yardımcıları test etmek bile çöküyordu. Tembel kurulum bunu keser ve
 * tarayıcıda davranışı değiştirmez.
 */
let istemci: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!istemci) istemci = createClient(supabaseUrl, supabaseAnonKey);
  return istemci;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_hedef, ozellik) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const deger = client[ozellik];
    return typeof deger === "function" ? (deger as (...a: unknown[]) => unknown).bind(client) : deger;
  },
});

/** Gerçek Supabase ortam değişkenleri tanımlıysa true döner */
export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
