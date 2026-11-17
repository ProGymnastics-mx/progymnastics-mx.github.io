/* ProGymnastics — service worker SOLO para notificaciones (Web Push), como el de aguilaskc.net.
   No guarda páginas en caché: no le agregues caché, o los celulares se quedarían con versiones viejas de la app. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titulo: "ProGymnastics", texto: e.data ? e.data.text() : "" }; }
  const base = self.registration.scope;
  e.waitUntil(self.registration.showNotification(d.titulo || "ProGymnastics", {
    body: d.texto || "",
    icon: base + "img/icono-192.png",
    badge: base + "img/icono-192.png",
    tag: d.tag || undefined,
    data: { url: new URL(d.url || "./", base).href }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
    for (const v of ventanas) if (v.url.startsWith(self.registration.scope) && "focus" in v) { v.navigate(url); return v.focus(); }
    return self.clients.openWindow(url);
  }));
});
