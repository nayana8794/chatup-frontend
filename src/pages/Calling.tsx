// chatup/frontend/src/pages/Calling.tsx
import React, { useState, useEffect } from "react";
import {
    Box,
    CircularProgress,
    Typography,
} from "@mui/material";
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

export const Calling: React.FC<{ onBack: () => void; initialRoomId?: string }> = ({
    onBack,
}) => {
    const { t } = useTranslation();
    const [token, setToken] = useState<string | null>(null);
    const [wsUrl, setWsUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchToken = async () => {
            try {
                setLoading(true);
                const res = await apiClient.post("/calling/token");
                setToken(res.data.token);
                setWsUrl(res.data.ws_url);
            } catch (err: any) {
                setError(err.response?.data?.detail || "Failed to initialize virtual conference room.");
            } finally {
                setLoading(false);
            }
        };
        fetchToken();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t("connecting_call")}
                </Typography>
            </Box>
        );
    }

    if (error || !token || !wsUrl) {
        onBack(); // Error එකක් ආවොත් ස්වයංක්‍රීයව Dashboard එකට යැවීම
        return null;
    }

    return (
        <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#000" }}>
            <LiveKitRoom
                video={true}
                audio={true}
                token={token}
                serverUrl={wsUrl}
                data-lk-theme="default"
                style={{ height: "100%" }}
                onDisconnected={onBack}
            >
                <VideoConference />
                <RoomAudioRenderer />
            </LiveKitRoom>
        </Box>
    );
};