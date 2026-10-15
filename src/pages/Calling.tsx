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
    useMediaQuery,
    useTheme,
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
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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

    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
    const isMakingOfferRef = useRef(false);

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
        setInCall(false);
        setRemoteConnected(false);
        setCallStatusText("Disconnected");
    }, []);

    // Safe helper to drain queued ICE candidates after setRemoteDescription
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

    // Helper to generate and transmit WebRTC Offer
    const sendOffer = useCallback(async (pc: RTCPeerConnection, ws: WebSocket) => {
        if (isMakingOfferRef.current) return;
        try {
            isMakingOfferRef.current = true;
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            if (pc.signalingState !== "stable") return;
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
                setCallStatusText("Accessing camera & microphone...");
                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    });
                } catch {
                    // Fallback to audio-only if camera is unavailable or denied
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                }

                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.onloadedmetadata = () => {
                        localVideoRef.current?.play().catch(() => { });
                    };
                }

                const pc = new RTCPeerConnection(RTC_CONFIG);
                peerConnectionRef.current = pc;

                // Add local tracks to peer connection
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                // Handle incoming remote stream tracks
                pc.ontrack = (event) => {
                    if (remoteVideoRef.current && event.streams && event.streams[0]) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setRemoteConnected(true);
                        setCallStatusText("Connected");
                        remoteVideoRef.current.play().catch((err) => {
                            console.warn("Remote playback notice:", err);
                        });
                    }
                };

                // Track connection health
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
                    setCallStatusText(isInitiator ? "Waiting for member to answer..." : "Connecting to call...");
                    // Notify room that this peer is ready
                    ws.send(JSON.stringify({ type: "ready", is_initiator: isInitiator }));

                    // If initiator, send offer
                    if (isInitiator) {
                        void sendOffer(pc, ws);
                    }
                };

                ws.onmessage = async (e) => {
                    try {
                        const data = JSON.parse(e.data);

                        // When a new peer arrives or announces ready, the initiator sends an offer
                        if (data.type === "peer-joined" || data.type === "ready") {
                            setCallStatusText("Member joined, exchanging video...");
                            if (isInitiator) {
                                void sendOffer(pc, ws);
                            }
                        } else if (data.type === "offer") {
                            setCallStatusText("Connecting audio & video...");
                            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                            await drainPendingCandidates(pc);

                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: "answer", answer }));
                            }
                        } else if (data.type === "answer") {
                            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                            await drainPendingCandidates(pc);
                        } else if (data.type === "candidate" && data.candidate) {
                            const iceCandidate = new RTCIceCandidate(data.candidate);
                            if (pc.remoteDescription && pc.remoteDescription.type) {
                                try {
                                    await pc.addIceCandidate(iceCandidate);
                                } catch (err) {
                                    console.warn("Failed to add ICE candidate:", err);
                                }
                            } else {
                                // Buffer until remote description is set
                                pendingCandidatesRef.current.push(iceCandidate);
                            }
                        } else if (data.type === "peer-left" || data.type === "hangup") {
                            setRemoteConnected(false);
                            setCallStatusText("Call ended by member");
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.srcObject = null;
                            }
                        }
                    } catch (err) {
                        console.error("Signaling message handling error:", err);
                    }
                };

                setInCall(true);
            } catch (err) {
                console.error("WebRTC Setup error:", err);
                alert("Could not access camera or microphone. Please check your browser permissions.");
            }
        },
        [sendOffer]
    );

    useEffect(() => {
        if (initialRoomId) {
            const timer = setTimeout(() => {
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
        try {
            await apiClient.post("/calling/initiate", { room_id: roomId, call_type: "video" });
            void startWebRTCSession(roomId, true);
        } catch (err: unknown) {
            const errorObj = err as { response?: { data?: { detail?: string } } };
            alert(errorObj.response?.data?.detail || "Error starting conference.");
        }
    };

    const handleStartDirectCall = async (targetMember: Member) => {
        setMembersModalOpen(false);
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
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screenStream;
                }
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
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
        setIsScreenSharing(false);
    };

    const handleEndCall = () => {
        stopAllMedia();
        onBack();
    };

    if (inCall) {
        return (
            <Box sx={{ height: "100vh", bgcolor: "#000", display: "flex", flexDirection: "column" }}>
                {/* Top Header with Status and Action */}
                <Box
                    sx={{
                        p: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        zIndex: 20,
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)",
                    }}
                >
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={handleEndCall}
                        variant="outlined"
                        sx={{ color: "white", borderColor: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                    >
                        End Call
                    </Button>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Typography variant="h6" sx={{ color: "white", fontWeight: 800 }}>
                            Live Meeting
                        </Typography>
                        <Chip
                            label={remoteConnected ? "Live" : callStatusText}
                            color={remoteConnected ? "success" : "warning"}
                            size="small"
                            sx={{ fontWeight: 800, height: 22 }}
                        />
                    </Box>
                </Box>

                {/* Video Grid (Responsive for Mobile and Desktop) */}
                <Box
                    sx={{
                        flex: 1,
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                        gap: 1.5,
                        p: 1.5,
                        minHeight: 0,
                    }}
                >
                    {/* Local Video Box */}
                    <Box
                        sx={{
                            position: "relative",
                            bgcolor: "#111",
                            borderRadius: 3,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
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
                        {videoMuted && (
                            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                                Camera is off
                            </Typography>
                        )}
                        <Typography
                            variant="caption"
                            sx={{
                                position: "absolute",
                                bottom: 10,
                                left: 10,
                                bgcolor: "rgba(0,0,0,0.65)",
                                color: "white",
                                px: 1.2,
                                py: 0.5,
                                borderRadius: 1.5,
                                fontWeight: 700,
                            }}
                        >
                            You {audioMuted && "(Muted)"}
                        </Typography>
                    </Box>

                    {/* Remote Video Box */}
                    <Box
                        sx={{
                            position: "relative",
                            bgcolor: "#111",
                            borderRadius: 3,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: remoteConnected ? "block" : "none",
                            }}
                        />
                        {!remoteConnected && (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 3, textAlign: "center" }}>
                                <CircularProgress size={36} sx={{ color: "primary.main", mb: 2 }} />
                                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
                                    {callStatusText}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>

                {/* Floating Bottom Control Actions */}
                <Stack
                    direction="row"
                    spacing={2}
                    sx={{
                        p: { xs: 2, sm: 3 },
                        justifyContent: "center",
                        alignItems: "center",
                        bgcolor: "rgba(0,0,0,0.92)",
                    }}
                >
                    <Tooltip title={audioMuted ? "Unmute Mic" : "Mute Mic"}>
                        <IconButton
                            onClick={toggleAudio}
                            sx={{
                                color: "white",
                                bgcolor: audioMuted ? "error.main" : "grey.700",
                                p: 1.5,
                                "&:hover": { bgcolor: audioMuted ? "error.dark" : "grey.800" },
                            }}
                        >
                            {audioMuted ? <MicOffIcon /> : <MicIcon />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={videoMuted ? "Turn Camera On" : "Turn Camera Off"}>
                        <IconButton
                            onClick={toggleVideo}
                            sx={{
                                color: "white",
                                bgcolor: videoMuted ? "error.main" : "grey.700",
                                p: 1.5,
                                "&:hover": { bgcolor: videoMuted ? "error.dark" : "grey.800" },
                            }}
                        >
                            {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
                        </IconButton>
                    </Tooltip>

                    {canLeadMeeting && (
                        <Tooltip title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}>
                            <IconButton
                                onClick={toggleScreenShare}
                                sx={{
                                    color: "white",
                                    bgcolor: isScreenSharing ? "info.main" : "grey.700",
                                    p: 1.5,
                                    "&:hover": { bgcolor: isScreenSharing ? "info.dark" : "grey.800" },
                                }}
                            >
                                {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </IconButton>
                        </Tooltip>
                    )}

                    <Tooltip title="End Call">
                        <IconButton
                            onClick={handleEndCall}
                            sx={{
                                color: "white",
                                bgcolor: "error.main",
                                p: 1.6,
                                "&:hover": { bgcolor: "error.dark" },
                            }}
                        >
                            <CallEndIcon fontSize="medium" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 }, minHeight: "100vh", display: "flex", alignItems: "center" }}>
            <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 }, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <VideoCallIcon color="primary" sx={{ fontSize: 60, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, color: "primary.main" }}>
                    {t("calling_title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Real-time audio, video conference & screen sharing.
                </Typography>

                <Stack spacing={2}>
                    {canLeadMeeting ? (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<VideoCallIcon />}
                            onClick={handleStartGroupCall}
                            sx={{ py: 1.5, fontWeight: 800, borderRadius: 2.5 }}
                        >
                            Start Club Conference (Ring All)
                        </Button>
                    ) : (
                        <Alert severity="info" sx={{ textAlign: "left", borderRadius: 2.5 }}>
                            Group conferences can be initiated by President, Secretary, or Planner.
                        </Alert>
                    )}

                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<GroupAddIcon />}
                        onClick={() => setMembersModalOpen(true)}
                        sx={{ py: 1.5, fontWeight: 800, borderRadius: 2.5 }}
                    >
                        Call Specific Member (1-on-1)
                    </Button>

                    <Button onClick={onBack} sx={{ mt: 1, fontWeight: 700 }}>
                        {t("back_to_dashboard")}
                    </Button>
                </Stack>
            </Paper>

            <Dialog
                open={membersModalOpen}
                onClose={() => setMembersModalOpen(false)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Select Member to Call</DialogTitle>
                <DialogContent>
                    <List>
                        {members.map((m) => (
                            <ListItemButton key={m.id} onClick={() => handleStartDirectCall(m)} sx={{ borderRadius: 2, mb: 0.5 }}>
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: "primary.main" }}>{m.full_name.charAt(0)}</Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography sx={{ fontWeight: 800 }}>{m.full_name}</Typography>}
                                    secondary={m.role}
                                />
                                <Button size="small" variant="contained" color="success" sx={{ fontWeight: 800, borderRadius: 2 }}>
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