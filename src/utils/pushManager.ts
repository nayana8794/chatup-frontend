// chatup/frontend/src/utils/pushManager.ts
import apiClient from "../api/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeToPushNotifications(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return false;
    }

    try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
            return false;
        }

        const reg = await navigator.serviceWorker.ready;
        const res = await apiClient.get<{ public_key: string }>("/push/vapid-public-key");
        const vapidKey = res.data.public_key;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
            });
        }

        const subJson = sub.toJSON();
        if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
            await apiClient.post("/push/subscribe", {
                endpoint: subJson.endpoint,
                keys: {
                    p256dh: subJson.keys.p256dh,
                    auth: subJson.keys.auth,
                },
                user_agent: navigator.userAgent,
            });
            return true;
        }
        return false;
    } catch (error) {
        console.error("Failed to subscribe to Web Push:", error);
        return false;
    }
}

export async function isPushSubscribed(): Promise<boolean> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return false;
    }
    if (Notification.permission !== "granted") {
        return false;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
}