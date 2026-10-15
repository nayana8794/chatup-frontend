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
import VideoCallIcon from "@mui/icons-material/VideoCall";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import CallEndIcon from "@mui/icons-material/CallEnd";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";

interface Member {
    id: string;
    full_name: string;
    role: string;
}

const RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};

export const Calling: React.FC<{ onBack: () => void; initialRoomId?: string }> = ({
    onBack,
    initialRoomId,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    // Only President, VP, Secretary, Vice Secretary, Planner, Vice Planner can start group meetings & screen share
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

    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);

    // WebRTC References
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await apiClient.get("/members");
                setMembers(res.data.filter((m: Member) => m.id !== user?.user_id));
            } catch (err) {
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
            wsRef.current.close();
            wsRef.current = null;
        }
        setInCall(false);
        setRemoteConnected(false);
    }, []);

    // WebRTC Session Initializer with iOS Safari Autoplay Fix
    const startWebRTCSession = useCallback(
        async (roomId: string, isInitiator: boolean) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                    audio: true,
                });

                localStreamRef.current = stream;

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                    localVideoRef.current.onloadedmetadata = () => {
                        localVideoRef.current?.play().catch(() => { });
                    };
                }

                const pc = new RTCPeerConnection(RTC_CONFIG);
                peerConnectionRef.current = pc;

                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                pc.ontrack = (event) => {
                    if (remoteVideoRef.current && event.streams[0]) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        remoteVideoRef.current.onloadedmetadata = () => {
                            remoteVideoRef.current?.play().catch(() => { });
                        };
                        setRemoteConnected(true);
                    }
                };

                const token = localStorage.getItem("chatup_token");
                const ws = new WebSocket(`ws://127.0.0.1:8000/api/v1/calling/ws/${roomId}?token=${token}`);
                wsRef.current = ws;

                pc.onicecandidate = (event) => {
                    if (event.candidate && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
                    }
                };

                ws.onopen = async () => {
                    if (isInitiator) {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        ws.send(JSON.stringify({ type: "offer", offer }));
                    }
                };

                ws.onmessage = async (e) => {
                    const data = JSON.parse(e.data);

                    if (data.type === "offer") {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        ws.send(JSON.stringify({ type: "answer", answer }));
                    } else if (data.type === "answer") {
                        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    } else if (data.type === "candidate" && data.candidate) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                        } catch (err) {
                            console.warn("ICE candidate error:", err);
                        }
                    } else if (data.type === "peer-left") {
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = null;
                        }
                        setRemoteConnected(false);
                    }
                };

                setInCall(true);
            } catch (err) {
                console.error("WebRTC Error:", err);
                alert("Could not access camera or microphone. Please check browser permissions.");
            }
        },
        []
    );

    useEffect(() => {
        if (initialRoomId) {
            startWebRTCSession(initialRoomId, false);
        }
        return () => {
            stopAllMedia();
        };
    }, [initialRoomId, startWebRTCSession, stopAllMedia]);

    const handleStartGroupCall = async () => {
        const roomId = `club-meeting-${user?.tenant_id || "general"}`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: roomId,
                call_type: "video",
            });
            startWebRTCSession(roomId, true);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error starting conference.");
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
            startWebRTCSession(roomId, true);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error starting call.");
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
        if (!canLeadMeeting) {
            alert("Screen sharing is reserved for authorized Club Officers.");
            return;
        }
        if (!peerConnectionRef.current) return;

        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                const sender = peerConnectionRef.current
                    .getSenders()
                    .find((s) => s.track && s.track.kind === "video");
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = screenStream;
                }

                screenTrack.onended = () => {
                    stopScreenSharing();
                };

                setIsScreenSharing(true);
            } catch (err) {
                console.warn("Screen share cancelled:", err);
            }
        } else {
            stopScreenSharing();
        }
    };

    const stopScreenSharing = () => {
        if (!peerConnectionRef.current || !localStreamRef.current) return;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
        if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
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

    // ================= VIEW 1: ACTIVE LIVE CALL VIEW (NATIVE MOBILE APP FEEL) =================
    if (inCall) {
        return (
            <Box
                sx={{
                    height: "100vh",
                    width: "100vw",
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bgcolor: "#000",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    zIndex: 1300,
                }}
            >
                {/* Sleek Mobile-Friendly Top Bar */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        p: { xs: 1.5, sm: 2 },
                        pt: { xs: "max(12px, env(safe-area-inset-top))", sm: 2 },
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
                        zIndex: 20,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <VideoCallIcon sx={{ color: "#4CAF50", fontSize: { xs: 24, sm: 28 } }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "white", fontSize: { xs: "0.95rem", sm: "1.1rem" } }}>
                            Live Meeting
                        </Typography>
                        <Chip
                            label={remoteConnected ? "Live" : "Connecting..."}
                            color={remoteConnected ? "success" : "warning"}
                            size="small"
                            sx={{ fontWeight: 800, height: 20, fontSize: "0.7rem" }}
                        />
                    </Box>

                    <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<CallEndIcon />}
                        onClick={handleEndCall}
                        sx={{ fontWeight: 800, borderRadius: 2.5, px: { xs: 1.5, sm: 2.5 } }}
                    >
                        End
                    </Button>
                </Box>

                {/* Video Stage */}
                {isMobile ? (
                    /* Mobile View: Fullscreen Remote Video + Floating Picture-in-Picture Local Video */
                    <Box sx={{ position: "relative", width: "100%", height: "100%", bgcolor: "#111" }}>
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
                            <Box
                                sx={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    p: 3,
                                    textAlign: "center",
                                }}
                            >
                                <CircularProgress size={45} sx={{ color: "primary.main", mb: 2 }} />
                                <Typography variant="body1" sx={{ color: "white", fontWeight: 700 }}>
                                    Waiting for other members to join...
                                </Typography>
                            </Box>
                        )}

                        {/* Floating PiP Local Self-View */}
                        <Box
                            sx={{
                                position: "absolute",
                                top: 75,
                                right: 16,
                                width: 105,
                                height: 150,
                                borderRadius: 3.5,
                                overflow: "hidden",
                                border: "2px solid rgba(255,255,255,0.4)",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                                bgcolor: "#222",
                                zIndex: 15,
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
                                }}
                            />
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: 4,
                                    left: 4,
                                    bgcolor: "rgba(0,0,0,0.7)",
                                    color: "white",
                                    px: 0.8,
                                    borderRadius: 1,
                                    fontSize: "0.65rem",
                                    fontWeight: 800,
                                }}
                            >
                                You {audioMuted && "🔇"}
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    /* Desktop View: Side-by-Side HD Grid */
                    <Box
                        sx={{
                            flex: 1,
                            p: 3,
                            pt: 9,
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 2.5,
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Paper
                            elevation={4}
                            sx={{
                                position: "relative",
                                height: "100%",
                                maxHeight: 580,
                                bgcolor: "#222",
                                borderRadius: 4,
                                overflow: "hidden",
                                border: "2px solid #333",
                            }}
                        >
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                            />
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: 14,
                                    left: 14,
                                    bgcolor: "rgba(0,0,0,0.7)",
                                    color: "white",
                                    px: 2,
                                    py: 0.8,
                                    borderRadius: 2,
                                    fontWeight: 800,
                                }}
                            >
                                You ({user?.full_name}) {audioMuted && "🔇"}
                            </Box>
                        </Paper>

                        <Paper
                            elevation={4}
                            sx={{
                                position: "relative",
                                height: "100%",
                                maxHeight: 580,
                                bgcolor: "#1a1a1a",
                                borderRadius: 4,
                                overflow: "hidden",
                                border: "2px solid #333",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: remoteConnected ? "block" : "none" }}
                            />
                            {!remoteConnected && (
                                <Typography variant="body1" sx={{ color: "grey.400", fontWeight: 700 }}>
                                    Waiting for participant to connect stream...
                                </Typography>
                            )}
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: 14,
                                    left: 14,
                                    bgcolor: "rgba(0,0,0,0.7)",
                                    color: "white",
                                    px: 2,
                                    py: 0.8,
                                    borderRadius: 2,
                                    fontWeight: 800,
                                }}
                            >
                                Participant Stream
                            </Box>
                        </Paper>
                    </Box>
                )}

                {/* Floating Control Bar */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        pb: { xs: "max(20px, env(safe-area-inset-bottom))", sm: 3 },
                        pt: 2,
                        px: 2,
                        background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: { xs: 2, sm: 3 },
                        zIndex: 20,
                    }}
                >
                    <Tooltip title={audioMuted ? "Unmute" : "Mute"}>
                        <IconButton
                            onClick={toggleAudio}
                            sx={{
                                bgcolor: audioMuted ? "error.main" : "rgba(255,255,255,0.2)",
                                color: "white",
                                p: { xs: 1.5, sm: 2 },
                                backdropFilter: "blur(10px)",
                                "&:hover": { bgcolor: audioMuted ? "error.dark" : "rgba(255,255,255,0.3)" },
                            }}
                        >
                            {audioMuted ? <MicOffIcon fontSize="medium" /> : <MicIcon fontSize="medium" />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={videoMuted ? "Start Video" : "Stop Video"}>
                        <IconButton
                            onClick={toggleVideo}
                            sx={{
                                bgcolor: videoMuted ? "error.main" : "rgba(255,255,255,0.2)",
                                color: "white",
                                p: { xs: 1.5, sm: 2 },
                                backdropFilter: "blur(10px)",
                                "&:hover": { bgcolor: videoMuted ? "error.dark" : "rgba(255,255,255,0.3)" },
                            }}
                        >
                            {videoMuted ? <VideocamOffIcon fontSize="medium" /> : <VideocamIcon fontSize="medium" />}
                        </IconButton>
                    </Tooltip>

                    {canLeadMeeting && (
                        <Tooltip title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                            <IconButton
                                onClick={toggleScreenShare}
                                sx={{
                                    bgcolor: isScreenSharing ? "info.main" : "rgba(255,255,255,0.2)",
                                    color: "white",
                                    p: { xs: 1.5, sm: 2 },
                                    backdropFilter: "blur(10px)",
                                    "&:hover": { bgcolor: isScreenSharing ? "info.dark" : "rgba(255,255,255,0.3)" },
                                }}
                            >
                                {isScreenSharing ? <StopScreenShareIcon fontSize="medium" /> : <ScreenShareIcon fontSize="medium" />}
                            </IconButton>
                        </Tooltip>
                    )}

                    <IconButton
                        onClick={handleEndCall}
                        sx={{
                            bgcolor: "error.main",
                            color: "white",
                            p: { xs: 1.8, sm: 2 },
                            "&:hover": { bgcolor: "error.dark" },
                        }}
                    >
                        <CallEndIcon fontSize="large" />
                    </IconButton>
                </Box>
            </Box>
        );
    }

    // ================= VIEW 2: LOBBY & INITIATOR =================
    return (
        <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 8 }, display: "flex", alignItems: "center", minHeight: "100vh" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 5 }, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <Box sx={{ mb: 3 }}>
                    <VideoCallIcon color="primary" sx={{ fontSize: 65, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
                        {t("calling_title")}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Real-time audio, video conference & screen sharing.
                    </Typography>
                </Box>

                <Stack spacing={2.5} sx={{ mb: 4 }}>
                    {canLeadMeeting ? (
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={<VideoCallIcon fontSize="large" />}
                            onClick={handleStartGroupCall}
                            sx={{ minHeight: 56, fontWeight: 800, fontSize: "1.1rem", borderRadius: 3 }}
                        >
                            Start Club Conference (Ring All)
                        </Button>
                    ) : (
                        <Alert severity="info" icon={<LockPersonIcon />} sx={{ borderRadius: 3, fontWeight: 700, textAlign: "left" }}>
                            Club conferences are initiated by President, Secretary, or Planner. You will be alerted with a live ringtone when a meeting starts.
                        </Alert>
                    )}

                    <Button
                        variant="outlined"
                        color="primary"
                        size="large"
                        startIcon={<GroupAddIcon fontSize="large" />}
                        onClick={() => setMembersModalOpen(true)}
                        sx={{ minHeight: 56, fontWeight: 800, fontSize: "1.1rem", borderRadius: 3 }}
                    >
                        Call Specific Member (1-on-1)
                    </Button>
                </Stack>

                <Button fullWidth variant="text" onClick={onBack} sx={{ fontWeight: 700 }}>
                    {t("back_to_dashboard")}
                </Button>
            </Paper>

            {/* Select Member Dialog */}
            <Dialog
                open={membersModalOpen}
                onClose={() => setMembersModalOpen(false)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Select Member to Call</DialogTitle>
                <DialogContent sx={{ p: 1 }}>
                    <List>
                        {members.map((member) => (
                            <ListItemButton
                                key={member.id}
                                onClick={() => handleStartDirectCall(member)}
                                sx={{ borderRadius: 2, mb: 0.5 }}
                            >
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: "1rem" }}>
                                        {member.full_name.charAt(0)}
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography sx={{ fontWeight: 800 }}>{member.full_name}</Typography>}
                                    secondary={member.role}
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