// chatup/frontend/src/context/RealtimeContext.tsx
import React, { createContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { playNotificationChime } from "../utils/sound";
import apiClient from "../api/client";
import { SECURE_WS_URL } from "../config";

export type RealtimeEventType =
    | "NEW_CHAT_MESSAGE"
    | "MOM_PUBLISHED"
    | "MOM_SAVED"
    | "MOM_DELETED"
    | "MOM_LOCK_ACQUIRED"
    | "MOM_LOCK_RELEASED"
    | "EVENT_CREATED"
    | "EVENT_UPDATED"
    | "RSVP_UPDATED"
    | "EVENT_DELETED"
    | "DUES_GENERATED"
    | "DUES_PAID"
    | "DUES_APPROVAL_NEEDED"
    | "DUES_BATCH_APPROVED"
    | "DUES_BATCH_AMENDED"
    | "DUES_BATCH_CANCELLED"
    | "INCOMING_CALL"
    | "CALL_DECLINED"
    | "CALL_ENDED"
    | (string & {});

export interface RealtimeEvent {
    type: RealtimeEventType;
    [key: string]: any;
}

export interface RealtimeContextType {
    totalUnread: number;
    refreshUnread: () => void;
    lastEvent: RealtimeEvent | null;
}

export const RealtimeContext = createContext<RealtimeContextType>({
    totalUnread: 0,
    refreshUnread: () => { },
    lastEvent: null,
});

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [totalUnread, setTotalUnread] = useState(0);
    const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const pingIntervalRef = useRef<any>(null);
    const reconnectTimeoutRef = useRef<any>(null);
    const isUnmountingRef = useRef(false);

    // Sync App Icon Badge with total unread messages and events
    const updateAppBadge = useCallback((count: number) => {
        if ("setAppBadge" in navigator) {
            if (count > 0) {
                navigator.setAppBadge(count).catch(() => { });
            } else {
                navigator.clearAppBadge().catch(() => { });
            }
        }
    }, []);

    const refreshUnread = useCallback(async () => {
        if (!user) return;
        try {
            const res = await apiClient.get("/chat/rooms");
            const total = res.data.reduce((sum: number, r: any) => sum + (r.unread_count || 0), 0);
            setTotalUnread(total);
            updateAppBadge(total);
        } catch { }
    }, [user, updateAppBadge]);

    useEffect(() => {
        refreshUnread();
    }, [refreshUnread]);

    const connectSocket = useCallback(() => {
        if (!user || isUnmountingRef.current) return;

        const token = localStorage.getItem("chatup_token");
        if (!token) return;

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

        const wsUrl = `${SECURE_WS_URL}/api/v1/chat/ws/global/sync?token=${token}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            pingIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send("ping");
                }
            }, 20000);
        };

        ws.onmessage = (e) => {
            try {
                const data: RealtimeEvent = JSON.parse(e.data);
                setLastEvent(data);

                if (data.type === "NEW_CHAT_MESSAGE") {
                    const isSender =
                        String(data.sender_id).toLowerCase() === String(user.user_id).toLowerCase();

                    if (!isSender) {
                        playNotificationChime();
                        refreshUnread();
                    }
                }

                if (
                    data.type === "MOM_PUBLISHED" ||
                    data.type === "EVENT_CREATED" ||
                    data.type === "DUES_BATCH_APPROVED" ||
                    data.type === "DUES_APPROVAL_NEEDED"
                ) {
                    playNotificationChime();
                    refreshUnread();
                }
            } catch { }
        };

        ws.onclose = () => {
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            if (!isUnmountingRef.current) {
                reconnectTimeoutRef.current = setTimeout(() => {
                    connectSocket();
                }, 2500);
            }
        };

        ws.onerror = () => { };
    }, [user, refreshUnread]);

    useEffect(() => {
        isUnmountingRef.current = false;
        connectSocket();

        return () => {
            isUnmountingRef.current = true;
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (socketRef.current) {
                const ws = socketRef.current;
                socketRef.current = null;
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    ws.onopen = () => ws.close();
                }
            }
        };
    }, [connectSocket]);

    return (
        <RealtimeContext.Provider value={{ totalUnread, refreshUnread, lastEvent }}>
            {children}
        </RealtimeContext.Provider>
    );
};