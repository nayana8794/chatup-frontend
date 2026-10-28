// chatup/frontend/public/sw.js
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let data = {
        title: "ChatUp Notification",
        body: "You have a new update in ChatUp.",
        url: "/",
        badge_count: 1,
        tag: `chatup-${Date.now()}`,
        custom_data: {},
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text() || data.body;
        }
    }

    const customData = data.custom_data || {};
    const isIncomingCall = customData.type === "INCOMING_CALL" || (data.tag && data.tag.startsWith("call-"));
    const isMissedCall = customData.type === "MISSED_CALL";

    // Check if vibration is supported (blocks crashing on Apple iOS)
    const isVibrationSupported = "vibrate" in navigator;
    let vibrationPattern = isVibrationSupported ? [300, 150, 300, 150, 500] : undefined;
    let notificationActions = [];

    if (isIncomingCall) {
        if (isVibrationSupported) {
            vibrationPattern = [1000, 500, 1000, 500, 1000, 500, 1500];
        }
        notificationActions = [
            { action: "accept", title: "🟢 Accept Call" },
            { action: "decline", title: "🔴 Decline" },
        ];
    } else if (isMissedCall) {
        notificationActions = [
            { action: "callback", title: "📞 Call Back" },
        ];
    }

    const notificationOptions = {
        body: data.body,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: data.tag,
        renotify: true,
        requireInteraction: isIncomingCall,
        silent: false,
        ...(vibrationPattern ? { vibrate: vibrationPattern } : {}),
        actions: notificationActions,
        data: {
            url: data.url || "/",
            room_id: customData.room_id,
            call_type: customData.call_type || "video",
            custom_data: customData,
        },
    };

    const tasks = [
        self.registration.showNotification(data.title, notificationOptions),
    ];

    // Set App Icon Badge (iOS 16.4+ and Android)
    if ("setAppBadge" in navigator) {
        const count = typeof data.badge_count === "number" ? data.badge_count : 1;
        tasks.push(navigator.setAppBadge(count).catch(() => { }));
    }

    event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const notifData = event.notification.data || {};
    let targetUrl = notifData.url || "/";

    if (event.action === "decline") {
        if (notifData.room_id) {
            event.waitUntil(
                fetch("/api/v1/calling/decline", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ room_id: notifData.room_id }),
                }).catch(() => { })
            );
        }
        return;
    }

    if (event.action === "accept" || !event.action) {
        if (notifData.room_id) {
            targetUrl = `/calling?room=${notifData.room_id}&type=${notifData.call_type || "video"}&autoJoin=true`;
        }
    } else if (event.action === "callback") {
        targetUrl = "/calling";
    }

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