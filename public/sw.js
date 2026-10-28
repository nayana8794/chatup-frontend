// chatup/frontend/public/sw.js
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {
        title: "ChatUp Club Alert",
        body: "You have a new update in ChatUp.",
        url: "/",
        badge_count: 1,
        tag: `chatup-${Date.now()}`,
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text() || data.body;
        }
    }

    const notificationOptions = {
        body: data.body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: data.tag,
        renotify: true,
        requireInteraction: true, // Remains on screen until acknowledged
        silent: false, // Explicitly enables the OS default system notification chime
        vibrate: [300, 150, 300, 150, 500],
        data: {
            url: data.url || "/",
            custom_data: data.custom_data || {},
        },
    };

    const tasks = [
        self.registration.showNotification(data.title, notificationOptions),
    ];

    // Sync WhatsApp-style home-screen / taskbar app badge counter
    if ("setAppBadge" in navigator) {
        const count = typeof data.badge_count === "number" ? data.badge_count : 1;
        tasks.push(navigator.setAppBadge(count).catch(() => { }));
    }

    event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/";

    // Clear App Icon Badge on notification click
    if ("clearAppBadge" in navigator) {
        navigator.clearAppBadge().catch(() => { });
    }

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