// chatup/frontend/src/config.ts

// Production Render backend URL or local development fallback
export const BACKEND_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

// Automatically converts http:// -> ws:// and https:// -> wss:// for secure WebSockets
export const WS_BASE_URL = BACKEND_URL.replace(/^http/, "ws");