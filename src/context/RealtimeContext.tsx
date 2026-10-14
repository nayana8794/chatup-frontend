// chatup/frontend/src/context/RealtimeContext.tsx
import React, { createContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { playNotificationChime } from "../utils/sound";
import apiClient from "../api/client";

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

    const refreshUnread = useCallback(async () => {
        if (!user) return;
        try {
            const res = await apiClient.get("/chat/rooms");
            const total = res.data.reduce((sum: number, r: any) => sum + (r.unread_count || 0), 0);
            setTotalUnread(total);
        } catch (err) {
            // Ignore
        }
    }, [user]);

    useEffect(() => {
        refreshUnread();
    }, [refreshUnread]);

    // Persistent Reconnecting WebSocket Engine with Heartbeat
    const connectSocket = useCallback(() => {
        if (!user) return;

        const token = localStorage.getItem("chatup_token");
        if (!token) return;

        // Clear previous timers
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

        const wsUrl = `ws://127.0.0.1:8000/api/v1/chat/ws/global/sync?token=${token}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            // Heartbeat ping every 20 seconds to keep connection alive indefinitely
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

                // Live Audio Chime on Events, MOM, and Dues Approvals
                if (
                    data.type === "MOM_PUBLISHED" ||
                    data.type === "EVENT_CREATED" ||
                    data.type === "DUES_BATCH_APPROVED" ||
                    data.type === "DUES_APPROVAL_NEEDED"
                ) {
                    playNotificationChime();
                }
            } catch (err) {
                // Ignore non-json frames (like ping responses)
            }
        };

        ws.onclose = () => {
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            // Auto-reconnect after 2 seconds if connection drops
            reconnectTimeoutRef.current = setTimeout(() => {
                connectSocket();
            }, 2000);
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [user, refreshUnread]);

    useEffect(() => {
        connectSocket();

        return () => {
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (socketRef.current) socketRef.current.close();
        };
    }, [connectSocket]);

    return (
        <RealtimeContext.Provider value={{ totalUnread, refreshUnread, lastEvent }}>
            {children}
        </RealtimeContext.Provider>
    );
};