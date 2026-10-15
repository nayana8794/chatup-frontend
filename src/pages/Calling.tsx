// chatup/frontend/src/pages/Calling.tsx
//
// WhatsApp-style Video Calling with correct WebRTC "perfect negotiation" pattern.
// Root cause of previous failure:
//   1. STUN-only fails on different networks (internet) → added free TURN servers
//   2. Offer sent before the answerer joined → fixed with server-triggered offer (peer-joined)
//   3. ICE candidates dropped before remoteDescription set → fixed with ICE queue drain
//
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Box,
    Typography,
    IconButton,
    Avatar,
    Stack,
    Chip,
    Container,
    Paper,
    Button,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import { SECURE_WS_URL } from "../config";

interface Member {
    id: string;
    full_name: string;
    role: string;
}

// ─── WebRTC ICE Config ───────────────────────────────────────────────────────
// Uses free OpenRelay TURN servers so calls work across the internet (Vercel ↔ Render).
// STUN-only fails when the two peers are on different NATs (almost always on internet).
const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // Free TURN servers from OpenRelay (metered.ca)
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
        {
            urls: "turns:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
        },
    ],
    iceCandidatePoolSize: 10,
};

// ─── Component ───────────────────────────────────────────────────────────────
export const Calling: React.FC<{ onBack: () => void; initialRoomId?: string }> = ({
    onBack,
    initialRoomId,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();

    const canLeadMeeting = [
        "SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT",
        "SECRETARY", "VICE_SECRETARY", "PLANNER", "VICE_PLANNER",
    ].includes(user?.role || "");

    // ── State ─────────────────────────────────────────────────────────────────
    const [inCall, setInCall] = useState(Boolean(initialRoomId));
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [statusText, setStatusText] = useState("Connecting...");
    const [remoteName, setRemoteName] = useState("Member");
    const [membersOpen, setMembersOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const iceBufRef = useRef<RTCIceCandidateInit[]>([]);   // ICE candidate queue
    const makingOfferRef = useRef(false);
    const isInitiatorRef = useRef(false);

    // ── Fetch members for 1-on-1 call selector ────────────────────────────────
    useEffect(() => {
        apiClient.get("/members").then((res) =>
            setMembers(res.data.filter((m: Member) => m.id !== user?.user_id))
        ).catch(() => { });
    }, [user]);

    // ── Clean up everything ───────────────────────────────────────────────────
    const hangUp = useCallback((navigate = true) => {
        // Stop all local media tracks
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;

        // Close peer connection
        pcRef.current?.close();
        pcRef.current = null;

        // Close signaling socket (notify peer first)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try { wsRef.current.send(JSON.stringify({ type: "hangup" })); } catch { /* ignore */ }
            wsRef.current.close();
        }
        wsRef.current = null;
        iceBufRef.current = [];
        makingOfferRef.current = false;

        setInCall(false);
        setRemoteConnected(false);

        if (navigate) onBack();
    }, [onBack]);

    // ── Drain queued ICE candidates ───────────────────────────────────────────
    const drainIceBuf = async (pc: RTCPeerConnection) => {
        while (iceBufRef.current.length > 0) {
            const c = iceBufRef.current.shift()!;
            try { await pc.addIceCandidate(c); } catch { /* ignore */ }
        }
    };

    // ── Build RTCPeerConnection ───────────────────────────────────────────────
    const buildPC = useCallback((stream: MediaStream, ws: WebSocket, initiator: boolean) => {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // ── Remote track arrives → render it ──────────────────────────────────
        pc.ontrack = (evt) => {
            const s = evt.streams?.[0];
            if (!s || !remoteVideoRef.current) return;
            remoteVideoRef.current.srcObject = s;
            remoteVideoRef.current.play().catch(() => { });
            setRemoteConnected(true);
            setStatusText("Connected");
        };

        // ── ICE candidate ready → send to peer ───────────────────────────────
        pc.onicecandidate = (evt) => {
            if (evt.candidate && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "candidate", candidate: evt.candidate.toJSON() }));
            }
        };

        // ── ICE / connection state monitoring ────────────────────────────────
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                setRemoteConnected(true); setStatusText("Connected");
            } else if (pc.iceConnectionState === "failed") {
                setStatusText("Connection failed – try again");
            }
        };

        // ── Negotiation needed (e.g. screen share track change) ───────────────
        pc.onnegotiationneeded = async () => {
            if (!initiator || makingOfferRef.current) return;
            makingOfferRef.current = true;
            try {
                const offer = await pc.createOffer();
                if (pc.signalingState !== "stable") return;
                await pc.setLocalDescription(offer);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "offer", offer: pc.localDescription }));
                }
            } catch { /* ignore */ } finally {
                makingOfferRef.current = false;
            }
        };

        return pc;
    }, []);

    // ── Core: start a WebRTC session ──────────────────────────────────────────
    const startCall = useCallback(async (roomId: string, initiator: boolean) => {
        isInitiatorRef.current = initiator;
        setStatusText(initiator ? "Ringing…" : "Joining call…");
        setInCall(true);

        // 1. Get local camera/mic
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true },
            });
        } catch {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch {
                alert("Camera/mic access denied. Cannot start call.");
                onBack(); return;
            }
        }
        localStreamRef.current = stream;

        // Show local preview
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => { });
        }

        // 2. Open signaling WebSocket
        const token = localStorage.getItem("chatup_token");
        const wsUrl = `${SECURE_WS_URL}/api/v1/calling/ws/${roomId}?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        // 3. Build the PeerConnection (needs ws reference to send candidates)
        const pc = buildPC(stream, ws, initiator);

        // ── WebSocket events ──────────────────────────────────────────────────
        ws.onopen = () => {
            setStatusText(initiator ? "Waiting for member to answer…" : "Joining…");
        };

        ws.onerror = () => {
            setStatusText("Signaling error – reconnect");
        };

        ws.onclose = () => {
            if (inCall) setStatusText("Disconnected");
        };

        ws.onmessage = async (evt) => {
            let msg: { type: string; [k: string]: unknown };
            try { msg = JSON.parse(evt.data as string); }
            catch { return; }

            const { type } = msg;

            // ── A new peer arrived; if I'm initiator I create the offer now ──
            if (type === "peer-joined") {
                setRemoteName((msg.peer_name as string) || "Member");
                setStatusText("Peer joined – exchanging video…");
                if (initiator) {
                    makingOfferRef.current = true;
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        ws.send(JSON.stringify({ type: "offer", offer: pc.localDescription }));
                    } catch { /* ignore */ } finally {
                        makingOfferRef.current = false;
                    }
                }
            }

            // ── Received an offer (I'm the answerer) ──────────────────────────
            else if (type === "offer") {
                setStatusText("Connecting…");
                await pc.setRemoteDescription(new RTCSessionDescription(msg.offer as RTCSessionDescriptionInit));
                await drainIceBuf(pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: "answer", answer: pc.localDescription }));
            }

            // ── Received an answer (I'm the initiator) ────────────────────────
            else if (type === "answer") {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.answer as RTCSessionDescriptionInit));
                await drainIceBuf(pc);
            }

            // ── ICE candidate from peer ───────────────────────────────────────
            else if (type === "candidate" && msg.candidate) {
                const cand = new RTCIceCandidate(msg.candidate as RTCIceCandidateInit);
                if (pc.remoteDescription) {
                    try { await pc.addIceCandidate(cand); } catch { /* ignore */ }
                } else {
                    iceBufRef.current.push(msg.candidate as RTCIceCandidateInit);
                }
            }

            // ── Peer left or hung up ──────────────────────────────────────────
            else if (type === "peer-left" || type === "hangup") {
                setRemoteConnected(false);
                setStatusText("Call ended");
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            }
        };
    }, [buildPC, inCall, onBack]);

    // ── Auto-join when opened via IncomingCallModal ───────────────────────────
    useEffect(() => {
        if (initialRoomId) {
            void startCall(initialRoomId, false);     // receiver is NOT initiator
        }
        return () => { hangUp(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Controls ──────────────────────────────────────────────────────────────
    const toggleAudio = () => {
        localStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = !t.enabled;
            setAudioMuted(!t.enabled);
        });
    };

    const toggleVideo = () => {
        localStreamRef.current?.getVideoTracks().forEach((t) => {
            t.enabled = !t.enabled;
            setVideoMuted(!t.enabled);
        });
    };

    const toggleScreen = async () => {
        if (!pcRef.current) return;
        if (!isScreenSharing) {
            try {
                const scr = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const track = scr.getVideoTracks()[0];
                const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
                if (sender) await sender.replaceTrack(track);
                if (localVideoRef.current) localVideoRef.current.srcObject = scr;
                track.onended = () => void stopScreen();
                setIsScreenSharing(true);
            } catch { /* user cancelled */ }
        } else { await stopScreen(); }
    };

    const stopScreen = async () => {
        if (!pcRef.current || !localStreamRef.current) return;
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(localStreamRef.current.getVideoTracks()[0]);
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        setIsScreenSharing(false);
    };

    // ── Initiate calls from Lobby ─────────────────────────────────────────────
    const startGroupCall = async () => {
        const roomId = `club-meeting-${user?.tenant_id || "general"}`;
        try {
            await apiClient.post("/calling/initiate", { room_id: roomId, call_type: "video" });
            void startCall(roomId, true);            // caller IS initiator
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail || "Error starting conference");
        }
    };

    const startDirectCall = async (target: Member) => {
        setMembersOpen(false);
        const roomId = `direct-call-${[user?.user_id, target.id].sort().join("-")}`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: roomId, call_type: "video", target_user_id: target.id,
            });
            void startCall(roomId, true);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail || "Error starting call");
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: IN-CALL (WhatsApp-style fullscreen)
    // ─────────────────────────────────────────────────────────────────────────
    if (inCall) {
        return (
            <Box
                sx={{
                    position: "fixed",
                    inset: 0,
                    bgcolor: "#0d0d0d",
                    display: "flex",
                    flexDirection: "column",
                    zIndex: 9999,
                    fontFamily: "inherit",
                }}
            >
                {/* ── Remote video (full background) ────────────────────────── */}
                <Box sx={{ position: "absolute", inset: 0, bgcolor: "#111" }}>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            opacity: remoteConnected ? 1 : 0,
                            transition: "opacity 0.4s ease",
                        }}
                    />

                    {/* Waiting overlay */}
                    {!remoteConnected && (
                        <Box
                            sx={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                            }}
                        >
                            <Avatar
                                sx={{
                                    width: 100,
                                    height: 100,
                                    bgcolor: "primary.main",
                                    fontSize: "2.5rem",
                                    animation: "pulse 2s ease-in-out infinite",
                                    "@keyframes pulse": {
                                        "0%, 100%": { boxShadow: "0 0 0 0 rgba(25,118,210,0.5)" },
                                        "50%": { boxShadow: "0 0 0 24px rgba(25,118,210,0)" },
                                    },
                                }}
                            >
                                {remoteName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="h5" sx={{ color: "white", fontWeight: 800 }}>
                                {remoteName}
                            </Typography>
                            <Chip
                                label={statusText}
                                size="small"
                                sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "white", fontWeight: 700, fontSize: "0.85rem" }}
                            />
                        </Box>
                    )}
                </Box>

                {/* ── Top status bar ────────────────────────────────────────── */}
                <Box
                    sx={{
                        position: "relative",
                        zIndex: 10,
                        px: 2,
                        pt: "max(16px, env(safe-area-inset-top))",
                        pb: 1.5,
                        background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {remoteConnected && (
                        <Chip
                            label="🔴 Live"
                            size="small"
                            sx={{ bgcolor: "error.main", color: "white", fontWeight: 800, fontSize: "0.78rem" }}
                        />
                    )}
                </Box>

                {/* ── Local PiP (bottom-left corner, like WhatsApp) ─────────── */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 120,
                        right: 16,
                        width: { xs: 90, sm: 120 },
                        height: { xs: 140, sm: 180 },
                        borderRadius: 3,
                        overflow: "hidden",
                        border: "2px solid rgba(255,255,255,0.3)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                        bgcolor: "#222",
                        zIndex: 20,
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
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <VideocamOffIcon sx={{ color: "rgba(255,255,255,0.5)", fontSize: 32 }} />
                        </Box>
                    )}
                    <Typography
                        variant="caption"
                        sx={{
                            position: "absolute",
                            bottom: 4,
                            left: 6,
                            color: "white",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                        }}
                    >
                        You
                    </Typography>
                </Box>

                {/* ── Bottom controls (WhatsApp-style) ─────────────────────── */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        pb: "max(24px, env(safe-area-inset-bottom))",
                        pt: 2,
                        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
                    }}
                >
                    <Stack direction="row" spacing={3} sx={{ justifyContent: "center", alignItems: "center" }}>
                        {/* Mic */}
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                            <IconButton
                                onClick={toggleAudio}
                                sx={{
                                    width: 58, height: 58,
                                    bgcolor: audioMuted ? "error.main" : "rgba(255,255,255,0.15)",
                                    backdropFilter: "blur(8px)",
                                    color: "white",
                                    "&:hover": { bgcolor: audioMuted ? "error.dark" : "rgba(255,255,255,0.25)" },
                                    transition: "all 0.2s",
                                }}
                            >
                                {audioMuted ? <MicOffIcon /> : <MicIcon />}
                            </IconButton>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.65rem" }}>
                                {audioMuted ? "Unmute" : "Mute"}
                            </Typography>
                        </Box>

                        {/* Camera */}
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                            <IconButton
                                onClick={toggleVideo}
                                sx={{
                                    width: 58, height: 58,
                                    bgcolor: videoMuted ? "error.main" : "rgba(255,255,255,0.15)",
                                    backdropFilter: "blur(8px)",
                                    color: "white",
                                    "&:hover": { bgcolor: videoMuted ? "error.dark" : "rgba(255,255,255,0.25)" },
                                    transition: "all 0.2s",
                                }}
                            >
                                {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
                            </IconButton>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.65rem" }}>
                                {videoMuted ? "Camera On" : "Camera Off"}
                            </Typography>
                        </Box>

                        {/* Screen Share (officers only) */}
                        {canLeadMeeting && (
                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                                <IconButton
                                    onClick={toggleScreen}
                                    sx={{
                                        width: 58, height: 58,
                                        bgcolor: isScreenSharing ? "info.main" : "rgba(255,255,255,0.15)",
                                        backdropFilter: "blur(8px)",
                                        color: "white",
                                        "&:hover": { bgcolor: isScreenSharing ? "info.dark" : "rgba(255,255,255,0.25)" },
                                        transition: "all 0.2s",
                                    }}
                                >
                                    {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                </IconButton>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.65rem" }}>
                                    {isScreenSharing ? "Stop Share" : "Share"}
                                </Typography>
                            </Box>
                        )}

                        {/* End Call */}
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                            <IconButton
                                onClick={() => hangUp(true)}
                                sx={{
                                    width: 68, height: 68,
                                    bgcolor: "#f44336",
                                    color: "white",
                                    boxShadow: "0 4px 16px rgba(244,67,54,0.5)",
                                    "&:hover": { bgcolor: "#c62828", transform: "scale(1.08)" },
                                    transition: "all 0.2s",
                                }}
                            >
                                <CallEndIcon sx={{ fontSize: 28 }} />
                            </IconButton>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.65rem" }}>
                                End
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
            </Box>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER: LOBBY (call initiation)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Container maxWidth="xs" sx={{ py: 6, minHeight: "100vh", display: "flex", alignItems: "center" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 5 }, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <VideoCallIcon color="primary" sx={{ fontSize: 64, mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
                    {t("calling_title", "Video & Audio Calls")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Real-time video, audio & screen sharing
                </Typography>

                <Stack spacing={2}>
                    {canLeadMeeting ? (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<VideoCallIcon />}
                            onClick={startGroupCall}
                            sx={{ py: 1.5, fontWeight: 800, borderRadius: 3 }}
                        >
                            Start Club Meeting
                        </Button>
                    ) : (
                        <Alert severity="info" sx={{ textAlign: "left", borderRadius: 2 }}>
                            Club meetings are started by President, Secretary, or Planner.
                            You'll receive a call notification when one starts.
                        </Alert>
                    )}

                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<GroupAddIcon />}
                        onClick={() => setMembersOpen(true)}
                        sx={{ py: 1.5, fontWeight: 800, borderRadius: 3 }}
                    >
                        Call a Member
                    </Button>

                    <Button onClick={onBack} sx={{ fontWeight: 700 }}>
                        {t("back_to_dashboard", "← Dashboard")}
                    </Button>
                </Stack>
            </Paper>

            {/* Member picker dialog */}
            <Dialog
                open={membersOpen}
                onClose={() => setMembersOpen(false)}
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { sx: { borderRadius: 3 } } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Call a Member</DialogTitle>
                <DialogContent>
                    {members.length === 0 && (
                        <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                            No other members available
                        </Typography>
                    )}
                    <List>
                        {members.map((m) => (
                            <ListItemButton
                                key={m.id}
                                onClick={() => startDirectCall(m)}
                                sx={{ borderRadius: 2, mb: 0.5 }}
                            >
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: "primary.main" }}>{m.full_name.charAt(0)}</Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography sx={{ fontWeight: 800 }}>{m.full_name}</Typography>}
                                    secondary={m.role}
                                />
                                <Button size="small" variant="contained" color="success" sx={{ borderRadius: 2, fontWeight: 800 }}>
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