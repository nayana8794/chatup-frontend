// chatup/frontend/public/sw.js
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || "ChatUp Club Alert";
        const options = {
            body: data.body || "You have a new update in ChatUp.",
            icon: data.icon || "/pwa-192.png",
            badge: data.badge || "/pwa-192.png",
            tag: data.tag || "chatup-alert",
            renotify: true,
            vibrate: [200, 100, 200, 100, 400],
            data: {
                url: data.url || "/",
                custom_data: data.custom_data || {},
            },
        };

        event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
        console.error("Error displaying push notification:", e);
    }
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ("focus" in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});