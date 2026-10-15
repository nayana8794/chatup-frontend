// chatup/frontend/src/config.ts
export const BACKEND_URL = import.meta.env.VITE_API_URL || "https://chatup-backend.onrender.com";
export const API_BASE_URL = `${BACKEND_URL}/api/v1`;

// Secure WebSockets: WSS සඳහා auto-detect
export const WS_BASE_URL = BACKEND_URL.replace(/^http/, "ws");
// Note: If on Vercel/HTTPS, replace(/^http/, "ws") -> replace(/^https/, "wss")
export const SECURE_WS_URL = BACKEND_URL.replace(/^http/, "ws").replace("ws://", "wss://");