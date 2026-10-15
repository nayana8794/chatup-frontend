// chatup/frontend/src/pages/Calling.tsx
//
// WhatsApp-style Video/Audio Calling - completely rewritten for reliability.
//
// Key design decisions:
//  1. All WebRTC logic lives inside a single imperative `initCall()` function
//     triggered by button clicks or the initialRoomId prop — NO useCallback deps issues.
//  2. TURN servers added so calls work across different internet networks.
//  3. Offer is sent ONLY when "peer-joined" arrives (prevents race condition).
//  4. ICE candidates are queued until remoteDescription is set.
//  5. Refs hold all mutable state — no stale closure issues.
//
import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Typography,
    IconButton,
    Avatar,
    Stack,
    Chip,
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
    CircularProgress,
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import { SECURE_WS_URL } from "../config";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
    id: string;
    full_name: string;
    role: string;
}

// ── ICE server config ─────────────────────────────────────────────────────────
// OpenRelay TURN servers (free) are required for calls across different internet
// networks. STUN alone only works on the same LAN.
const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
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

const OFFICER_ROLES = [
    "SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT",
    "SECRETARY", "VICE_SECRETARY", "PLANNER", "VICE_PLANNER",
];

// ── Component ─────────────────────────────────────────────────────────────────
export const Calling: React.FC<{
    onBack: () => void;
    initialRoomId?: string;
}> = ({ onBack, initialRoomId }) => {
    const { user } = useAuth();
    const isOfficer = OFFICER_ROLES.includes(user?.role ?? "");

    // ── UI state ──────────────────────────────────────────────────────────────
    const [view, setView] = useState<"lobby" | "connecting" | "call">(
        initialRoomId ? "connecting" : "lobby"
    );
    const [statusText, setStatusText] = useState("Connecting…");
    const [remoteName, setRemoteName] = useState("Member");
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [permError, setPermError] = useState("");
    const [starting, setStarting] = useState(false);

    // ── Media / WebRTC refs ───────────────────────────────────────────────────
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const iceBufRef = useRef<RTCIceCandidateInit[]>([]);
    const makingOfferRef = useRef(false);
    const remoteDescSetRef = useRef(false);

    // ── Fetch members list ────────────────────────────────────────────────────
    useEffect(() => {
        apiClient
            .get("/members")
            .then((res) => {
                const data = Array.isArray(res.data) ? res.data : [];
                setMembers(data.filter((m: Member) => m.id !== user?.user_id));
            })
            .catch(() => { });
    }, [user?.user_id]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            doHangUp(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Auto-start when opened via incoming call ──────────────────────────────
    useEffect(() => {
        if (initialRoomId) {
            // Small delay ensures video elements are in the DOM
            const t = setTimeout(() => {
                void initCall(initialRoomId, false);
            }, 300);
            return () => clearTimeout(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRoomId]);

    // ═════════════════════════════════════════════════════════════════════════
    // Core WebRTC engine — kept purely imperative to avoid stale closure issues
    // ═════════════════════════════════════════════════════════════════════════
    async function initCall(roomId: string, isInitiator: boolean) {
        setPermError("");
        setStatusText("Accessing camera & microphone…");
        setRemoteConnected(false);
        remoteDescSetRef.current = false;
        iceBufRef.current = [];
        makingOfferRef.current = false;

        // ── 1. Get local camera/microphone ────────────────────────────────────
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
        } catch {
            try {
                // Audio-only fallback
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setPermError("Camera not available – audio only");
            } catch {
                setPermError("Camera and microphone access denied. Check browser permissions.");
                setView("lobby");
                return;
            }
        }

        localStreamRef.current = stream;
        setView("call");

        // Show local preview — wait a tick for the video element to mount
        requestAnimationFrame(() => {
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(() => { });
            }
        });

        // ── 2. Create RTCPeerConnection ────────────────────────────────────────
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks to the connection
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // ── 3. Remote track received → display it ─────────────────────────────
        pc.ontrack = (evt) => {
            const remoteStream = evt.streams?.[0];
            if (!remoteStream) return;
            // Use RAF so the video element is guaranteed to be in DOM
            requestAnimationFrame(() => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    remoteVideoRef.current.play().catch(() => { });
                    setRemoteConnected(true);
                    setStatusText("Connected");
                }
            });
        };

        // ── 4. ICE candidate → forward to peer ────────────────────────────────
        pc.onicecandidate = (evt) => {
            if (evt.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({ type: "candidate", candidate: evt.candidate.toJSON() })
                );
            }
        };

        pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            if (s === "connected" || s === "completed") {
                setRemoteConnected(true);
                setStatusText("Connected");
            } else if (s === "failed") {
                setStatusText("Connection failed – check your network");
            } else if (s === "disconnected") {
                setStatusText("Reconnecting…");
            }
        };

        // ── 5. Open signaling WebSocket ───────────────────────────────────────
        const token = localStorage.getItem("chatup_token") ?? "";
        const ws = new WebSocket(
            `${SECURE_WS_URL}/api/v1/calling/ws/${roomId}?token=${encodeURIComponent(token)}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
            setStatusText(isInitiator ? "Waiting for member to answer…" : "Joining call…");
        };

        ws.onerror = () => setStatusText("Signaling connection error");

        ws.onclose = () => {
            // Only update status if still in call view
            setStatusText((prev) => (prev === "Connected" ? "Call ended" : prev));
        };

        // ── 6. Signaling message handler ──────────────────────────────────────
        ws.onmessage = async (evt) => {
            let msg: Record<string, unknown>;
            try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; }
            catch { return; }

            const type = msg.type as string;

            if (type === "peer-joined") {
                // A new peer connected → if I'm the initiator, create and send offer NOW
                setRemoteName((msg.peer_name as string) || "Member");
                setStatusText("Member joined – connecting video…");

                if (isInitiator && !makingOfferRef.current) {
                    makingOfferRef.current = true;
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "offer", offer: pc.localDescription }));
                        }
                    } catch (err) {
                        console.error("Offer error:", err);
                    } finally {
                        makingOfferRef.current = false;
                    }
                }
            }

            else if (type === "offer") {
                // Received offer → answer it
                setStatusText("Connecting audio & video…");
                try {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(msg.offer as RTCSessionDescriptionInit)
                    );
                    remoteDescSetRef.current = true;
                    await drainIceBuf(pc);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: "answer", answer: pc.localDescription }));
                    }
                } catch (err) {
                    console.error("Answer error:", err);
                }
            }

            else if (type === "answer") {
                // Received answer → finalize connection
                try {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(msg.answer as RTCSessionDescriptionInit)
                    );
                    remoteDescSetRef.current = true;
                    await drainIceBuf(pc);
                } catch (err) {
                    console.error("setRemoteDescription (answer) error:", err);
                }
            }

            else if (type === "candidate" && msg.candidate) {
                const cand = msg.candidate as RTCIceCandidateInit;
                if (remoteDescSetRef.current) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); }
                    catch { /* ignore */ }
                } else {
                    iceBufRef.current.push(cand);
                }
            }

            else if (type === "peer-left" || type === "hangup") {
                setRemoteConnected(false);
                setStatusText("Call ended by member");
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            }
        };
    }

    async function drainIceBuf(pc: RTCPeerConnection) {
        const buf = iceBufRef.current.splice(0);
        for (const c of buf) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
            catch { /* ignore */ }
        }
    }

    // ── Hang up ───────────────────────────────────────────────────────────────
    function doHangUp(navigate: boolean) {
        // Stop local tracks
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;

        // Close peer connection
        pcRef.current?.close();
        pcRef.current = null;

        // Send hangup signal and close socket
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                try { wsRef.current.send(JSON.stringify({ type: "hangup" })); } catch { /* ignore */ }
            }
            wsRef.current.close();
            wsRef.current = null;
        }

        iceBufRef.current = [];
        remoteDescSetRef.current = false;
        setRemoteConnected(false);
        setView("lobby");

        if (navigate) onBack();
    }

    // ── Mic / Camera / Screen toggle ─────────────────────────────────────────
    function toggleAudio() {
        const tracks = localStreamRef.current?.getAudioTracks() ?? [];
        tracks.forEach((t) => { t.enabled = !t.enabled; });
        setAudioMuted((prev) => !prev);
    }

    function toggleVideo() {
        const tracks = localStreamRef.current?.getVideoTracks() ?? [];
        tracks.forEach((t) => { t.enabled = !t.enabled; });
        setVideoMuted((prev) => !prev);
    }

    async function toggleScreen() {
        if (!pcRef.current || !localStreamRef.current) return;
        if (isScreenSharing) {
            // Restore camera
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
            if (sender && camTrack) await sender.replaceTrack(camTrack);
            if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
            setIsScreenSharing(false);
        } else {
            try {
                const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const scrTrack = scrStream.getVideoTracks()[0];
                const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
                if (sender) await sender.replaceTrack(scrTrack);
                if (localVideoRef.current) localVideoRef.current.srcObject = scrStream;
                scrTrack.onended = () => void toggleScreen();
                setIsScreenSharing(true);
            } catch { /* user cancelled */ }
        }
    }

    // ── Initiate outgoing calls ───────────────────────────────────────────────
    async function startGroupCall() {
        setStarting(true);
        const roomId = `club-meeting-${user?.tenant_id ?? "general"}`;
        try {
            await apiClient.post("/calling/initiate", { room_id: roomId, call_type: "video" });
            await initCall(roomId, true);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail ?? "Error starting conference");
        } finally {
            setStarting(false);
        }
    }

    async function startDirectCall(target: Member) {
        setMembersOpen(false);
        setStarting(true);
        const ids = [user?.user_id ?? "", target.id].sort();
        const roomId = `direct-${ids[0]}-${ids[1]}`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: roomId,
                call_type: "video",
                target_user_id: target.id,
            });
            await initCall(roomId, true);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail ?? "Error calling member");
        } finally {
            setStarting(false);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Connecting overlay (auto-join from incoming call)
    // ═════════════════════════════════════════════════════════════════════════
    if (view === "connecting") {
        return (
            <Box
                sx={{
                    position: "fixed",
                    inset: 0,
                    bgcolor: "#0d0d0d",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    gap: 3,
                }}
            >
                <CircularProgress size={64} sx={{ color: "primary.main" }} />
                <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>
                    Connecting…
                </Typography>
            </Box>
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Active call — WhatsApp-style fullscreen
    // ═════════════════════════════════════════════════════════════════════════
    if (view === "call") {
        return (
            <Box
                sx={{
                    position: "fixed",
                    inset: 0,
                    bgcolor: "#0d0d0d",
                    zIndex: 9999,
                    overflow: "hidden",
                }}
            >
                {/* ── Remote video (full background) ──────────────────────── */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: remoteConnected ? 1 : 0,
                        transition: "opacity 0.5s ease",
                        backgroundColor: "#111",
                    }}
                />

                {/* ── Waiting state (avatar + status) ─────────────────────── */}
                {!remoteConnected && (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 2.5,
                            zIndex: 5,
                        }}
                    >
                        <Avatar
                            sx={{
                                width: 110,
                                height: 110,
                                bgcolor: "primary.main",
                                fontSize: "2.8rem",
                                animation: "ringPulse 2s ease-in-out infinite",
                                "@keyframes ringPulse": {
                                    "0%, 100%": { boxShadow: "0 0 0 0 rgba(33,150,243,0.6)" },
                                    "50%": { boxShadow: "0 0 0 28px rgba(33,150,243,0)" },
                                },
                            }}
                        >
                            {remoteName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography
                            variant="h5"
                            sx={{ color: "white", fontWeight: 800, textShadow: "0 2px 8px #000" }}
                        >
                            {remoteName}
                        </Typography>
                        <Chip
                            label={statusText}
                            sx={{
                                bgcolor: "rgba(255,255,255,0.15)",
                                color: "white",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                backdropFilter: "blur(6px)",
                            }}
                        />
                    </Box>
                )}

                {/* ── Top bar (Live badge when connected) ─────────────────── */}
                {remoteConnected && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            pt: "max(16px, env(safe-area-inset-top))",
                            pb: 2,
                            px: 2,
                            background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)",
                            zIndex: 10,
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        <Chip
                            label="🔴  LIVE"
                            sx={{
                                bgcolor: "#f44336",
                                color: "white",
                                fontWeight: 900,
                                fontSize: "0.78rem",
                                letterSpacing: 1,
                            }}
                        />
                    </Box>
                )}

                {/* ── Local PiP (bottom-right corner, like WhatsApp) ───────── */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 108,
                        right: 14,
                        width: { xs: 88, sm: 116 },
                        height: { xs: 136, sm: 178 },
                        borderRadius: "14px",
                        overflow: "hidden",
                        border: "2.5px solid rgba(255,255,255,0.35)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
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
                        <Box
                            sx={{
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: "#333",
                            }}
                        >
                            <VideocamOffIcon sx={{ color: "rgba(255,255,255,0.45)", fontSize: 30 }} />
                        </Box>
                    )}
                    <Typography
                        variant="caption"
                        sx={{
                            position: "absolute",
                            bottom: 5,
                            left: 7,
                            color: "white",
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                        }}
                    >
                        You
                    </Typography>
                </Box>

                {/* ── Control bar (bottom, frosted glass) ─────────────────── */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        pb: "max(20px, env(safe-area-inset-bottom))",
                        pt: 1.5,
                        background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
                    }}
                >
                    <Stack
                        direction="row"
                        spacing={2.5}
                        sx={{ justifyContent: "center", alignItems: "flex-end" }}
                    >
                        {/* Mic */}
                        <ControlBtn
                            active={audioMuted}
                            label={audioMuted ? "Unmute" : "Mute"}
                            onClick={toggleAudio}
                        >
                            {audioMuted ? <MicOffIcon /> : <MicIcon />}
                        </ControlBtn>

                        {/* Camera */}
                        <ControlBtn
                            active={videoMuted}
                            label={videoMuted ? "Cam On" : "Cam Off"}
                            onClick={toggleVideo}
                        >
                            {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
                        </ControlBtn>

                        {/* End Call (larger red button in center) */}
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                            <IconButton
                                onClick={() => doHangUp(true)}
                                sx={{
                                    width: 66,
                                    height: 66,
                                    bgcolor: "#f44336",
                                    color: "white",
                                    boxShadow: "0 4px 20px rgba(244,67,54,0.6)",
                                    "&:hover": { bgcolor: "#c62828", transform: "scale(1.1)" },
                                    transition: "all 0.2s ease",
                                }}
                            >
                                <CallEndIcon sx={{ fontSize: 30 }} />
                            </IconButton>
                            <Typography
                                variant="caption"
                                sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.63rem" }}
                            >
                                End
                            </Typography>
                        </Box>

                        {/* Screen Share (officers only) */}
                        {isOfficer && (
                            <ControlBtn
                                active={isScreenSharing}
                                activeColor="info.main"
                                label={isScreenSharing ? "Stop" : "Share"}
                                onClick={toggleScreen}
                            >
                                {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </ControlBtn>
                        )}
                    </Stack>
                </Box>
            </Box>
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // RENDER: Lobby
    // ═════════════════════════════════════════════════════════════════════════
    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
                background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
            }}
        >
            <Paper
                elevation={8}
                sx={{
                    p: { xs: 3, sm: 5 },
                    width: "100%",
                    maxWidth: 420,
                    borderRadius: 4,
                    textAlign: "center",
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.12)",
                }}
            >
                <VideoCallIcon
                    sx={{ fontSize: 72, color: "primary.light", mb: 1 }}
                />
                <Typography
                    variant="h5"
                    sx={{ fontWeight: 900, color: "white", mb: 0.5 }}
                >
                    Video & Audio Calls
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 4 }}>
                    Real-time video, audio & screen sharing
                </Typography>

                {permError && (
                    <Alert severity="error" sx={{ mb: 2, textAlign: "left", borderRadius: 2 }}>
                        {permError}
                    </Alert>
                )}

                <Stack spacing={2}>
                    {isOfficer ? (
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<VideoCallIcon />}
                            onClick={startGroupCall}
                            disabled={starting}
                            sx={{
                                py: 1.6,
                                fontWeight: 800,
                                borderRadius: 3,
                                fontSize: "1rem",
                                background: "linear-gradient(135deg, #1565c0 0%, #0288d1 100%)",
                                boxShadow: "0 4px 20px rgba(21,101,192,0.5)",
                            }}
                        >
                            {starting ? "Starting…" : "Start Club Meeting"}
                        </Button>
                    ) : (
                        <Alert
                            severity="info"
                            sx={{
                                textAlign: "left",
                                borderRadius: 2,
                                bgcolor: "rgba(33,150,243,0.15)",
                                color: "white",
                                border: "1px solid rgba(33,150,243,0.3)",
                                "& .MuiAlert-icon": { color: "#90caf9" },
                            }}
                        >
                            Club meetings are started by the President, Secretary, or Planner.
                            You'll see a notification when one begins.
                        </Alert>
                    )}

                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<GroupAddIcon />}
                        onClick={() => setMembersOpen(true)}
                        disabled={starting}
                        sx={{
                            py: 1.5,
                            fontWeight: 800,
                            borderRadius: 3,
                            color: "white",
                            borderColor: "rgba(255,255,255,0.35)",
                            "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
                        }}
                    >
                        Call a Member
                    </Button>

                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={onBack}
                        sx={{
                            color: "rgba(255,255,255,0.6)",
                            fontWeight: 700,
                            "&:hover": { color: "white" },
                        }}
                    >
                        Back to Dashboard
                    </Button>
                </Stack>
            </Paper>

            {/* ── Member picker dialog ────────────────────────────────────── */}
            <Dialog
                open={membersOpen}
                onClose={() => setMembersOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Call a Member</DialogTitle>
                <DialogContent>
                    {members.length === 0 ? (
                        <Typography
                            color="text.secondary"
                            sx={{ py: 3, textAlign: "center" }}
                        >
                            No other members available
                        </Typography>
                    ) : (
                        <List disablePadding>
                            {members.map((m) => (
                                <ListItemButton
                                    key={m.id}
                                    onClick={() => startDirectCall(m)}
                                    sx={{
                                        borderRadius: 2,
                                        mb: 0.5,
                                        "&:hover": { bgcolor: "action.hover" },
                                    }}
                                >
                                    <ListItemIcon>
                                        <Avatar sx={{ bgcolor: "primary.main" }}>
                                            {m.full_name.charAt(0)}
                                        </Avatar>
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Typography sx={{ fontWeight: 700 }}>
                                                {m.full_name}
                                            </Typography>
                                        }
                                        secondary={m.role}
                                    />
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        sx={{ borderRadius: 2, fontWeight: 800, ml: 1 }}
                                    >
                                        Call
                                    </Button>
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

// ── Small control button helper ───────────────────────────────────────────────
const ControlBtn: React.FC<{
    active: boolean;
    activeColor?: string;
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, activeColor = "error.main", label, onClick, children }) => (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
        <IconButton
            onClick={onClick}
            sx={{
                width: 56,
                height: 56,
                bgcolor: active ? activeColor : "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                color: "white",
                "&:hover": {
                    bgcolor: active ? activeColor : "rgba(255,255,255,0.28)",
                    transform: "scale(1.06)",
                },
                transition: "all 0.18s ease",
            }}
        >
            {children}
        </IconButton>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.62rem" }}>
            {label}
        </Typography>
    </Box>
);