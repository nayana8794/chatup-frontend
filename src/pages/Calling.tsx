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
    keyframes,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import PhoneIcon from "@mui/icons-material/Phone";
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
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
    audioMuted?: boolean;
}

interface FloatingEmoji {
    id: number;
    emoji: string;
    left: number;
}

const pulseRing = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(242, 169, 0, 0.4); }
  70% { transform: scale(1.18); opacity: 0.2; box-shadow: 0 0 0 35px rgba(242, 169, 0, 0); }
  100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(242, 169, 0, 0); }
`;

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

const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return `${pad(minutes)}:${pad(seconds)}`;
};

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
    initialCallType?: "video" | "audio";
}> = ({ onBack, initialRoomId, initialCallType = "video" }) => {
    const { user } = useAuth();
    const { lastEvent } = useRealtime();
    const isOfficer = OFFICER_ROLES.includes(user?.role ?? "");

    const [view, setView] = useState<"lobby" | "connecting" | "call" | "concluded">(
        initialRoomId ? "connecting" : "lobby"
    );
    const [callType, setCallType] = useState<"video" | "audio">(initialCallType);
    const [statusText, setStatusText] = useState("Connecting…");
    const [remoteName, setRemoteName] = useState("Member");
    const [remoteConnected, setRemoteConnected] = useState(false);
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(initialCallType === "audio");
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [permError, setPermError] = useState("");
    const [starting, setStarting] = useState(false);

    // Call duration timer in seconds
    const [callDuration, setCallDuration] = useState(0);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const [activeCallInfo, setActiveCallInfo] = useState<{
        active: boolean;
        room_id: string | null;
        participant_count: number;
        call_type?: "video" | "audio";
    }>({ active: false, room_id: null, participant_count: 0, call_type: "video" });

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

    // Live Call Duration Timer: Starts when call view is active
    useEffect(() => {
        let timer: any = null;
        if (view === "call") {
            setCallDuration(0);
            timer = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [view]);

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
                void initCall(initialRoomId, false, initialCallType);
            }, 250);
            return () => clearTimeout(t);
        }
    }, [initialRoomId, initialCallType]);

    async function initCall(roomId: string, isInitiator: boolean, selectedType: "video" | "audio" = "video") {
        stopRingtone();
        currentRoomIdRef.current = roomId;
        setCallType(selectedType);
        setVideoMuted(selectedType === "audio");
        setPermError("");
        setStatusText("Accessing audio & devices…");
        setRemoteConnected(false);
        setConnectedPeers([]);
        remoteDescSetRef.current = false;
        iceBufRef.current = [];
        makingOfferRef.current = false;

        let stream: MediaStream;
        const wantVideo = selectedType === "video";

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: wantVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
        } catch {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (wantVideo) setPermError("Camera not available – running in audio-only mode");
            } catch {
                setPermError("Microphone access denied. Please check browser permissions.");
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
            setStatusText(isInitiator ? "Waiting for member to answer…" : "Joining meeting…");
        };

        ws.onmessage = async (evt) => {
            let msg: Record<string, unknown>;
            try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; }
            catch { return; }

            const type = msg.type as string;

            if (type === "meeting-ended-by-host") {
                cleanUpLocalMediaOnly();
                setView("concluded");
                fetchActiveCallStatus();
                return;
            }

            // Real-time Peer Mute Status Update
            if (type === "peer-mute-status") {
                const targetPeerId = msg.peer_id as string;
                const isAudioMuted = Boolean(msg.audio_muted);
                setConnectedPeers((prev) =>
                    prev.map((p) =>
                        p.peerId === targetPeerId ? { ...p, audioMuted: isAudioMuted } : p
                    )
                );
                return;
            }

            if (type === "existing-peer") {
                const pId = msg.peer_id as string;
                const pName = (msg.peer_name as string) || "Member";
                const pRole = (msg.peer_role as string) || "MEMBER";
                setRemoteName(pName);
                setConnectedPeers((prev) => [
                    ...prev.filter((p) => p.peerId !== pId),
                    { peerId: pId, peerName: pName, peerRole: pRole, audioMuted: false },
                ]);
            } else if (type === "peer-joined") {
                const pId = msg.peer_id as string;
                const pName = (msg.peer_name as string) || "Member";
                const pRole = (msg.peer_role as string) || "MEMBER";

                setRemoteName(pName);
                setStatusText("Member joined – connecting…");
                setConnectedPeers((prev) => [
                    ...prev.filter((p) => p.peerId !== pId),
                    { peerId: pId, peerName: pName, peerRole: pRole, audioMuted: false },
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
                setStatusText("Connecting media…");
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
                broadcastMuteState(true);
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

    function broadcastMuteState(isMuted: boolean) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "peer-mute-status",
                    peer_id: user?.user_id,
                    audio_muted: isMuted,
                })
            );
        }
    }

    function toggleAudio() {
        const tracks = localStreamRef.current?.getAudioTracks() ?? [];
        const nextMuteState = !audioMuted;
        tracks.forEach((t) => { t.enabled = !nextMuteState; });
        setAudioMuted(nextMuteState);
        broadcastMuteState(nextMuteState);
    }

    async function toggleVideo() {
        if (videoMuted) {
            // Turning Cam On
            const currentVideoTracks = localStreamRef.current?.getVideoTracks() ?? [];
            if (currentVideoTracks.length > 0) {
                currentVideoTracks.forEach((t) => { t.enabled = true; });
                setVideoMuted(false);
            } else {
                // Dynamically request camera if started as Audio-only
                try {
                    const camStream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                    });
                    const newTrack = camStream.getVideoTracks()[0];
                    if (localStreamRef.current) {
                        localStreamRef.current.addTrack(newTrack);
                        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                    }
                    if (pcRef.current) {
                        pcRef.current.addTrack(newTrack, localStreamRef.current!);
                    }
                    setVideoMuted(false);
                } catch {
                    alert("Unable to access camera.");
                }
            }
        } else {
            // Turning Cam Off
            const tracks = localStreamRef.current?.getVideoTracks() ?? [];
            tracks.forEach((t) => { t.enabled = false; });
            setVideoMuted(true);
        }
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

    async function startGroupConference(type: "video" | "audio") {
        setStarting(true);
        const roomId = `club-meeting-${String(user?.tenant_id ?? "general").toLowerCase()}`;
        try {
            await apiClient.post("/calling/initiate", { room_id: roomId, call_type: type });
            await initCall(roomId, true, type);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail ?? "Error starting meeting");
        } finally {
            setStarting(false);
        }
    }

    async function joinExistingGroupCall() {
        const roomId =
            activeCallInfo.room_id ||
            `club-meeting-${String(user?.tenant_id ?? "general").toLowerCase()}`;
        const targetType = activeCallInfo.call_type || "video";
        await initCall(roomId, false, targetType);
    }

    async function startDirectCall(target: Member, type: "video" | "audio") {
        setMembersOpen(false);
        setStarting(true);
        const ids = [user?.user_id ?? "", target.id].sort();
        const roomId = `direct-${ids[0]}-${ids[1]}`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: roomId,
                call_type: type,
                target_user_id: target.id,
            });
            await initCall(roomId, true, type);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail ?? "Error calling member");
        } finally {
            setStarting(false);
        }
    }

    // Check if remote peer is muted
    const isRemotePeerMuted = connectedPeers.some((p) => p.audioMuted);

    if (view === "connecting") {
        return (
            <Box sx={{ position: "fixed", inset: 0, bgcolor: "#0d0d0d", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, gap: 3 }}>
                <CircularProgress size={64} sx={{ color: "primary.main" }} />
                <Typography variant="h6" sx={{ color: "white", fontWeight: 700 }}>{statusText}</Typography>
            </Box>
        );
    }

    if (view === "concluded") {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2.5,
                    background: "linear-gradient(155deg, #00122e 0%, #002F6C 60%, #001A3D 100%)",
                }}
            >
                <Paper
                    elevation={12}
                    sx={{
                        p: { xs: 4, sm: 5 },
                        width: "100%",
                        maxWidth: 420,
                        borderRadius: "28px",
                        textAlign: "center",
                        bgcolor: "rgba(255,255,255,0.06)",
                        backdropFilter: "blur(24px)",
                        border: "1.5px solid rgba(242, 169, 0, 0.45)",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
                        color: "white",
                    }}
                >
                    <Box
                        sx={{
                            width: 84,
                            height: 84,
                            borderRadius: "50%",
                            bgcolor: "rgba(242, 169, 0, 0.15)",
                            border: "2px solid #F2A900",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mx: "auto",
                            mb: 2.5,
                        }}
                    >
                        <CheckCircleIcon sx={{ fontSize: 48, color: "#F2A900" }} />
                    </Box>

                    <Typography variant="h5" sx={{ fontWeight: 900, mb: 1, letterSpacing: 0.5 }}>
                        Meeting Concluded
                    </Typography>

                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.78)", mb: 3.5, lineHeight: 1.6 }}>
                        The virtual club meeting has been officially concluded by the President. Thank you for your active participation!
                    </Typography>

                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => {
                            setView("lobby");
                            onBackRef.current();
                        }}
                        sx={{
                            minHeight: 52,
                            borderRadius: 3.5,
                            fontWeight: 900,
                            fontSize: "1rem",
                            bgcolor: "#002F6C",
                            border: "1.5px solid #F2A900",
                            color: "#F2A900",
                            boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                            "&:hover": { bgcolor: "#001A3D" },
                        }}
                    >
                        Return to Dashboard
                    </Button>
                </Paper>
            </Box>
        );
    }

    if (view === "call") {
        const isAudioOnlySession = callType === "audio" && videoMuted;

        return (
            <Box sx={{ position: "fixed", inset: 0, bgcolor: "#0a1118", zIndex: 9999, overflow: "hidden" }}>
                {/* 1. Remote Video or Luxury Audio-Only Centerpiece */}
                {!isAudioOnlySession ? (
                    <RemoteVideoView stream={remoteStream} connected={remoteConnected} />
                ) : (
                    <Box
                        sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "radial-gradient(circle at center, #002F6C 0%, #00122e 70%, #060b11 100%)",
                            gap: 2.5,
                        }}
                    >
                        <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Box sx={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "2px solid rgba(242, 169, 0, 0.45)", animation: `${pulseRing} 2.5s infinite ease-out` }} />
                            <Avatar
                                sx={{
                                    width: 110,
                                    height: 110,
                                    bgcolor: "#002F6C",
                                    color: "#F2A900",
                                    fontSize: "3rem",
                                    fontWeight: 900,
                                    border: "3px solid #F2A900",
                                    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                                }}
                            >
                                {remoteName.charAt(0).toUpperCase()}
                            </Avatar>
                        </Box>
                        <Typography variant="h5" sx={{ color: "white", fontWeight: 800 }}>{remoteName}</Typography>
                        <Chip
                            icon={<PhoneInTalkIcon sx={{ color: "#F2A900 !important", fontSize: 18 }} />}
                            label="Live Audio Conference"
                            sx={{ bgcolor: "rgba(242,169,0,0.15)", color: "#F2A900", border: "1px solid rgba(242,169,0,0.35)", fontWeight: 800 }}
                        />
                    </Box>
                )}

                {/* 2. Top-Center Live Call Duration Timer */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 40,
                        bgcolor: "rgba(0, 0, 0, 0.65)",
                        backdropFilter: "blur(12px)",
                        border: "1.5px solid rgba(255, 255, 255, 0.2)",
                        px: 2,
                        py: 0.6,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 1.2,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    }}
                >
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4CAF50", boxShadow: "0 0 8px #4CAF50" }} />
                    <AccessTimeIcon sx={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }} />
                    <Typography sx={{ color: "white", fontWeight: 800, fontSize: "0.92rem", letterSpacing: 0.8, fontFamily: "monospace" }}>
                        {formatDuration(callDuration)}
                    </Typography>
                </Box>

                {/* 3. Top Left: Raised Hands & Remote Muted Indicator */}
                <Box sx={{ position: "absolute", top: 16, left: 16, zIndex: 30, display: "flex", flexDirection: "column", gap: 1, maxWidth: "45%" }}>
                    {raisedHands && Object.keys(raisedHands).length > 0 && (
                        Object.entries(raisedHands).map(([id, name]) => (
                            <Chip
                                key={id}
                                icon={<PanToolIcon sx={{ color: "#FFC107 !important" }} />}
                                label={`${name} raised hand ✋`}
                                size="small"
                                sx={{ bgcolor: "rgba(0,0,0,0.75)", color: "white", fontWeight: 800, border: "1px solid #FFC107" }}
                            />
                        ))
                    )}

                    {isRemotePeerMuted && (
                        <Chip
                            icon={<MicOffIcon sx={{ color: "#fff !important", fontSize: 16 }} />}
                            label="Member Muted"
                            size="small"
                            sx={{ bgcolor: "rgba(211, 47, 47, 0.88)", color: "white", fontWeight: 800, backdropFilter: "blur(4px)" }}
                        />
                    )}
                </Box>

                {/* 4. Top Right: Participants Drawer Button */}
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

                {/* 5. Top Right: Floating Self Video Window (Only if camera is enabled) */}
                {!isAudioOnlySession && (
                    <SelfVideoPip stream={localStream} muted={videoMuted} />
                )}

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
                        background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 70%, transparent 100%)",
                    }}
                >
                    <Stack spacing={1.8} sx={{ alignItems: "center" }}>
                        {/* Row 1: Emojis */}
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

                {/* Zoom-Style Participants Drawer with Mute Badges */}
                <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ zIndex: 10001 }}>
                    <Box sx={{ width: 320, p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>
                            👥 Meeting Participants ({connectedPeers.length + 1})
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <List sx={{ flex: 1, overflowY: "auto" }}>
                            {/* Self */}
                            <ListItemButton sx={{ borderRadius: 2, mb: 1, bgcolor: "action.selected" }}>
                                <ListItemIcon><Avatar sx={{ bgcolor: "primary.main" }}>{user?.full_name?.charAt(0)}</Avatar></ListItemIcon>
                                <ListItemText primary={<Typography sx={{ fontWeight: 800 }}>{user?.full_name} (You)</Typography>} secondary={user?.role} />
                                {audioMuted && (
                                    <Chip icon={<MicOffIcon sx={{ fontSize: 14 }} />} label="Muted" size="small" color="error" sx={{ height: 20, fontSize: "0.68rem" }} />
                                )}
                            </ListItemButton>

                            {/* Connected Peers */}
                            {connectedPeers.map((peer) => (
                                <ListItemButton key={peer.peerId} sx={{ borderRadius: 2, mb: 1 }}>
                                    <ListItemIcon><Avatar sx={{ bgcolor: "secondary.main" }}>{peer.peerName.charAt(0)}</Avatar></ListItemIcon>
                                    <ListItemText primary={<Typography sx={{ fontWeight: 800 }}>{peer.peerName}</Typography>} secondary={peer.peerRole} />
                                    {peer.audioMuted && (
                                        <Chip icon={<MicOffIcon sx={{ fontSize: 14 }} />} label="Muted" size="small" color="error" sx={{ height: 20, fontSize: "0.68rem", mr: 1 }} />
                                    )}
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
                                            <ListItemButton key={m.id} onClick={() => startDirectCall(m, "video")}>
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
            <Paper elevation={8} sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 440, borderRadius: 4, textAlign: "center", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <VideoCallIcon sx={{ fontSize: 68, color: "primary.light", mb: 1 }} />
                <Typography variant="h5" sx={{ fontWeight: 900, color: "white", mb: 0.5 }}>Club Live Conference</Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 3.5 }}>Join or start official video & audio meetings</Typography>

                {permError && (
                    <Alert severity="warning" sx={{ mb: 2, textAlign: "left", borderRadius: 2 }}>{permError}</Alert>
                )}

                <Stack spacing={2}>
                    {/* Active Meeting Rejoin Button */}
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
                        <Stack spacing={1.5}>
                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<VideoCallIcon />}
                                onClick={() => startGroupConference("video")}
                                disabled={starting}
                                sx={{
                                    py: 1.5,
                                    fontWeight: 900,
                                    borderRadius: 3,
                                    background: "linear-gradient(135deg, #002F6C 0%, #0288d1 100%)",
                                    border: "1px solid rgba(242, 169, 0, 0.4)",
                                }}
                            >
                                {starting ? "Starting…" : "Start Video Conference"}
                            </Button>

                            <Button
                                variant="contained"
                                size="large"
                                startIcon={<PhoneInTalkIcon />}
                                onClick={() => startGroupConference("audio")}
                                disabled={starting}
                                sx={{
                                    py: 1.5,
                                    fontWeight: 900,
                                    borderRadius: 3,
                                    bgcolor: "#2E7D32",
                                    "&:hover": { bgcolor: "#1B5E20" },
                                }}
                            >
                                {starting ? "Starting…" : "Start Audio-Only Meeting"}
                            </Button>
                        </Stack>
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

                    {/* 1-on-1 Call Button */}
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<GroupAddIcon />}
                        onClick={() => setMembersOpen(true)}
                        disabled={starting}
                        sx={{
                            py: 1.4,
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

            {/* Member Selection Modal with both Video & Audio Options */}
            <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Call a Member</DialogTitle>
                <DialogContent>
                    {members.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>No other members available</Typography>
                    ) : (
                        <List disablePadding>
                            {members.map((m) => (
                                <ListItemButton key={m.id} sx={{ borderRadius: 2, mb: 1, py: 1.2 }}>
                                    <ListItemIcon><Avatar sx={{ bgcolor: "primary.main" }}>{m.full_name.charAt(0)}</Avatar></ListItemIcon>
                                    <ListItemText primary={<Typography sx={{ fontWeight: 700 }}>{m.full_name}</Typography>} secondary={m.role} />
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="Audio Call">
                                            <IconButton color="success" onClick={() => startDirectCall(m, "audio")}>
                                                <PhoneIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Video Call">
                                            <IconButton color="primary" onClick={() => startDirectCall(m, "video")}>
                                                <VideoCallIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
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