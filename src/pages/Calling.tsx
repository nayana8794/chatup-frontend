// chatup/frontend/src/pages/Calling.tsx
// (Calling.tsx ගොනුව සම්පූර්ණයෙන්ම පහත කේතයෙන් replace කරන්න)

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    CircularProgress,
    Stack,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import CallEndIcon from "@mui/icons-material/CallEnd";
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { playRingingRingtone } from "../utils/sound";
import apiClient from "../api/client";

export const Calling: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const canStartCall = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "PLANNER",
        "VICE_PLANNER",
    ].includes(user?.role || "");

    const [token, setToken] = useState<string | null>(null);
    const [wsUrl, setWsUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // States
    const [isInMeeting, setIsInMeeting] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(true);

    // Incoming Call Popup state
    const [incomingCallData, setIncomingCallData] = useState<{ host_name: string; host_role: string } | null>(null);

    // Real-time Webcam Preview Stream
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const stopPreviewStream = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    // Initialize browser webcam stream for lobby preview
    useEffect(() => {
        if (!isInMeeting) {
            navigator.mediaDevices
                .getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    mediaStreamRef.current = stream;
                    if (videoPreviewRef.current) {
                        videoPreviewRef.current.srcObject = stream;
                    }
                    // Apply initial track states
                    stream.getAudioTracks().forEach((track) => (track.enabled = audioEnabled));
                    stream.getVideoTracks().forEach((track) => (track.enabled = videoEnabled));
                })
                .catch((err) => {
                    console.warn("Webcam permission denied or unavailable:", err);
                });
        }

        return () => {
            stopPreviewStream();
        };
    }, [isInMeeting, stopPreviewStream]);

    // Toggle audio/video in preview mode
    useEffect(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getAudioTracks().forEach((track) => (track.enabled = audioEnabled));
            mediaStreamRef.current.getVideoTracks().forEach((track) => (track.enabled = videoEnabled));
        }
    }, [audioEnabled, videoEnabled]);

    // Listen for incoming call events
    useEffect(() => {
        if (lastEvent?.type === "INCOMING_CALL") {
            const isHost = String(lastEvent.host_name).toLowerCase() === String(user?.full_name).toLowerCase();
            if (!isHost && !isInMeeting) {
                setIncomingCallData({
                    host_name: lastEvent.host_name,
                    host_role: lastEvent.host_role,
                });
                playRingingRingtone();
            }
        }
    }, [lastEvent, user, isInMeeting]);

    const handleStartAndJoinCall = async () => {
        try {
            setLoading(true);
            setError(null);
            stopPreviewStream(); // Stop local preview before handing over to LiveKit

            if (canStartCall) {
                await apiClient.post("/calling/start");
            }
            const res = await apiClient.post("/calling/token");
            setToken(res.data.token);
            setWsUrl(res.data.ws_url);
            setIsInMeeting(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to start meeting room.");
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptIncomingCall = async () => {
        setIncomingCallData(null);
        try {
            setLoading(true);
            stopPreviewStream();
            const res = await apiClient.post("/calling/token");
            setToken(res.data.token);
            setWsUrl(res.data.ws_url);
            setIsInMeeting(true);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to join conference.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="md" sx={{ py: 12, textAlign: "center" }}>
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t("connecting_call")}
                </Typography>
            </Container>
        );
    }

    // ================= ACTIVE LIVE CONFERENCE ROOM =================
    if (isInMeeting && token && wsUrl) {
        return (
            <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
                <Box
                    sx={{
                        p: 2,
                        bgcolor: "background.paper",
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ fontWeight: 800 }}>
                        {t("leave_call_btn")}
                    </Button>
                    <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
                        <VideoCallIcon color="success" /> {t("calling_title")}
                    </Typography>
                    <Chip label="Live SFU Conference" color="success" size="small" sx={{ fontWeight: 800 }} />
                </Box>

                <Box sx={{ flex: 1, position: "relative", bgcolor: "#111" }}>
                    <LiveKitRoom
                        video={videoEnabled}
                        audio={audioEnabled}
                        token={token}
                        serverUrl={wsUrl}
                        data-lk-theme="default"
                        style={{ height: "100%" }}
                    >
                        <VideoConference />
                        <RoomAudioRenderer />
                    </LiveKitRoom>
                </Box>
            </Box>
        );
    }

    // ================= PRE-JOIN LOBBY SCREEN =================
    return (
        <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 }, display: "flex", alignItems: "center", minHeight: "100vh" }}>
            <Paper elevation={4} sx={{ p: 4, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <Box sx={{ mb: 3 }}>
                    <VideoCallIcon color="primary" sx={{ fontSize: 60, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
                        {t("calling_title")}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        {t("call_description")}
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3, fontWeight: 700 }}>
                        {error}
                    </Alert>
                )}

                {/* Real-time Webcam Video Preview Container */}
                <Box
                    sx={{
                        height: 220,
                        bgcolor: "grey.900",
                        borderRadius: 3,
                        mb: 3,
                        overflow: "hidden",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <video
                        ref={videoPreviewRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: videoEnabled ? "block" : "none",
                        }}
                    />
                    {!videoEnabled && (
                        <Typography variant="body1" sx={{ color: "white", fontWeight: 700, position: "absolute" }}>
                            Camera is Turned Off
                        </Typography>
                    )}
                </Box>

                {/* Device Toggles */}
                <Stack direction="row" spacing={2} sx={{ justifyContent: "center", mb: 4 }}>
                    <Button
                        variant={audioEnabled ? "contained" : "outlined"}
                        color={audioEnabled ? "primary" : "error"}
                        startIcon={audioEnabled ? <MicIcon /> : <MicOffIcon />}
                        onClick={() => setAudioEnabled(!audioEnabled)}
                        sx={{ fontWeight: 800, minHeight: 48 }}
                    >
                        {audioEnabled ? t("unmute_mic") : t("mute_mic")}
                    </Button>

                    <Button
                        variant="contained"
                        color={videoEnabled ? "primary" : "error"}
                        startIcon={videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                        onClick={() => setVideoEnabled(!videoEnabled)}
                        sx={{ fontWeight: 800, minHeight: 48 }}
                    >
                        {videoEnabled ? t("turn_off_cam") : t("turn_on_cam")}
                    </Button>
                </Stack>

                <Stack direction="row" spacing={2}>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={onBack}
                        sx={{ fontWeight: 800, minHeight: 52 }}
                    >
                        {t("back_to_dashboard")}
                    </Button>
                    <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        onClick={handleStartAndJoinCall}
                        startIcon={canStartCall ? <PhoneInTalkIcon /> : <VideoCallIcon />}
                        sx={{ fontWeight: 800, minHeight: 52, fontSize: "1.05rem" }}
                    >
                        {canStartCall ? "Start Club Meeting" : t("join_call_btn")}
                    </Button>
                </Stack>
            </Paper>

            {/* ================= REAL-TIME INCOMING CALL POPUP ================= */}
            <Dialog
                open={Boolean(incomingCallData)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 4, textAlign: "center", p: 2 } }}
            >
                <DialogTitle sx={{ fontWeight: 900, color: "primary.main", fontSize: "1.5rem" }}>
                    📞 Live Club Meeting Started!
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ fontWeight: 700, my: 1 }}>
                        {incomingCallData?.host_name} ({incomingCallData?.host_role}) is hosting a live video conference.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Tap accept to join the virtual room immediately.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: "center", gap: 2 }}>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CallEndIcon />}
                        onClick={() => setIncomingCallData(null)}
                        sx={{ fontWeight: 800, minHeight: 48, px: 3 }}
                    >
                        Decline
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<PhoneInTalkIcon />}
                        onClick={handleAcceptIncomingCall}
                        sx={{ fontWeight: 800, minHeight: 48, px: 4 }}
                    >
                        Accept & Join
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};