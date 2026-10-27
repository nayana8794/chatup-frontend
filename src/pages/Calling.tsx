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
    Drawer,
    Divider,
    Tooltip,
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
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
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

const SelfVideoPip: React.FC<{
    stream: MediaStream | null;
    muted: boolean;
}> = ({ stream, muted }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;

        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");

        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                if (err.name !== "AbortError") {
                    console.warn("Self video play error:", err);
                }
            });
        }
    }, [stream]);

    return (
        <Box
            sx={{
                position: "absolute",
                top: { xs: 72, sm: 80 },
                right: { xs: 16, sm: 24 },
                width: { xs: 96, sm: 130 },
                height: { xs: 144, sm: 195 },
                borderRadius: "18px",
                overflow: "hidden",
                border: "2.5px solid #F2A900",
                bgcolor: "#111",
                zIndex: 35,
                boxShadow: "0 10px 30px rgba(0,0,0,0.65)",
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    display: muted ? "none" : "block",
                    backgroundColor: "#111",
                }}
            />
            {muted && (
                <Box
                    sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "#222",
                        gap: 1,
                    }}
                >
                    <VideocamOffIcon sx={{ color: "rgba(255,255,255,0.6)", fontSize: 32 }} />
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.65rem", fontWeight: 700 }}>
                        Cam Off
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

const RemoteVideoView: React.FC<{
    stream: MediaStream | null;
    connected: boolean;
}> = ({ stream, connected }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;

        if (video.srcObject !== stream) {
            video.srcObject = stream;
        }
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.play().catch(() => { });
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: connected ? 1 : 0,
                transition: "opacity 0.4s ease",
                backgroundColor: "#111",
            }}
        />
    );
};

export const Calling: React.FC<{
    onBack: () => void;
    initialRoomId?: string;
}> = ({ onBack, initialRoomId }) => {
    const { user } = useAuth();
    const { lastEvent } = useRealtime();
    const isOfficer = OFFICER_ROLES.includes(user?.role ?? "");

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

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const [activeCallInfo, setActiveCallInfo] = useState<{
        active: boolean;
        room_id: string | null;
        participant_count: number;
    }>({ active: false, room_id: null, participant_count: 0 });

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);

    const [isHandRaised, setIsHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState<{ [peerId: string]: string }>({});
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const currentRoomIdRef = useRef<string | null>(initialRoomId ?? null);
    const iceBufRef = useRef<RTCIceCandidateInit[]>([]);
    const makingOfferRef = useRef(false);
    const remoteDescSetRef = useRef(false);
    const onBackRef = useRef(onBack);

    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    const fetchActiveCallStatus = useCallback(async () => {
        try {
            const res = await apiClient.get("/calling/active");
            setActiveCallInfo(res.data);
        } catch { }
    }, []);

    useEffect(() => {
        fetchActiveCallStatus();
        apiClient
            .get("/members")
            .then((res) => {
                const data = Array.isArray(res.data) ? res.data : [];
                setMembers(data.filter((m: Member) => m.id !== user?.user_id));
            })
            .catch(() => { });
    }, [user?.user_id, fetchActiveCallStatus]);

    useEffect(() => {
        if (
            lastEvent?.type === "INCOMING_CALL" ||
            lastEvent?.type === "CALL_ENDED" ||
            lastEvent?.type === "CALL_DECLINED"
        ) {
            fetchActiveCallStatus();
        }
    }, [lastEvent, fetchActiveCallStatus]);

    const cleanUpLocalMediaOnly = useCallback(() => {
        stopRingtone();

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);
        setRemoteStream(null);

        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        if (wsRef.current) {
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws.readyState === WebSocket.OPEN) {
                try { ws.send(JSON.stringify({ type: "hangup" })); } catch { }
                ws.close();
            }
        }

        iceBufRef.current = [];
        remoteDescSetRef.current = false;
        setRemoteConnected(false);
        setConnectedPeers([]);
    }, []);

    useEffect(() => {
        return () => {
            cleanUpLocalMediaOnly();
        };
    }, [cleanUpLocalMediaOnly]);

    // When President (Host) clicks End Call -> Terminates for the whole club
    const handleExplicitHangUp = (terminateMeetingForClub = false) => {
        const activeRoom = currentRoomIdRef.current;

        if (terminateMeetingForClub && activeRoom) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                try {
                    wsRef.current.send(JSON.stringify({ type: "host-end-meeting" }));
                } catch { }
            }
            apiClient.post("/calling/end", { room_id: activeRoom }).catch(() => { });
        }

        cleanUpLocalMediaOnly();
        setView("lobby");
        fetchActiveCallStatus();
        onBackRef.current();
    };

    useEffect(() => {
        if (initialRoomId) {
            const t = setTimeout(() => {
                void initCall(initialRoomId, false);
            }, 250);
            return () => clearTimeout(t);
        }
    }, [initialRoomId]);

    async function initCall(roomId: string, isInitiator: boolean) {
        stopRingtone();
        currentRoomIdRef.current = roomId;
        setPermError("");
        setStatusText("Accessing camera & microphone…");
        setRemoteConnected(false);
        setConnectedPeers([]);
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
        setLocalStream(stream);
        setView("call");

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.ontrack = (evt) => {
            const remote = evt.streams?.[0];
            if (!remote) return;
            setRemoteStream(remote);
            setRemoteConnected(true);
            setStatusText("Connected");
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

            // Host has ended meeting for everyone -> Kick back to dashboard cleanly
            if (type === "meeting-ended-by-host") {
                alert(String(msg.message || "The President / Host has ended the meeting."));
                cleanUpLocalMediaOnly();
                setView("lobby");
                fetchActiveCallStatus();
                onBackRef.current();
                return;
            }

            if (type === "existing-peer") {
                const pId = msg.peer_id as string;
                const pName = (msg.peer_name as string) || "Member";
                const pRole = (msg.peer_role as string) || "MEMBER";
                setRemoteName(pName);
                setConnectedPeers((prev) => [
                    ...prev.filter((p) => p.peerId !== pId),
                    { peerId: pId, peerName: pName, peerRole: pRole },
                ]);
            } else if (type === "peer-joined") {
                const pId = msg.peer_id as string;
                const pName = (msg.peer_name as string) || "Member";
                const pRole = (msg.peer_role as string) || "MEMBER";

                setRemoteName(pName);
                setStatusText("Member joined – connecting video…");
                setConnectedPeers((prev) => [
                    ...prev.filter((p) => p.peerId !== pId),
                    { peerId: pId, peerName: pName, peerRole: pRole },
                ]);

                if (!makingOfferRef.current) {
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
                handleExplicitHangUp(false);
            } else if (type === "peer-left" || type === "hangup") {
                const pId = msg.peer_id as string;
                setConnectedPeers((prev) => prev.filter((p) => p.peerId !== pId));
                setRemoteConnected(false);
                setStatusText("Member left the call");
                setRemoteStream(null);
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
        if (wsRef.current?.readyState === WebSocket.OPEN && isOfficer) {
            wsRef.current.send(JSON.stringify({ type: "host-mute-peer", target_peer_id: targetPeerId }));
        }
    }

    function hostKickPeer(targetPeerId: string) {
        if (wsRef.current?.readyState === WebSocket.OPEN && isOfficer) {
            wsRef.current.send(JSON.stringify({ type: "host-kick-peer", target_peer_id: targetPeerId }));
        }
    }

    async function toggleScreen() {
        if (!pcRef.current || !localStreamRef.current) return;
        if (isScreenSharing) {
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
            if (sender && camTrack) await sender.replaceTrack(camTrack);
            setLocalStream(localStreamRef.current);
            setIsScreenSharing(false);
        } else {
            try {
                const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const scrTrack = scrStream.getVideoTracks()[0];
                const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
                if (sender) await sender.replaceTrack(scrTrack);
                setLocalStream(scrStream);
                scrTrack.onended = () => void toggleScreen();
                setIsScreenSharing(true);
            } catch { }
        }
    }

    async function startGroupCall() {
        setStarting(true);
        const roomId = `club-meeting-${String(user?.tenant_id ?? "general").toLowerCase()}`;
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

    async function joinExistingGroupCall() {
        const roomId =
            activeCallInfo.room_id ||
            `club-meeting-${String(user?.tenant_id ?? "general").toLowerCase()}`;
        await initCall(roomId, false);
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
                {/* Full-Screen Remote Video */}
                <RemoteVideoView stream={remoteStream} connected={remoteConnected} />

                {/* Top Left: Raised Hands Indicator */}
                {raisedHands && Object.keys(raisedHands).length > 0 && (
                    <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 30, display: "flex", flexDirection: "column", gap: 1, maxWidth: "55%" }}>
                        {Object.entries(raisedHands).map(([id, name]) => (
                            <Chip
                                key={id}
                                icon={<PanToolIcon sx={{ color: "#FFC107 !important" }} />}
                                label={`${name} raised hand ✋`}
                                sx={{ bgcolor: "rgba(0,0,0,0.75)", color: "white", fontWeight: 800, border: "1px solid #FFC107" }}
                            />
                        ))}
                    </Box>
                )}

                {/* Top Right: Participants Drawer Button */}
                <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 30 }}>
                    <Button
                        variant="contained"
                        startIcon={<PeopleIcon />}
                        onClick={() => setDrawerOpen(true)}
                        sx={{
                            bgcolor: "rgba(0,0,0,0.65)",
                            color: "white",
                            fontWeight: 800,
                            borderRadius: 3,
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
                        }}
                    >
                        Participants ({connectedPeers.length + 1})
                    </Button>
                </Box>

                {/* Top Right: Guaranteed Working Self Video Window */}
                <SelfVideoPip stream={localStream} muted={videoMuted} />

                {/* Floating Emoji Animations */}
                {floatingEmojis.map((item) => (
                    <Box
                        key={item.id}
                        sx={{
                            position: "absolute",
                            bottom: 160,
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
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2.5, zIndex: 5, px: 2, textAlign: "center" }}>
                        <Avatar sx={{ width: 110, height: 110, bgcolor: "primary.main", fontSize: "2.8rem" }}>
                            {remoteName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="h5" sx={{ color: "white", fontWeight: 800 }}>{remoteName}</Typography>
                        <Chip label={statusText} sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", fontWeight: 700 }} />
                    </Box>
                )}

                {/* Bottom Control Bar */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        pb: "max(20px, env(safe-area-inset-bottom, 16px))",
                        pt: 2,
                        px: 1.5,
                        background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 70%, transparent 100%)",
                    }}
                >
                    <Stack spacing={1.8} sx={{ alignItems: "center" }}>
                        {/* Row 1: Emoji Reaction Bar */}
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                                bgcolor: "rgba(255,255,255,0.14)",
                                px: 2,
                                py: 0.4,
                                borderRadius: 6,
                                backdropFilter: "blur(8px)",
                                border: "1px solid rgba(255,255,255,0.15)",
                            }}
                        >
                            {["👍", "❤️", "👏", "😂"].map((emoji) => (
                                <IconButton
                                    key={emoji}
                                    onClick={() => sendEmojiReaction(emoji)}
                                    sx={{
                                        fontSize: "1.35rem",
                                        p: 0.8,
                                        transition: "transform 0.15s",
                                        "&:hover": { transform: "scale(1.25)" },
                                    }}
                                >
                                    {emoji}
                                </IconButton>
                            ))}
                        </Stack>

                        {/* Row 2: Controls */}
                        <Stack direction="row" spacing={{ xs: 1.8, sm: 2.5 }} sx={{ justifyContent: "center", alignItems: "center" }}>
                            <ControlBtn active={audioMuted} label={audioMuted ? "Unmute" : "Mute"} onClick={toggleAudio}>
                                {audioMuted ? <MicOffIcon /> : <MicIcon />}
                            </ControlBtn>

                            <ControlBtn active={videoMuted} label={videoMuted ? "Cam On" : "Cam Off"} onClick={toggleVideo}>
                                {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
                            </ControlBtn>

                            <ControlBtn active={isHandRaised} activeColor="warning.main" label={isHandRaised ? "Lower Hand" : "Raise Hand"} onClick={toggleHandRaise}>
                                {isHandRaised ? <PanToolIcon /> : <PanToolOutlinedIcon />}
                            </ControlBtn>

                            {isOfficer && (
                                <ControlBtn active={isScreenSharing} activeColor="info.main" label={isScreenSharing ? "Stop" : "Share"} onClick={toggleScreen}>
                                    {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                </ControlBtn>
                            )}

                            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                                <IconButton
                                    onClick={() => handleExplicitHangUp(isOfficer)}
                                    sx={{
                                        width: 58,
                                        height: 58,
                                        bgcolor: "#f44336",
                                        color: "white",
                                        boxShadow: "0 4px 14px rgba(244, 67, 54, 0.5)",
                                        "&:hover": { bgcolor: "#c62828" },
                                    }}
                                >
                                    <CallEndIcon sx={{ fontSize: 28 }} />
                                </IconButton>
                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.65rem", fontWeight: 700 }}>
                                    {isOfficer ? "End Meeting" : "Leave"}
                                </Typography>
                            </Box>
                        </Stack>
                    </Stack>
                </Box>

                {/* Zoom-Style Participants Drawer */}
                <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ zIndex: 10001 }}>
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

                        {/* Only show absent member ringing list if user is Officer */}
                        {isOfficer && (
                            <>
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
                            </>
                        )}
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
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 4 }}>Real-time club virtual conference</Typography>

                {permError && (
                    <Alert severity="error" sx={{ mb: 2, textAlign: "left", borderRadius: 2 }}>{permError}</Alert>
                )}

                <Stack spacing={2}>
                    {/* Active Meeting Banner & Rejoin Button for ALL Members */}
                    {activeCallInfo.active && (
                        <Button
                            variant="contained"
                            color="success"
                            size="large"
                            startIcon={<MeetingRoomIcon />}
                            onClick={joinExistingGroupCall}
                            sx={{
                                py: 1.8,
                                fontWeight: 900,
                                borderRadius: 3,
                                bgcolor: "#2e7d32",
                                boxShadow: "0 4px 20px rgba(46, 125, 50, 0.5)",
                                "&:hover": { bgcolor: "#1b5e20" },
                            }}
                        >
                            Join Active Club Meeting ({activeCallInfo.participant_count} Online)
                        </Button>
                    )}

                    {/* ONLY President and Club Officers can host / initiate meetings */}
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
                                background: "linear-gradient(135deg, #1565c0 0%, #0288d1 100%)",
                            }}
                        >
                            {starting ? "Starting…" : activeCallInfo.active ? "Ring All Members Again" : "Start Club Meeting"}
                        </Button>
                    ) : (
                        !activeCallInfo.active && (
                            <Alert
                                severity="info"
                                sx={{
                                    textAlign: "left",
                                    borderRadius: 2,
                                    bgcolor: "rgba(33,150,243,0.15)",
                                    color: "white",
                                    border: "1px solid rgba(33,150,243,0.3)",
                                }}
                            >
                                No live club meeting is currently active. Club meetings are hosted by the President.
                            </Alert>
                        )
                    )}

                    {/* Direct 1-on-1 Call Button (Available for all members) */}
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
                        }}
                    >
                        Call a Member (1-on-1)
                    </Button>

                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={onBack}
                        sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}
                    >
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
        <IconButton onClick={onClick} sx={{ width: 54, height: 54, bgcolor: active ? activeColor : "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "white", "&:hover": { bgcolor: active ? activeColor : "rgba(255,255,255,0.28)", transform: "scale(1.06)" }, transition: "all 0.18s ease" }}>
            {children}
        </IconButton>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", fontSize: "0.65rem", fontWeight: 600 }}>{label}</Typography>
    </Box>
);