/* Epoche Web Push worker. Workbox bunu üretilen /sw.js içine import eder. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Yeni bir Epoche hatırlatıcın var." };
  }

  const title = payload.title || "Epoche";
  const options = {
    body: payload.body || "Yeni bir hatırlatıcın var.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: payload.tag || "epoche-reminder",
    renotify: Boolean(payload.renotify),
    data: { url: payload.url || "/?view=school", eventId: payload.eventId || null },
    actions: payload.eventId
      ? [{ action: "open", title: "Ajandayı aç" }, { action: "ack", title: "Gördüm" }]
      : [{ action: "open", title: "Ajandayı aç" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const base = data.url || "/?view=school";
  const separator = base.includes("?") ? "&" : "?";
  const target = event.action === "ack" && data.eventId
    ? `${base}${separator}ack=${encodeURIComponent(data.eventId)}`
    : base;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
