// chatup/frontend/src/pages/Calling.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Stack,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Avatar,
    Tooltip,
    Alert,
    CircularProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import { SECURE_WS_URL } from "../config";

interface Member {
    id: string;
    full_name: string;
    role: string;
}

const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" },
    ],
    iceCandidatePoolSize: 10,
};

export const Calling: React.FC<{ onBack: () => void; initialRoomId?: string }> = ({
    onBack,
    initialRoomId,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();

    const canLeadMeeting = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "VICE_SECRETARY",
        "PLANNER",
        "VICE_PLANNER",
    ].includes(user?.role || "");

    const [inCall, setInCall] = useState<boolean>(Boolean(initialRoomId));
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [callStatusText, setCallStatusText] = useState("Connecting...");
    const [callSeconds, setCallSeconds] = useState(0);
    const [targetName, setTargetName] = useState<string>("Meeting");
    const [swapPiP, setSwapPiP] = useState(false);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
    const isMakingOfferRef = useRef(false);

    // Call duration timer
    useEffect(() => {
        if (!remoteConnected) return;
        const timer = setInterval(() => {
            setCallSeconds((s) => s + 1);
        }, 1000);
        return () => {
            clearInterval(timer);
        };
    }, [remoteConnected]);

    // Reliably synchronize local media stream to local <video> element on DOM mount or stream update
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(() => {});
        }
    }, [localStream, inCall, swapPiP]);

    // Reliably synchronize remote media stream to remote <video> element on DOM mount or stream update
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
        }
    }, [remoteStream, inCall, swapPiP]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await apiClient.get("/members");
                setMembers(res.data.filter((m: Member) => m.id !== user?.user_id));
            } catch {
                // Ignore
            }
        };
        fetchMembers();
    }, [user]);

    const stopAllMedia = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (wsRef.current) {
            try {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "hangup" }));
                }
                wsRef.current.close();
            } catch {
                // Ignore close errors
            }
            wsRef.current = null;
        }
        pendingCandidatesRef.current = [];
        isMakingOfferRef.current = false;
        setLocalStream(null);
        setRemoteStream(null);
        setInCall(false);
        setRemoteConnected(false);
        setCallSeconds(0);
        setCallStatusText("Disconnected");
    }, []);

    const handleEndCall = useCallback(() => {
        stopAllMedia();
        onBack();
    }, [stopAllMedia, onBack]);

    const drainPendingCandidates = async (pc: RTCPeerConnection) => {
        while (pendingCandidatesRef.current.length > 0) {
            const candidate = pendingCandidatesRef.current.shift();
            if (candidate) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (err) {
                    console.warn("Error draining ICE candidate:", err);
                }
            }
        }
    };

    const sendOffer = useCallback(async (pc: RTCPeerConnection, ws: WebSocket) => {
        try {
            if (pc.signalingState === "have-local-offer" && pc.localDescription) {
                // Re-send the existing local offer to newly joined peer
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "offer", offer: pc.localDescription }));
                }
                return;
            }
            if (pc.signalingState !== "stable") {
                return;
            }
            isMakingOfferRef.current = true;
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "offer", offer }));
            }
        } catch (err) {
            console.error("Failed to create/send offer:", err);
        } finally {
            isMakingOfferRef.current = false;
        }
    }, []);

    const startWebRTCSession = useCallback(
        async (roomId: string, isInitiator: boolean) => {
            try {
                setInCall(true);
                setCallStatusText(isInitiator ? "Calling..." : "Connecting...");

                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    });
                } catch {
                    // Graceful fallback to audio-only
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                }

                localStreamRef.current = stream;
                setLocalStream(stream);

                const pc = new RTCPeerConnection(RTC_CONFIG);
                peerConnectionRef.current = pc;

                // Add all local tracks
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                // Incoming remote track listener
                pc.ontrack = (event) => {
                    if (event.streams && event.streams[0]) {
                        setRemoteStream(event.streams[0]);
                        setRemoteConnected(true);
                        setCallStatusText("Connected");
                    }
                };

                // Connection state monitors
                pc.onconnectionstatechange = () => {
                    if (pc.connectionState === "connected") {
                        setRemoteConnected(true);
                        setCallStatusText("Connected");
                    } else if (
                        pc.connectionState === "disconnected" ||
                        pc.connectionState === "failed" ||
                        pc.connectionState === "closed"
                    ) {
                        setRemoteConnected(false);
                        setCallStatusText("Reconnecting...");
                    }
                };

                pc.oniceconnectionstatechange = () => {
                    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        setRemoteConnected(true);
                        setCallStatusText("Connected");
                    }
                };

                const token = localStorage.getItem("chatup_token");
                const ws = new WebSocket(`${SECURE_WS_URL}/api/v1/calling/ws/${roomId}?token=${token}`);
                wsRef.current = ws;

                pc.onicecandidate = (event) => {
                    if (event.candidate && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
                    }
                };

                ws.onopen = () => {
                    setCallStatusText(isInitiator ? "Ringing..." : "Connecting...");
                    ws.send(JSON.stringify({ type: "ready", is_initiator: isInitiator }));

                    if (isInitiator) {
                        void sendOffer(pc, ws);
                    }
                };

                ws.onmessage = async (e) => {
                    try {
                        const data = JSON.parse(e.data);

                        if (data.type === "peer-joined" || data.type === "ready") {
                            setCallStatusText("Connecting video...");
                            if (isInitiator) {
                                void sendOffer(pc, ws);
                            }
                        } else if (data.type === "offer") {
                            setCallStatusText("Connecting video...");
                            if (pc.signalingState !== "stable") {
                                await Promise.all([
                                    pc.setLocalDescription({ type: "rollback" }),
                                ]).catch(() => {});
                            }
                            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                            await drainPendingCandidates(pc);

                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: "answer", answer }));
                            }
                        } else if (data.type === "answer") {
                            if (pc.signalingState === "have-local-offer") {
                                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                                await drainPendingCandidates(pc);
                            }
                        } else if (data.type === "candidate" && data.candidate) {
                            const iceCandidate = new RTCIceCandidate(data.candidate);
                            if (pc.remoteDescription && pc.remoteDescription.type) {
                                try {
                                    await pc.addIceCandidate(iceCandidate);
                                } catch (err) {
                                    console.warn("Failed to add ICE candidate:", err);
                                }
                            } else {
                                pendingCandidatesRef.current.push(iceCandidate);
                            }
                        } else if (data.type === "peer-left" || data.type === "hangup") {
                            setRemoteConnected(false);
                            setRemoteStream(null);
                            setCallStatusText("Call Ended");
                            setTimeout(() => {
                                handleEndCall();
                            }, 1200);
                        }
                    } catch (err) {
                        console.error("Signaling message handling error:", err);
                    }
                };
            } catch (err) {
                console.error("WebRTC Setup error:", err);
                alert("Could not access camera or microphone. Please grant browser permissions.");
            }
        },
        [sendOffer, handleEndCall]
    );

    useEffect(() => {
        if (initialRoomId) {
            const timer = setTimeout(() => {
                setTargetName("Incoming Conference");
                void startWebRTCSession(initialRoomId, false);
            }, 0);
            return () => {
                clearTimeout(timer);
                stopAllMedia();
            };
        }
        return () => {
            stopAllMedia();
        };
    }, [initialRoomId, startWebRTCSession, stopAllMedia]);

    const handleStartGroupCall = async () => {
        const roomId = `club-meeting-${user?.tenant_id || "general"}`;
        setTargetName("Club Conference (All Members)");
        setInCall(true);
        try {
            await apiClient.post("/calling/initiate", { room_id: roomId, call_type: "video" });
            void startWebRTCSession(roomId, true);
        } catch (err: unknown) {
            const errorObj = err as { response?: { data?: { detail?: string } } };
            alert(errorObj.response?.data?.detail || "Error starting conference.");
            setInCall(false);
        }
    };

    const handleStartDirectCall = async (targetMember: Member) => {
        setMembersModalOpen(false);
        setTargetName(targetMember.full_name);
        setInCall(true);
        const roomId = `direct-call-${[user?.user_id, targetMember.id].sort().join("-")}`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: roomId,
                call_type: "video",
                target_user_id: targetMember.id,
            });
            void startWebRTCSession(roomId, true);
        } catch (err: unknown) {
            const errorObj = err as { response?: { data?: { detail?: string } } };
            alert(errorObj.response?.data?.detail || "Error starting call.");
            setInCall(false);
        }
    };

    const toggleAudio = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = !track.enabled;
                setAudioMuted(!track.enabled);
            });
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((track) => {
                track.enabled = !track.enabled;
                setVideoMuted(!track.enabled);
            });
        }
    };

    const toggleScreenShare = async () => {
        if (!canLeadMeeting) return alert("Screen sharing is reserved for authorized Club Officers.");
        if (!peerConnectionRef.current) return;

        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];
                const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === "video");
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                }
                setLocalStream(screenStream);
                screenTrack.onended = () => {
                    void stopScreenSharing();
                };
                setIsScreenSharing(true);
            } catch {
                // User cancelled screen share dialog
            }
        } else {
            await stopScreenSharing();
        }
    };

    const stopScreenSharing = async () => {
        if (!peerConnectionRef.current || !localStreamRef.current) return;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
        }
        setLocalStream(localStreamRef.current);
        setIsScreenSharing(false);
    };

    const formatDuration = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // =========================================================================
    // VIEW 1: WHATSAPP-STYLE IMMERSIVE VIDEO CALL INTERFACE
    // =========================================================================
    if (inCall) {
        const showRemoteAsMain = remoteConnected && !swapPiP;

        return (
            <Box
                sx={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: "100vw",
                    height: "100vh",
                    bgcolor: "#0b141a",
                    overflow: "hidden",
                    zIndex: 2000,
                }}
            >
                {/* 1. PRIMARY MAIN STAGE (FULLSCREEN VIDEO) */}
                <Box sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", bgcolor: "#111b21" }}>
                    {showRemoteAsMain ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transform: "scaleX(-1)",
                                display: videoMuted ? "none" : "block",
                            }}
                        />
                    )}

                    {/* WhatsApp-Style Calling Overlay when waiting for remote peer to connect */}
                    {!remoteConnected && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "radial-gradient(circle, rgba(17,27,33,0.7) 0%, rgba(11,20,26,0.95) 100%)",
                                p: 3,
                                textAlign: "center",
                                zIndex: 5,
                            }}
                        >
                            <Box sx={{ position: "relative", mb: 3 }}>
                                <Avatar
                                    sx={{
                                        width: 100,
                                        height: 100,
                                        bgcolor: "primary.main",
                                        fontSize: "2.5rem",
                                        fontWeight: 900,
                                        boxShadow: "0 8px 30px rgba(0,0,0,0.8)",
                                        border: "3px solid rgba(255,255,255,0.25)",
                                    }}
                                >
                                    {targetName.charAt(0)}
                                </Avatar>
                                <CircularProgress
                                    size={120}
                                    sx={{
                                        position: "absolute",
                                        top: -10,
                                        left: -10,
                                        color: "primary.light",
                                        opacity: 0.7,
                                    }}
                                />
                            </Box>
                            <Typography variant="h5" sx={{ color: "white", fontWeight: 800, mb: 1 }}>
                                {targetName}
                            </Typography>
                            <Chip
                                label={callStatusText}
                                color="warning"
                                size="medium"
                                sx={{ fontWeight: 800, fontSize: "0.9rem", px: 1, py: 0.5 }}
                            />
                        </Box>
                    )}
                </Box>

                {/* 2. FLOATING WHATSAPP-STYLE PICTURE-IN-PICTURE (PIP) CARD */}
                {remoteConnected && (
                    <Box
                        onClick={() => setSwapPiP(!swapPiP)}
                        sx={{
                            position: "absolute",
                            top: { xs: 80, sm: 90 },
                            right: { xs: 16, sm: 28 },
                            width: { xs: 110, sm: 160 },
                            height: { xs: 160, sm: 220 },
                            borderRadius: 3.5,
                            overflow: "hidden",
                            boxShadow: "0 12px 36px rgba(0,0,0,0.85)",
                            border: "2px solid rgba(255,255,255,0.4)",
                            bgcolor: "#222",
                            cursor: "pointer",
                            zIndex: 30,
                            transition: "transform 0.2s ease",
                            "&:hover": { transform: "scale(1.04)" },
                        }}
                    >
                        {swapPiP ? (
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                        ) : (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    transform: "scaleX(-1)",
                                    display: videoMuted ? "none" : "block",
                                }}
                            />
                        )}
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 6,
                                right: 6,
                                bgcolor: "rgba(0,0,0,0.6)",
                                borderRadius: 1.5,
                                p: 0.4,
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <SyncAltIcon sx={{ color: "white", fontSize: 16 }} />
                        </Box>
                    </Box>
                )}

                {/* 3. MINIMALIST TOP HEADER */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        p: { xs: 2, sm: 3 },
                        pt: { xs: "max(16px, env(safe-area-inset-top))", sm: 3 },
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
                        zIndex: 20,
                    }}
                >
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={handleEndCall}
                        sx={{
                            color: "white",
                            fontWeight: 700,
                            bgcolor: "rgba(255,255,255,0.12)",
                            backdropFilter: "blur(10px)",
                            borderRadius: 3,
                            px: 2,
                            "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
                        }}
                    >
                        Back
                    </Button>

                    <Stack sx={{ alignItems: "center" }}>
                        <Typography variant="subtitle1" sx={{ color: "white", fontWeight: 800 }}>
                            {targetName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                            {remoteConnected ? formatDuration(callSeconds) : callStatusText}
                        </Typography>
                    </Stack>

                    <Chip
                        label={remoteConnected ? "Live" : "Ringing"}
                        color={remoteConnected ? "success" : "warning"}
                        size="small"
                        sx={{ fontWeight: 800, height: 24 }}
                    />
                </Box>

                {/* 4. WHATSAPP-STYLE FLOATING BOTTOM CONTROLS CAPSULE */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: { xs: "max(24px, env(safe-area-inset-bottom))", sm: 32 },
                        left: 0,
                        right: 0,
                        display: "flex",
                        justifyContent: "center",
                        zIndex: 25,
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: { xs: 2, sm: 2.5 },
                            bgcolor: "rgba(18, 27, 34, 0.9)",
                            backdropFilter: "blur(20px)",
                            px: { xs: 3, sm: 4 },
                            py: 1.5,
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
                        }}
                    >
                        {/* Mic Button */}
                        <Tooltip title={audioMuted ? "Unmute" : "Mute"}>
                            <IconButton
                                onClick={toggleAudio}
                                sx={{
                                    bgcolor: audioMuted ? "error.main" : "rgba(255,255,255,0.15)",
                                    color: "white",
                                    width: { xs: 48, sm: 54 },
                                    height: { xs: 48, sm: 54 },
                                    "&:hover": { bgcolor: audioMuted ? "error.dark" : "rgba(255,255,255,0.25)" },
                                }}
                            >
                                {audioMuted ? <MicOffIcon /> : <MicIcon />}
                            </IconButton>
                        </Tooltip>

                        {/* Video Button */}
                        <Tooltip title={videoMuted ? "Turn Video On" : "Turn Video Off"}>
                            <IconButton
                                onClick={toggleVideo}
                                sx={{
                                    bgcolor: videoMuted ? "error.main" : "rgba(255,255,255,0.15)",
                                    color: "white",
                                    width: { xs: 48, sm: 54 },
                                    height: { xs: 48, sm: 54 },
                                    "&:hover": { bgcolor: videoMuted ? "error.dark" : "rgba(255,255,255,0.25)" },
                                }}
                            >
                                {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
                            </IconButton>
                        </Tooltip>

                        {/* Screen Share (Officers Only) */}
                        {canLeadMeeting && (
                            <Tooltip title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                                <IconButton
                                    onClick={toggleScreenShare}
                                    sx={{
                                        bgcolor: isScreenSharing ? "info.main" : "rgba(255,255,255,0.15)",
                                        color: "white",
                                        width: { xs: 48, sm: 54 },
                                        height: { xs: 48, sm: 54 },
                                        "&:hover": { bgcolor: isScreenSharing ? "info.dark" : "rgba(255,255,255,0.25)" },
                                    }}
                                >
                                    {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                </IconButton>
                            </Tooltip>
                        )}

                        {/* End Call Button */}
                        <Tooltip title="End Call">
                            <IconButton
                                onClick={handleEndCall}
                                sx={{
                                    bgcolor: "#ea0038",
                                    color: "white",
                                    width: { xs: 54, sm: 60 },
                                    height: { xs: 54, sm: 60 },
                                    "&:hover": { bgcolor: "#c0002e" },
                                    boxShadow: "0 6px 20px rgba(234,0,56,0.5)",
                                }}
                            >
                                <CallEndIcon fontSize="large" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>
        );
    }

    // =========================================================================
    // VIEW 2: LOBBY & INITIATION INTERFACE
    // =========================================================================
    return (
        <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 }, minHeight: "100vh", display: "flex", alignItems: "center" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 5 }, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <VideoCallIcon color="primary" sx={{ fontSize: 64, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, color: "primary.main" }}>
                    {t("calling_title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Instant WhatsApp-style 1-on-1 calls & Lions Club group conferences.
                </Typography>

                <Stack spacing={2.5}>
                    {canLeadMeeting ? (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<VideoCallIcon fontSize="large" />}
                            onClick={handleStartGroupCall}
                            sx={{ py: 1.8, fontWeight: 800, borderRadius: 3, fontSize: "1.05rem" }}
                        >
                            Start Club Conference (Ring All)
                        </Button>
                    ) : (
                        <Alert severity="info" sx={{ textAlign: "left", borderRadius: 3 }}>
                            Club conferences can be initiated by President, Secretary, or Planner.
                        </Alert>
                    )}

                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<GroupAddIcon fontSize="large" />}
                        onClick={() => setMembersModalOpen(true)}
                        sx={{ py: 1.8, fontWeight: 800, borderRadius: 3, fontSize: "1.05rem" }}
                    >
                        Call Specific Member (1-on-1)
                    </Button>

                    <Button onClick={onBack} sx={{ mt: 1, fontWeight: 700 }}>
                        {t("back_to_dashboard")}
                    </Button>
                </Stack>
            </Paper>

            {/* Select Member Dialog */}
            <Dialog
                open={membersModalOpen}
                onClose={() => setMembersModalOpen(false)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { borderRadius: 4, p: 1 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Select Member to Call</DialogTitle>
                <DialogContent>
                    <List>
                        {members.map((m) => (
                            <ListItemButton
                                key={m.id}
                                onClick={() => handleStartDirectCall(m)}
                                sx={{ borderRadius: 2.5, mb: 1, p: 1.5 }}
                            >
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: "primary.main", fontWeight: 700 }}>
                                        {m.full_name.charAt(0)}
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography sx={{ fontWeight: 800 }}>{m.full_name}</Typography>}
                                    secondary={m.role}
                                />
                                <Button size="small" variant="contained" color="success" sx={{ borderRadius: 2, fontWeight: 700 }}>
                                    Call
                                </Button>
                            </ListItemButton>
                        ))}
                    </List>
                </DialogContent>
            </Dialog>
        </Container>
    );
};