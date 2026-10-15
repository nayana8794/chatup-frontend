// chatup/frontend/src/config.ts

const getWebSocketBaseUrl = (httpUrl: string): string => {
    if (!httpUrl.startsWith("http://") && !httpUrl.startsWith("https://")) {
        const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = typeof window !== "undefined" ? window.location.host : "localhost:8000";
        return `${proto}//${host}${httpUrl}`;
    }
    const isSecure = httpUrl.startsWith("https://");
    const wsProto = isSecure ? "wss:" : "ws:";
    const hostAndPath = httpUrl.replace(/^https?:\/\//, "");
    return `${wsProto}//${hostAndPath}`;
};

export const BACKEND_URL = import.meta.env.VITE_API_URL || "https://chatup-backend.onrender.com";
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

// Auto-detects secure wss:// for https production and ws:// for http local development
export const WS_BASE_URL = getWebSocketBaseUrl(BACKEND_URL);
export const SECURE_WS_URL = WS_BASE_URL;