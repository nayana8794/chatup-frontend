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

    const [inCall, setInCall] = useState<boolean>(Boolean(initialRoomId));
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Members list modal for direct calling
    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);

    // WebRTC Stream References
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Fetch club members for direct calling
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

    // Clean up all streams and peer connections
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
    }, []);

    // Initialize WebRTC Call Session
    const startWebRTCSession = useCallback(
        async (roomId: string, isInitiator: boolean) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                const pc = new RTCPeerConnection(RTC_CONFIG);
                peerConnectionRef.current = pc;

                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                pc.ontrack = (event) => {
                    if (remoteVideoRef.current && event.streams[0]) {
                        remoteVideoRef.current.srcObject = event.streams[0];
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
                    }
                };

                setInCall(true);
            } catch (err) {
                console.error("WebRTC Error:", err);
                alert("Could not access camera or microphone. Please allow permissions.");
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
        } catch (err) {
            console.error(err);
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
        } catch (err) {
            console.error(err);
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

    // ================= VIEW 1: ACTIVE LIVE CALL VIEW =================
    if (inCall) {
        return (
            <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "#111" }}>
                {/* Top Header */}
                <Box
                    sx={{
                        p: 2,
                        bgcolor: "rgba(0,0,0,0.8)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        color: "white",
                        zIndex: 10,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <VideoCallIcon color="success" />
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Live Video Meeting
                        </Typography>
                        <Chip label="Connected (P2P Encrypted)" color="success" size="small" sx={{ fontWeight: 800 }} />
                    </Box>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CallEndIcon />}
                        onClick={handleEndCall}
                        sx={{ fontWeight: 900, px: 3, borderRadius: 3 }}
                    >
                        End Call
                    </Button>
                </Box>

                {/* Video Stage */}
                <Box
                    sx={{
                        flex: 1,
                        p: 2,
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 2,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                    }}
                >
                    {/* Local Video Tile */}
                    <Paper
                        elevation={4}
                        sx={{
                            position: "relative",
                            height: "100%",
                            minHeight: 280,
                            bgcolor: "#222",
                            borderRadius: 3,
                            overflow: "hidden",
                            border: "2px solid #333",
                        }}
                    >
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 12,
                                left: 12,
                                bgcolor: "rgba(0,0,0,0.7)",
                                color: "white",
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2,
                                fontWeight: 700,
                            }}
                        >
                            You ({user?.full_name}) {audioMuted && "🔇"}
                        </Box>
                    </Paper>

                    {/* Remote Peer Video Tile */}
                    <Paper
                        elevation={4}
                        sx={{
                            position: "relative",
                            height: "100%",
                            minHeight: 280,
                            bgcolor: "#1a1a1a",
                            borderRadius: 3,
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
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 12,
                                left: 12,
                                bgcolor: "rgba(0,0,0,0.7)",
                                color: "white",
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2,
                                fontWeight: 700,
                            }}
                        >
                            Club Participant (Connected)
                        </Box>
                    </Paper>
                </Box>

                {/* Bottom Control Bar */}
                <Box
                    sx={{
                        py: 2.5,
                        px: 2,
                        bgcolor: "rgba(0,0,0,0.9)",
                        display: "flex",
                        justifyContent: "center",
                        gap: { xs: 2, sm: 3 },
                        alignItems: "center",
                    }}
                >
                    <Tooltip title={audioMuted ? "Unmute Mic" : "Mute Mic"}>
                        <IconButton
                            onClick={toggleAudio}
                            sx={{
                                bgcolor: audioMuted ? "error.main" : "grey.800",
                                color: "white",
                                p: 2,
                                "&:hover": { bgcolor: audioMuted ? "error.dark" : "grey.700" },
                            }}
                        >
                            {audioMuted ? <MicOffIcon fontSize="large" /> : <MicIcon fontSize="large" />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={videoMuted ? "Turn On Camera" : "Turn Off Camera"}>
                        <IconButton
                            onClick={toggleVideo}
                            sx={{
                                bgcolor: videoMuted ? "error.main" : "grey.800",
                                color: "white",
                                p: 2,
                                "&:hover": { bgcolor: videoMuted ? "error.dark" : "grey.700" },
                            }}
                        >
                            {videoMuted ? <VideocamOffIcon fontSize="large" /> : <VideocamIcon fontSize="large" />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                        <IconButton
                            onClick={toggleScreenShare}
                            sx={{
                                bgcolor: isScreenSharing ? "info.main" : "grey.800",
                                color: "white",
                                p: 2,
                                "&:hover": { bgcolor: isScreenSharing ? "info.dark" : "grey.700" },
                            }}
                        >
                            {isScreenSharing ? <StopScreenShareIcon fontSize="large" /> : <ScreenShareIcon fontSize="large" />}
                        </IconButton>
                    </Tooltip>

                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CallEndIcon />}
                        onClick={handleEndCall}
                        sx={{
                            fontWeight: 900,
                            minHeight: 56,
                            px: 4,
                            borderRadius: 4,
                            fontSize: "1.1rem",
                        }}
                    >
                        Leave Meeting
                    </Button>
                </Box>
            </Box>
        );
    }

    // ================= VIEW 2: LOBBY & CALL INITIATOR =================
    return (
        <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 8 }, display: "flex", alignItems: "center", minHeight: "100vh" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 5 }, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <Box sx={{ mb: 3 }}>
                    <VideoCallIcon color="primary" sx={{ fontSize: 65, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
                        {t("calling_title")}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Start a live video meeting or ring any club member directly.
                    </Typography>
                </Box>

                <Stack spacing={2.5} sx={{ mb: 4 }}>
                    {/* Option 1: Start Group Meeting */}
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

                    {/* Option 2: Direct 1-on-1 Call */}
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

            {/* Select Member to Call Dialog */}
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