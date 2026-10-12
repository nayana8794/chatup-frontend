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
    | "MOM_LOCK_RELEASED";

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

    useEffect(() => {
        if (!user) return;

        const token = localStorage.getItem("chatup_token");
        if (!token) return;

        const wsUrl = `ws://127.0.0.1:8000/api/v1/chat/ws/global/sync?token=${token}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

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

                if (data.type === "MOM_PUBLISHED") {
                    playNotificationChime();
                }
            } catch (err) {
                console.error(err);
            }
        };

        return () => {
            ws.close();
        };
    }, [user, refreshUnread]);

    return (
        <RealtimeContext.Provider value={{ totalUnread, refreshUnread, lastEvent }}>
            {children}
        </RealtimeContext.Provider>
    );
};