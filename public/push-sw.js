/* Matrundan – service worker enbart för notiser.
   Ingen offline-cachning och ingen app-shell-cache, så inga gamla filer kan bli kvar. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }

  const title = payload.title || "Matrundan";
  const options = {
    body: payload.body || "Något nytt har hänt i gruppen.",
    icon: "/icons/matrundan-192.png",
    badge: "/icons/matrundan-192.png",
    tag: payload.tag || "matrundan",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch (error) {
              /* navigering kan blockeras i vissa lägen – fönstret är ändå fokuserat */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
