self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title : "VanScout";
  const body = typeof data.body === "string" ? data.body : "You have a new update.";
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const appWindows = windows.filter(windowClient => new URL(windowClient.url).origin === self.location.origin);
    appWindows.forEach(windowClient => windowClient.postMessage({ type: "vanscout-push", notification: data }));
    const appIsVisible = appWindows.some(windowClient => windowClient.visibilityState === "visible");
    if (appIsVisible) return;
    return self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: typeof data.tag === "string" ? data.tag : "vanscout-update",
      data: { url },
    });
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(windowClient => new URL(windowClient.url).origin === self.location.origin);
    if (existing) return existing.navigate(url).then(() => existing.focus());
    return clients.openWindow(url);
  }));
});
