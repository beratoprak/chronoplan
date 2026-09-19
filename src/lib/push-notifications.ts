import { isSupabaseConfigured, supabase } from "./supabase";

export type PushStatus = "unsupported" | "blocked" | "off" | "on" | "unconfigured";

function applicationServerKey(value: string): Uint8Array {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function encodeKey(value: ArrayBuffer | null): string {
  if (!value) return "";
  const bytes = new Uint8Array(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return window.btoa(binary);
}

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * serviceWorker.ready, kayıtlı worker yoksa hiç çözülmez ve arayüz sonsuza
 * kadar "işleniyor" durumunda kalır. Süre sınırı koyup anlaşılır hata veriyoruz.
 */
async function hazirWorker(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
  const zamanAsimi = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Service worker hazır değil. Sayfayı yenileyip tekrar deneyin.")), timeoutMs),
  );
  return Promise.race([navigator.serviceWorker.ready, zamanAsimi]);
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!supported()) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !isSupabaseConfigured) return "unconfigured";
  if (Notification.permission === "denied") return "blocked";
  const registration = await hazirWorker(4000).catch(() => null);
  if (!registration) return "off";
  return await registration.pushManager.getSubscription() ? "on" : "off";
}

export async function enablePush(userId: string): Promise<void> {
  if (!supported()) throw new Error("Bu tarayıcı bildirimleri desteklemiyor.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !isSupabaseConfigured) throw new Error("Bildirim servisi henüz yapılandırılmadı.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bildirim izni verilmedi.");
  const registration = await hazirWorker();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicKey) as BufferSource,
  });
  const endpoint = subscription.endpoint;
  const { error } = await supabase.from("push_subscriptions").upsert({
    id: endpoint,
    user_id: userId,
    endpoint,
    p256dh: encodeKey(subscription.getKey("p256dh")),
    auth: encodeKey(subscription.getKey("auth")),
    user_agent: navigator.userAgent,
    disabled_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) {
    await subscription.unsubscribe();
    throw new Error(error.message);
  }
}

export async function disablePush(userId: string): Promise<void> {
  if (!supported()) return;
  const registration = await hazirWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  const { error } = await supabase.from("push_subscriptions")
    .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
  await subscription.unsubscribe();
}
