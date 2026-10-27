// chatup/frontend/src/pages/Calling.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
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
    Tooltip,
    Drawer,
    Divider,
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
import PanToolIcon from "@mui/icons-material/PanTool";
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";
import PeopleIcon from "@mui/icons-material/People";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { useAuth } from "../context/AuthContext";
import { stopRingtone } from "../utils/sound";
import apiClient from "../api/client";
import { SECURE_WS_URL } from "../config";

interface Member {
    id: string;
    full_name: string;
    role: string;
}

interface PeerInfo {
    peerId: string;
    peerName: string;
    peerRole: string;
}

interface FloatingEmoji {
    id: number;
    emoji: string;
    left: number;
}

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
    ],
    iceCandidatePoolSize: 10,
};

const OFFICER_ROLES = [
    "SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT",
    "SECRETARY", "VICE_SECRETARY", "PLANNER", "VICE_PLANNER",
];

export const Calling: React.FC<{
    onBack: () => void;
    initialRoomId?: string;
}> = ({ onBack, initialRoomId }) => {
    const { user } = useAuth();
    const isOfficer = OFFICER_ROLES.includes(user?.role ?? "");

    // UI state
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

    // Zoom-style Host Drawer & Peers
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);

    // Interactive Features
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState<{ [peerId: string]: string }>({});
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const iceBufRef = useRef<RTCIceCandidateInit[]>([]);
    const makingOfferRef = useRef(false);
    const remoteDescSetRef = useRef(false);

    // Ensure local video element always receives and plays the stream on Mobile & Desktop
    const attachLocalStream = useCallback((videoEl: HTMLVideoElement | null) => {
        localVideoRef.current = videoEl;
        if (videoEl && localStreamRef.current) {
            videoEl.srcObject = localStreamRef.current;
            videoEl.muted = true;
            videoEl.setAttribute("playsinline", "true");
            videoEl.setAttribute("webkit-playsinline", "true");
            videoEl.play().catch((err) => console.warn("Local play error:", err));
        }
    }, []);

    useEffect(() => {
        if (view === "call" && localVideoRef.current && localStreamRef.current) {
            attachLocalStream(localVideoRef.current);
        }
    }, [view, attachLocalStream]);

    useEffect(() => {
        apiClient
            .get("/members")
            .then((res) => {
                const data = Array.isArray(res.data) ? res.data : [];
                setMembers(data.filter((m: Member) => m.id !== user?.user_id));
            })
            .catch(() => { });
    }, [user?.user_id]);

    const doHangUp = useCallback((navigate: boolean) => {
        stopRingtone();

        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        pcRef.current?.close();
        pcRef.current = null;

        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN) {
                try { wsRef.current.send(JSON.stringify({ type: "hangup" })); } catch { }
            }
            wsRef.current.close();
            wsRef.current = null;
        }

        iceBufRef.current = [];
        remoteDescSetRef.current = false;
        setRemoteConnected(false);
        setView("lobby");

        if (navigate) onBack();
    }, [onBack]);

    useEffect(() => {
        return () => {
            doHangUp(false);
        };
    }, [doHangUp]);

    useEffect(() => {
        if (initialRoomId) {
            const t = setTimeout(() => {
                void initCall(initialRoomId, false);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [initialRoomId]);

    async function initCall(roomId: string, isInitiator: boolean) {
        stopRingtone();
        setPermError("");
        setStatusText("Accessing camera & microphone…");
        setRemoteConnected(false);
        remoteDescSetRef.current = false;
        iceBufRef.current = [];
        makingOfferRef.current = false;

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
        } catch {
            try {
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

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (evt) => {
            const remoteStream = evt.streams?.[0];
            if (!remoteStream) return;
            requestAnimationFrame(() => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    remoteVideoRef.current.play().catch(() => { });
                    setRemoteConnected(true);
                    setStatusText("Connected");
                }
            });
        };

        pc.onicecandidate = (evt) => {
            if (evt.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({ type: "candidate", candidate: evt.candidate.toJSON() })
                );
            }
        };

        const token = localStorage.getItem("chatup_token") ?? "";
        const ws = new WebSocket(
            `${SECURE_WS_URL}/api/v1/calling/ws/${roomId}?token=${encodeURIComponent(token)}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
            setStatusText(isInitiator ? "Waiting for member to answer…" : "Joining call…");
        };

        ws.onmessage = async (evt) => {
            let msg: Record<string, unknown>;
            try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; }
            catch { return; }

            const type = msg.type as string;

            if (type === "peer-joined") {
                const pId = msg.peer_id as string;
                const pName = (msg.peer_name as string) || "Member";
                const pRole = (msg.peer_role as string) || "MEMBER";

                setRemoteName(pName);
                setStatusText("Member joined – connecting video…");
                setConnectedPeers((prev) => [...prev.filter(p => p.peerId !== pId), { peerId: pId, peerName: pName, peerRole: pRole }]);

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
            } else if (type === "offer") {
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
            } else if (type === "answer") {
                try {
                    await pc.setRemoteDescription(
                        new RTCSessionDescription(msg.answer as RTCSessionDescriptionInit)
                    );
                    remoteDescSetRef.current = true;
                    await drainIceBuf(pc);
                } catch (err) {
                    console.error("Answer error:", err);
                }
            } else if (type === "candidate" && msg.candidate) {
                const cand = msg.candidate as RTCIceCandidateInit;
                if (remoteDescSetRef.current) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); }
                    catch { }
                } else {
                    iceBufRef.current.push(cand);
                }
            } else if (type === "raise-hand") {
                const peerId = msg.peer_id as string;
                const peerName = msg.peer_name as string;
                const raised = msg.raised as boolean;
                setRaisedHands((prev) => {
                    const next = { ...prev };
                    if (raised) next[peerId] = peerName;
                    else delete next[peerId];
                    return next;
                });
            } else if (type === "emoji-reaction") {
                triggerFloatingEmoji(msg.emoji as string);
            } else if (type === "force-mute") {
                const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
                audioTracks.forEach((t) => { t.enabled = false; });
                setAudioMuted(true);
                alert("The host has muted your microphone.");
            } else if (type === "force-kick") {
                alert("You have been removed from the meeting by the host.");
                doHangUp(true);
            } else if (type === "peer-left" || type === "hangup") {
                const pId = msg.peer_id as string;
                setConnectedPeers((prev) => prev.filter(p => p.peerId !== pId));
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
            catch { }
        }
    }

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

    function toggleHandRaise() {
        const nextState = !isHandRaised;
        setIsHandRaised(nextState);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "raise-hand",
                    peer_id: user?.user_id,
                    peer_name: user?.full_name,
                    raised: nextState,
                })
            );
        }
    }

    function sendEmojiReaction(emoji: string) {
        triggerFloatingEmoji(emoji);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "emoji-reaction", emoji }));
        }
    }

    function triggerFloatingEmoji(emoji: string) {
        const id = Date.now() + Math.random();
        const left = Math.floor(Math.random() * 70) + 15;
        setFloatingEmojis((prev) => [...prev, { id, emoji, left }]);
        setTimeout(() => {
            setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
        }, 3500);
    }

    function hostMutePeer(targetPeerId: string) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "host-mute-peer", target_peer_id: targetPeerId }));
        }
    }

    function hostKickPeer(targetPeerId: string) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "host-kick-peer", target_peer_id: targetPeerId }));
        }
    }

    async function toggleScreen() {
        if (!pcRef.current || !localStreamRef.current) return;
        if (isScreenSharing) {
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
            } catch { }
        }
    }

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

    if (view === "connecting") {
        return (
            <Box sx={{ position: "fixed", inset: 0, bgcolor: "#0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, gap: 3 }}>
                <CircularProgress size={64} sx={{ color: "primary.main" }} />
                <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>Connecting…</Typography>
            </Box>
        );
    }

    if (view === "call") {
        return (
            <Box sx={{ position: "fixed", inset: 0, bgcolor: "#0d0d0d", zIndex: 9999, overflow: "hidden" }}>
                {/* Remote Participant Video */}
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

                {/* Raised Hands Overlay Notification */}
                {raisedHands && Object.keys(raisedHands).length > 0 && (
                    <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 30, display: "flex", flexDirection: "column", gap: 1 }}>
                        {Object.entries(raisedHands).map(([id, name]) => (
                            <Chip
                                key={id}
                                icon={<PanToolIcon sx={{ color: "#FFC107 !important" }} />}
                                label={`${name} has raised their hand! ✋`}
                                sx={{ bgcolor: "rgba(0,0,0,0.75)", color: "white", fontWeight: 800, border: "1px solid #FFC107" }}
                            />
                        ))}
                    </Box>
                )}

                {/* Floating Emoji Animations */}
                {floatingEmojis.map((item) => (
                    <Box
                        key={item.id}
                        sx={{
                            position: "absolute",
                            bottom: 120,
                            left: `${item.left}%`,
                            fontSize: "2.5rem",
                            zIndex: 40,
                            animation: "floatUp 3s ease-out forwards",
                            "@keyframes floatUp": {
                                "0%": { transform: "translateY(0px) scale(0.6)", opacity: 1 },
                                "100%": { transform: "translateY(-350px) scale(1.4)", opacity: 0 },
                            },
                        }}
                    >
                        {item.emoji}
                    </Box>
                ))}

                {!remoteConnected && (
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2.5, zIndex: 5 }}>
                        <Avatar sx={{ width: 110, height: 110, bgcolor: "primary.main", fontSize: "2.8rem" }}>
                            {remoteName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="h5" sx={{ color: "white", fontWeight: 800 }}>{remoteName}</Typography>
                        <Chip label={statusText} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 700 }} />
                    </Box>
                )}

                {/* Local PiP with Guaranteed Stream Attachment */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 110,
                        right: 14,
                        width: { xs: 96, sm: 120 },
                        height: { xs: 144, sm: 180 },
                        borderRadius: "16px",
                        overflow: "hidden",
                        border: "2.5px solid rgba(255,255,255,0.4)",
                        bgcolor: "#1a1a1a",
                        zIndex: 25,
                        boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                    }}
                >
                    <video
                        ref={attachLocalStream}
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
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#222" }}>
                            <VideocamOffIcon sx={{ color: "rgba(255,255,255,0.5)", fontSize: 32 }} />
                        </Box>
                    )}
                </Box>

                {/* Top Bar with Participants Drawer Button */}
                <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 30 }}>
                    <Button
                        variant="contained"
                        startIcon={<PeopleIcon />}
                        onClick={() => setDrawerOpen(true)}
                        sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "white", fontWeight: 800, backdropFilter: "blur(6px)", "&:hover": { bgcolor: "rgba(0,0,0,0.8)" } }}
                    >
                        Participants ({connectedPeers.length + 1})
                    </Button>
                </Box>

                {/* Control Bar */}
                <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, pb: 3, pt: 1.5, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}>
                    <Stack direction="row" spacing={2} sx={{ justifyContent: "center", alignItems: "flex-end", flexWrap: "wrap" }}>
                        <ControlBtn active={audioMuted} label={audioMuted ? "Unmute" : "Mute"} onClick={toggleAudio}>
                            {audioMuted ? <MicOffIcon /> : <MicIcon />}
                        </ControlBtn>

                        <ControlBtn active={videoMuted} label={videoMuted ? "Cam On" : "Cam Off"} onClick={toggleVideo}>
                            {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
                        </ControlBtn>

                        <ControlBtn active={isHandRaised} activeColor="warning.main" label={isHandRaised ? "Lower Hand" : "Raise Hand"} onClick={toggleHandRaise}>
                            {isHandRaised ? <PanToolIcon /> : <PanToolOutlinedIcon />}
                        </ControlBtn>

                        <Tooltip title="Send Emoji Reaction">
                            <Stack direction="row" spacing={0.5} sx={{ bgcolor: "rgba(255,255,255,0.15)", p: 0.8, borderRadius: 6, backdropFilter: "blur(6px)" }}>
                                {["👍", "❤️", "👏", "😂"].map((emoji) => (
                                    <IconButton key={emoji} onClick={() => sendEmojiReaction(emoji)} sx={{ fontSize: "1.2rem", p: 1 }}>
                                        {emoji}
                                    </IconButton>
                                ))}
                            </Stack>
                        </Tooltip>

                        <IconButton onClick={() => doHangUp(true)} sx={{ width: 60, height: 60, bgcolor: "#f44336", color: "white", "&:hover": { bgcolor: "#c62828" } }}>
                            <CallEndIcon sx={{ fontSize: 28 }} />
                        </IconButton>

                        {isOfficer && (
                            <ControlBtn active={isScreenSharing} activeColor="info.main" label={isScreenSharing ? "Stop" : "Share"} onClick={toggleScreen}>
                                {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </ControlBtn>
                        )}
                    </Stack>
                </Box>

                {/* Zoom-Style Participants Drawer */}
                <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                    <Box sx={{ width: 320, p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>
                            👥 Meeting Participants ({connectedPeers.length + 1})
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <List sx={{ flex: 1, overflowY: "auto" }}>
                            <ListItemButton sx={{ borderRadius: 2, mb: 1, bgcolor: "action.selected" }}>
                                <ListItemIcon><Avatar sx={{ bgcolor: "primary.main" }}>{user?.full_name?.charAt(0)}</Avatar></ListItemIcon>
                                <ListItemText primary={<Typography sx={{ fontWeight: 800 }}>{user?.full_name} (You)</Typography>} secondary={user?.role} />
                            </ListItemButton>

                            {connectedPeers.map((peer) => (
                                <ListItemButton key={peer.peerId} sx={{ borderRadius: 2, mb: 1 }}>
                                    <ListItemIcon><Avatar sx={{ bgcolor: "secondary.main" }}>{peer.peerName.charAt(0)}</Avatar></ListItemIcon>
                                    <ListItemText primary={<Typography sx={{ fontWeight: 800 }}>{peer.peerName}</Typography>} secondary={peer.peerRole} />
                                    {isOfficer && (
                                        <Stack direction="row" spacing={0.5}>
                                            <Tooltip title="Mute Participant">
                                                <IconButton size="small" color="warning" onClick={() => hostMutePeer(peer.peerId)}>
                                                    <VolumeOffIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Remove from Meeting">
                                                <IconButton size="small" color="error" onClick={() => hostKickPeer(peer.peerId)}>
                                                    <PersonRemoveIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    )}
                                </ListItemButton>
                            ))}
                        </List>

                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "text.secondary" }}>
                            Not Joined Yet (Absent):
                        </Typography>
                        <List dense sx={{ maxHeight: 180, overflowY: "auto" }}>
                            {members
                                .filter((m) => !connectedPeers.some((p) => p.peerName === m.full_name) && m.id !== user?.user_id)
                                .map((m) => (
                                    <ListItemButton key={m.id} onClick={() => startDirectCall(m)}>
                                        <ListItemText primary={m.full_name} secondary={m.role} />
                                        <Button size="small" variant="outlined" sx={{ fontWeight: 800 }}>Ring</Button>
                                    </ListItemButton>
                                ))}
                        </List>
                    </Box>
                </Drawer>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2, background: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" }}>
            <Paper elevation={8} sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 420, borderRadius: 4, textAlign: "center", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <VideoCallIcon sx={{ fontSize: 72, color: "primary.light", mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 900, color: "white", mb: 0.5 }}>Video & Audio Calls</Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 4 }}>Real-time video, audio & screen sharing</Typography>

                {permError && (
                    <Alert severity="error" sx={{ mb: 2, textAlign: "left", borderRadius: 2 }}>{permError}</Alert>
                )}

                <Stack spacing={2}>
                    {isOfficer ? (
                        <Button variant="contained" size="large" startIcon={<VideoCallIcon />} onClick={startGroupCall} disabled={starting} sx={{ py: 1.6, fontWeight: 800, borderRadius: 3, background: "linear-gradient(135deg, #1565c0 0%, #0288d1 100%)" }}>
                            {starting ? "Starting…" : "Start Club Meeting"}
                        </Button>
                    ) : (
                        <Alert severity="info" sx={{ textAlign: "left", borderRadius: 2, bgcolor: "rgba(33,150,243,0.15)", color: "white", border: "1px solid rgba(33,150,243,0.3)" }}>
                            Club meetings are started by the President, Secretary, or Planner. You'll see a notification when one begins.
                        </Alert>
                    )}

                    <Button variant="outlined" size="large" startIcon={<GroupAddIcon />} onClick={() => setMembersOpen(true)} disabled={starting} sx={{ py: 1.5, fontWeight: 800, borderRadius: 3, color: "white", borderColor: "rgba(255,255,255,0.35)" }}>
                        Call a Member
                    </Button>

                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                        Back to Dashboard
                    </Button>
                </Stack>
            </Paper>

            <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Call a Member</DialogTitle>
                <DialogContent>
                    {members.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>No other members available</Typography>
                    ) : (
                        <List disablePadding>
                            {members.map((m) => (
                                <ListItemButton key={m.id} onClick={() => startDirectCall(m)} sx={{ borderRadius: 2, mb: 0.5 }}>
                                    <ListItemIcon><Avatar sx={{ bgcolor: "primary.main" }}>{m.full_name.charAt(0)}</Avatar></ListItemIcon>
                                    <ListItemText primary={<Typography sx={{ fontWeight: 700 }}>{m.full_name}</Typography>} secondary={m.role} />
                                    <Button size="small" variant="contained" color="success" sx={{ borderRadius: 2, fontWeight: 800, ml: 1 }}>Call</Button>
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

const ControlBtn: React.FC<{
    active: boolean;
    activeColor?: string;
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, activeColor = "error.main", label, onClick, children }) => (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
        <IconButton onClick={onClick} sx={{ width: 56, height: 56, bgcolor: active ? activeColor : "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "white", "&:hover": { bgcolor: active ? activeColor : "rgba(255,255,255,0.28)", transform: "scale(1.06)" }, transition: "all 0.18s ease" }}>
            {children}
        </IconButton>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.62rem" }}>{label}</Typography>
    </Box>
);