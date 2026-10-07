self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "schedule") return;
  event.waitUntil(applySchedule(data));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => "focus" in client);
      if (open) return open.focus();
      return self.clients.openWindow("/");
    }),
  );
});

async function applySchedule(data) {
  const current = await self.registration.getNotifications({ tag: data.tag });
  for (const note of current) note.close();
  if (!data.at || data.at <= Date.now()) return;
  const options = {
    body: data.body,
    tag: data.tag,
    icon: "/icon",
    renotify: true,
  };
  if (typeof TimestampTrigger === "function") {
    options.showTrigger = new TimestampTrigger(data.at);
  } else if (data.at > Date.now() + 90_000) {
    return;
  }
  await self.registration.showNotification(data.title, options);
}
