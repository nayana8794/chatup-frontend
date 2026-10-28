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
    ListItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Drawer,
    Divider,
    Tooltip,
    keyframes,
    useMediaQuery,
    useTheme,
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
//import ScreenShareIcon from "@mui/icons-material/ScreenShare";
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
import PresentToAllIcon from "@mui/icons-material/PresentToAll";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
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

interface RemoteParticipant {
    peerId: string;
    peerName: string;
    peerRole: string;
    stream: MediaStream;
    audioMuted: boolean;
    videoEnabled: boolean;
    isScreenSharing?: boolean;
}

interface FloatingEmoji {
    id: number;
    emoji: string;
    left: number;
}

const pulseRing = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(242, 169, 0, 0.45); }
  70% { transform: scale(1.15); opacity: 0.2; box-shadow: 0 0 0 28px rgba(242, 169, 0, 0); }
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

const ParticipantVideoTile: React.FC<{
    peerName: string;
    peerRole: string;
    stream: MediaStream | null;
    isAudioMuted: boolean;
    isVideoEnabled: boolean;
    isLocal?: boolean;
    hasHandRaised?: boolean;
    isScreenShare?: boolean;
    callType?: "video" | "audio";
}> = ({
    peerName,
    peerRole,
    stream,
    isAudioMuted,
    isVideoEnabled,
    isLocal = false,
    hasHandRaised = false,
    isScreenShare = false,
    callType = "video",
}) => {
        const videoRef = useRef<HTMLVideoElement>(null);

        const hasLiveVideoTrack = Boolean(
            stream &&
            stream.getVideoTracks().length > 0 &&
            stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
        );

        const showVideo = isScreenShare || (callType === "video" && isVideoEnabled && hasLiveVideoTrack);

        useEffect(() => {
            const video = videoRef.current;
            if (!video || !stream || !showVideo) return;

            if (video.srcObject !== stream) {
                video.srcObject = stream;
            }
            if (isLocal && !isScreenShare) {
                video.muted = true;
                video.defaultMuted = true;
            }
            video.setAttribute("playsinline", "true");
            video.setAttribute("webkit-playsinline", "true");

            video.play().catch(() => { });
        }, [stream, isLocal, isScreenShare, showVideo]);

        return (
            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    borderRadius: "20px",
                    overflow: "hidden",
                    bgcolor: "#0c1520",
                    border: isScreenShare ? "3px solid #29B6F6" : "2px solid rgba(242, 169, 0, 0.35)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {showVideo ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted={isLocal && !isScreenShare}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: isScreenShare ? "contain" : "cover",
                            transform: isLocal && !isScreenShare ? "scaleX(-1)" : "none",
                            backgroundColor: "#0c1520",
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 1.5,
                            width: "100%",
                            height: "100%",
                            background: "radial-gradient(circle at center, #002F6C 0%, #00122e 75%, #050a10 100%)",
                            p: 2,
                            textAlign: "center",
                        }}
                    >
                        <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Box sx={{ position: "absolute", width: 88, height: 88, borderRadius: "50%", border: "2px solid rgba(242, 169, 0, 0.45)", animation: `${pulseRing} 2.5s infinite ease-out` }} />
                            <Avatar
                                sx={{
                                    width: 72,
                                    height: 72,
                                    bgcolor: "#002F6C",
                                    color: "#F2A900",
                                    fontSize: "2rem",
                                    fontWeight: 900,
                                    border: "2.5px solid #F2A900",
                                    boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                                }}
                            >
                                {peerName.charAt(0).toUpperCase()}
                            </Avatar>
                        </Box>
                        <Typography variant="body1" sx={{ color: "white", fontWeight: 800 }}>
                            {peerName}
                        </Typography>
                        <Chip
                            label={isLocal ? "Your Camera Off" : callType === "audio" ? "Audio Only" : "Camera Off"}
                            size="small"
                            sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", fontSize: "0.72rem", height: 22, fontWeight: 700 }}
                        />
                    </Box>
                )}

                {hasHandRaised && (
                    <Chip
                        icon={<PanToolIcon sx={{ color: "#FFC107 !important", fontSize: 16 }} />}
                        label="Hand Raised"
                        size="small"
                        sx={{
                            position: "absolute",
                            top: 10,
                            left: 10,
                            bgcolor: "rgba(0,0,0,0.8)",
                            color: "white",
                            fontWeight: 800,
                            border: "1px solid #FFC107",
                            fontSize: "0.72rem",
                            backdropFilter: "blur(6px)",
                        }}
                    />
                )}

                <Box
                    sx={{
                        position: "absolute",
                        bottom: 10,
                        left: 10,
                        bgcolor: "rgba(0, 0, 0, 0.75)",
                        backdropFilter: "blur(8px)",
                        px: 1.2,
                        py: 0.4,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.8,
                        border: "1px solid rgba(255,255,255,0.14)",
                    }}
                >
                    <Typography sx={{ color: "white", fontWeight: 800, fontSize: "0.78rem" }}>
                        {peerName} {isLocal ? "(You)" : ""}
                    </Typography>
                    <Chip
                        label={peerRole}
                        size="small"
                        sx={{ height: 16, fontSize: "0.6rem", fontWeight: 700, bgcolor: "rgba(242, 169, 0, 0.25)", color: "#F2A900" }}
                    />
                </Box>

                {isAudioMuted && (
                    <Box
                        sx={{
                            position: "absolute",
                            bottom: 10,
                            right: 10,
                            bgcolor: "rgba(211, 47, 47, 0.95)",
                            color: "white",
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                        }}
                    >
                        <MicOffIcon sx={{ fontSize: 16 }} />
                    </Box>
                )}
            </Box>
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
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [view, setView] = useState<"lobby" | "connecting" | "call" | "concluded">(
        initialRoomId ? "connecting" : "lobby"
    );
    const [callType, setCallType] = useState<"video" | "audio">(initialCallType);
    const [statusText, setStatusText] = useState("Connecting…");
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(initialCallType === "audio");
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [permError, setPermError] = useState("");
    const [starting, setStarting] = useState(false);
    const [ringingMemberId, setRingingMemberId] = useState<string | null>(null);

    const [callDuration, setCallDuration] = useState(0);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);

    const [activeCallInfo, setActiveCallInfo] = useState<{
        active: boolean;
        room_id: string | null;
        participant_count: number;
        call_type?: "video" | "audio";
    }>({ active: false, room_id: null, participant_count: 0, call_type: "video" });

    const [drawerOpen, setDrawerOpen] = useState(false);

    const [isHandRaised, setIsHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState<{ [peerId: string]: string }>({});
    const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);

    const cameraStreamRef = useRef<MediaStream | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);

    const peerConnectionsRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
    const iceCandidateBuffersRef = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});
    const wsRef = useRef<WebSocket | null>(null);
    const currentRoomIdRef = useRef<string | null>(initialRoomId ?? null);
    const onBackRef = useRef(onBack);

    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

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
                setMembers(data);
            })
            .catch(() => { });
    }, [fetchActiveCallStatus]);

    useEffect(() => {
        if (
            lastEvent?.type === "INCOMING_CALL" ||
            lastEvent?.type === "CALL_ENDED" ||
            lastEvent?.type === "CALL_DECLINED"
        ) {
            fetchActiveCallStatus();
        }
    }, [lastEvent, fetchActiveCallStatus]);

    const cleanUpAllConnections = useCallback(() => {
        stopRingtone();

        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }

        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach((t) => t.stop());
            cameraStreamRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);
        setIsScreenSharing(false);

        Object.values(peerConnectionsRef.current).forEach((pc) => {
            try { pc.close(); } catch { }
        });
        peerConnectionsRef.current = {};
        iceCandidateBuffersRef.current = {};
        setRemoteParticipants([]);

        if (wsRef.current) {
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws.readyState === WebSocket.OPEN) {
                try { ws.send(JSON.stringify({ type: "hangup" })); } catch { }
                ws.close();
            }
        }
    }, []);

    useEffect(() => {
        return () => {
            cleanUpAllConnections();
        };
    }, [cleanUpAllConnections]);

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

        cleanUpAllConnections();
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

    const drainIceForPeer = async (peerId: string, pc: RTCPeerConnection) => {
        const buf = iceCandidateBuffersRef.current[peerId] || [];
        delete iceCandidateBuffersRef.current[peerId];
        for (const c of buf) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch { }
        }
    };

    const getOrCreatePeerConnection = (
        targetPeerId: string,
        targetPeerName: string,
        targetPeerRole: string,
        isInitiator: boolean
    ): RTCPeerConnection => {
        if (peerConnectionsRef.current[targetPeerId]) {
            return peerConnectionsRef.current[targetPeerId];
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnectionsRef.current[targetPeerId] = pc;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pc.ontrack = (evt) => {
            const remoteStream = evt.streams?.[0];
            if (!remoteStream) return;

            setRemoteParticipants((prev) => {
                const existing = prev.find((p) => p.peerId.toLowerCase() === targetPeerId.toLowerCase());
                if (existing) {
                    return prev.map((p) => (p.peerId.toLowerCase() === targetPeerId.toLowerCase() ? { ...p, stream: remoteStream } : p));
                }
                return [
                    ...prev,
                    {
                        peerId: targetPeerId,
                        peerName: targetPeerName,
                        peerRole: targetPeerRole,
                        stream: remoteStream,
                        audioMuted: false,
                        videoEnabled: callType === "video",
                        isScreenSharing: false,
                    },
                ];
            });
        };

        pc.onicecandidate = (evt) => {
            if (evt.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({
                        type: "candidate",
                        candidate: evt.candidate.toJSON(),
                        sender_id: user?.user_id,
                        target_peer_id: targetPeerId,
                    })
                );
            }
        };

        if (isInitiator) {
            void (async () => {
                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                            JSON.stringify({
                                type: "offer",
                                offer: pc.localDescription,
                                sender_id: user?.user_id,
                                sender_name: user?.full_name,
                                sender_role: user?.role,
                                target_peer_id: targetPeerId,
                            })
                        );
                    }
                } catch (err) {
                    console.error("Offer error to peer:", targetPeerId, err);
                }
            })();
        }

        return pc;
    };

    async function initCall(roomId: string, isInitiator: boolean, selectedType: "video" | "audio" = "video") {
        stopRingtone();
        currentRoomIdRef.current = roomId;
        const isAudio = selectedType === "audio";
        setCallType(selectedType);
        setVideoMuted(isAudio);
        setPermError("");
        setStatusText("Accessing audio & devices…");
        setRemoteParticipants([]);

        let stream: MediaStream;
        const wantVideo = !isAudio;

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

        cameraStreamRef.current = stream;
        localStreamRef.current = stream;
        setLocalStream(stream);
        setView("call");

        const token = localStorage.getItem("chatup_token") ?? "";
        const ws = new WebSocket(
            `${SECURE_WS_URL}/api/v1/calling/ws/${roomId}?token=${encodeURIComponent(token)}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
            setStatusText(isInitiator ? "Waiting for members to join…" : "Connected to conference");
            ws.send(
                JSON.stringify({
                    type: "peer-media-state",
                    peer_id: user?.user_id,
                    audio_muted: false,
                    video_enabled: wantVideo,
                    is_screen_sharing: false,
                })
            );
        };

        ws.onmessage = async (evt) => {
            let msg: Record<string, unknown>;
            try { msg = JSON.parse(evt.data as string) as Record<string, unknown>; }
            catch { return; }

            const type = msg.type as string;

            if (type === "room-info") {
                const incomingType = (String(msg.call_type || "video").toLowerCase()) as "video" | "audio";
                setCallType(incomingType);
                if (incomingType === "audio") {
                    setVideoMuted(true);
                    localStreamRef.current?.getVideoTracks().forEach((t) => {
                        t.enabled = false;
                        t.stop();
                    });
                }
                return;
            }

            if (type === "meeting-ended-by-host") {
                cleanUpAllConnections();
                setView("concluded");
                fetchActiveCallStatus();
                return;
            }

            if (type === "peer-mute-status") {
                const targetPeerId = String(msg.peer_id || "").toLowerCase();
                const isAudioMuted = Boolean(msg.audio_muted);

                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p.peerId.toLowerCase() === targetPeerId ? { ...p, audioMuted: isAudioMuted } : p
                    )
                );
                return;
            }

            if (type === "peer-video-status") {
                const targetPeerId = String(msg.peer_id || "").toLowerCase();
                const isVideoEnabled = Boolean(msg.video_enabled);

                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p.peerId.toLowerCase() === targetPeerId ? { ...p, videoEnabled: isVideoEnabled } : p
                    )
                );
                return;
            }

            if (type === "screen-share-started") {
                const targetPeerId = String(msg.sender_id || "").toLowerCase();
                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p.peerId.toLowerCase() === targetPeerId ? { ...p, isScreenSharing: true } : p
                    )
                );
                return;
            }

            if (type === "screen-share-stopped") {
                const targetPeerId = String(msg.sender_id || "").toLowerCase();
                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p.peerId.toLowerCase() === targetPeerId ? { ...p, isScreenSharing: false } : p
                    )
                );
                return;
            }

            if (type === "peer-media-state") {
                const targetPeerId = String(msg.peer_id || "").toLowerCase();
                const isAudioMuted = Boolean(msg.audio_muted);
                const isVideoEnabled = Boolean(msg.video_enabled);
                const isSharing = Boolean(msg.is_screen_sharing);

                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p.peerId.toLowerCase() === targetPeerId
                            ? { ...p, audioMuted: isAudioMuted, videoEnabled: isVideoEnabled, isScreenSharing: isSharing }
                            : p
                    )
                );
                return;
            }

            if (type === "peer-joined") {
                const pId = msg.peer_id as string;
                const pName = (msg.peer_name as string) || "Member";
                const pRole = (msg.peer_role as string) || "MEMBER";

                getOrCreatePeerConnection(pId, pName, pRole, true);
            } else if (type === "offer") {
                const targetId = String(msg.target_peer_id || "").toLowerCase();
                const myId = String(user?.user_id || "").toLowerCase();
                if (targetId && targetId !== myId) return;

                const senderId = msg.sender_id as string;
                const senderName = (msg.sender_name as string) || "Member";
                const senderRole = (msg.sender_role as string) || "MEMBER";

                const pc = getOrCreatePeerConnection(senderId, senderName, senderRole, false);

                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.offer as RTCSessionDescriptionInit));
                    await drainIceForPeer(senderId, pc);

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(
                            JSON.stringify({
                                type: "answer",
                                answer: pc.localDescription,
                                sender_id: user?.user_id,
                                target_peer_id: senderId,
                            })
                        );
                    }
                } catch (err: any) {
                    if (err.name !== "InvalidStateError") console.error("Offer error from peer:", senderId, err);
                }
            } else if (type === "answer") {
                const targetId = String(msg.target_peer_id || "").toLowerCase();
                const myId = String(user?.user_id || "").toLowerCase();
                if (targetId && targetId !== myId) return;

                const senderId = msg.sender_id as string;
                const pc = peerConnectionsRef.current[senderId];

                if (!pc || pc.signalingState !== "have-local-offer") return;

                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.answer as RTCSessionDescriptionInit));
                    await drainIceForPeer(senderId, pc);
                } catch (err: any) {
                    if (err.name !== "InvalidStateError") console.error("Answer error from peer:", senderId, err);
                }
            } else if (type === "candidate" && msg.candidate) {
                const targetId = String(msg.target_peer_id || "").toLowerCase();
                const myId = String(user?.user_id || "").toLowerCase();
                if (targetId && targetId !== myId) return;

                const senderId = msg.sender_id as string;
                const cand = msg.candidate as RTCIceCandidateInit;
                const pc = peerConnectionsRef.current[senderId];

                if (pc && pc.remoteDescription) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { }
                } else {
                    if (!iceCandidateBuffersRef.current[senderId]) {
                        iceCandidateBuffersRef.current[senderId] = [];
                    }
                    iceCandidateBuffersRef.current[senderId].push(cand);
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
                alert("The President / Host has muted your microphone.");
            } else if (type === "force-stop-video") {
                const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
                videoTracks.forEach((t) => { t.enabled = false; t.stop(); });
                setVideoMuted(true);
                broadcastVideoState(false);
                alert("The President / Host has turned off your camera.");
            } else if (type === "force-kick") {
                alert("You have been removed from the meeting by the President / Host.");
                handleExplicitHangUp(false);
            } else if (type === "peer-left" || type === "hangup") {
                const pId = msg.peer_id as string;
                if (peerConnectionsRef.current[pId]) {
                    try { peerConnectionsRef.current[pId].close(); } catch { }
                    delete peerConnectionsRef.current[pId];
                }
                delete iceCandidateBuffersRef.current[pId];

                setRemoteParticipants((prev) => prev.filter((p) => p.peerId !== pId));
            }
        };
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

    function broadcastVideoState(isVideoOn: boolean) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "peer-video-status",
                    peer_id: user?.user_id,
                    video_enabled: isVideoOn,
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
        if (videoMuted || callType === "audio") {
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
                });
                const newTrack = camStream.getVideoTracks()[0];

                cameraStreamRef.current = camStream;

                if (localStreamRef.current) {
                    localStreamRef.current.addTrack(newTrack);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                }

                Object.values(peerConnectionsRef.current).forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) {
                        sender.replaceTrack(newTrack).catch(() => { });
                    } else if (localStreamRef.current) {
                        pc.addTrack(newTrack, localStreamRef.current);
                    }
                });

                setCallType("video");
                setVideoMuted(false);
                broadcastVideoState(true);
            } catch {
                alert("Unable to access camera.");
            }
        } else {
            const tracks = localStreamRef.current?.getVideoTracks() ?? [];
            tracks.forEach((t) => { t.enabled = false; t.stop(); });
            setVideoMuted(true);
            broadcastVideoState(false);
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

    function hostStopPeerVideo(targetPeerId: string) {
        if (wsRef.current?.readyState === WebSocket.OPEN && isOfficer) {
            wsRef.current.send(JSON.stringify({ type: "host-stop-video-peer", target_peer_id: targetPeerId }));
        }
    }

    function hostKickPeer(targetPeerId: string) {
        if (wsRef.current?.readyState === WebSocket.OPEN && isOfficer) {
            wsRef.current.send(JSON.stringify({ type: "host-kick-peer", target_peer_id: targetPeerId }));
        }
    }

    async function toggleScreen() {
        if (isScreenSharing) {
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
                screenStreamRef.current = null;
            }
            setIsScreenSharing(false);

            const camTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === "live");
            if (camTrack && localStreamRef.current) {
                Object.values(peerConnectionsRef.current).forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) sender.replaceTrack(camTrack).catch(() => { });
                });
                setLocalStream(new MediaStream([camTrack, ...(localStreamRef.current.getAudioTracks())]));
            }

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "screen-share-stopped", sender_id: user?.user_id }));
            }
        } else {
            try {
                const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const scrTrack = scrStream.getVideoTracks()[0];
                screenStreamRef.current = scrStream;

                Object.values(peerConnectionsRef.current).forEach((pc) => {
                    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
                    if (sender) {
                        sender.replaceTrack(scrTrack).catch(() => { });
                    } else if (localStreamRef.current) {
                        pc.addTrack(scrTrack, localStreamRef.current);
                    }
                });

                setLocalStream(scrStream);
                setIsScreenSharing(true);

                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "screen-share-started", sender_id: user?.user_id }));
                }

                scrTrack.onended = () => {
                    void toggleScreen();
                };
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

    // FIX 1: Non-disruptive invitation ring to the current room (Host stays inside room)
    async function ringAbsentMemberToCurrentMeeting(target: Member) {
        const currentRoom = currentRoomIdRef.current;
        if (!currentRoom) return;
        setRingingMemberId(target.id);
        try {
            await apiClient.post("/calling/initiate", {
                room_id: currentRoom,
                call_type: callType,
                target_user_id: target.id,
            });
            setTimeout(() => setRingingMemberId(null), 3500);
        } catch (e: unknown) {
            setRingingMemberId(null);
            const err = e as { response?: { data?: { detail?: string } } };
            alert(err.response?.data?.detail ?? "Error ringing member");
        }
    }

    // Accurate User ID Tracking: Active members NEVER appear in the Absent List
    const activeMemberIdsSet = new Set<string>([
        String(user?.user_id || "").toLowerCase(),
        ...remoteParticipants.map((p) => p.peerId.toLowerCase()),
    ]);
    const absentMembersList = members.filter((m) => !activeMemberIdsSet.has(m.id.toLowerCase()));

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
        const totalRemotes = remoteParticipants.length;

        // Active Screen Share check
        const remotePresenter = remoteParticipants.find((p) => p.isScreenSharing);
        const hasActiveScreenShare = isScreenSharing || Boolean(remotePresenter);

        // Professional distinction: Is current session audio or video?
        const isVideoSession = callType === "video" && !videoMuted;

        let gridTemplate = "1fr";
        if (totalRemotes === 1) {
            gridTemplate = isMobile ? "1fr" : "1fr 1fr";
        } else if (totalRemotes === 2) {
            gridTemplate = isMobile ? "1fr 1fr" : "1fr 1fr 1fr";
        } else if (totalRemotes >= 3) {
            gridTemplate = "repeat(auto-fit, minmax(280px, 1fr))";
        }

        return (
            <Box sx={{ position: "fixed", inset: 0, bgcolor: "#080e14", zIndex: 9999, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Top Navigation Bar: Timer & Participants Button */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 40,
                        pt: "max(14px, env(safe-area-inset-top, 14px))",
                        px: { xs: 1.5, sm: 2.5 },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        pointerEvents: "none",
                    }}
                >
                    <Box
                        sx={{
                            pointerEvents: "auto",
                            bgcolor: "rgba(0, 0, 0, 0.65)",
                            backdropFilter: "blur(12px)",
                            border: "1.5px solid rgba(255, 255, 255, 0.2)",
                            px: 1.6,
                            py: 0.6,
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                        }}
                    >
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4CAF50", boxShadow: "0 0 8px #4CAF50" }} />
                        <AccessTimeIcon sx={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }} />
                        <Typography sx={{ color: "white", fontWeight: 800, fontSize: "0.88rem", letterSpacing: 0.6, fontFamily: "monospace" }}>
                            {formatDuration(callDuration)}
                        </Typography>
                    </Box>

                    <Button
                        variant="contained"
                        startIcon={<PeopleIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />}
                        onClick={() => setDrawerOpen(true)}
                        sx={{
                            pointerEvents: "auto",
                            bgcolor: "rgba(0,0,0,0.65)",
                            color: "white",
                            fontWeight: 800,
                            borderRadius: 3,
                            backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            fontSize: { xs: "0.8rem", sm: "0.875rem" },
                            px: { xs: 1.4, sm: 2 },
                            py: 0.6,
                            "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
                        }}
                    >
                        {isMobile ? `(${remoteParticipants.length + 1})` : `Participants (${remoteParticipants.length + 1})`}
                    </Button>
                </Box>

                {/* Priority Screen Sharing Stage Layout (Zoom Style) */}
                {hasActiveScreenShare ? (
                    <Box
                        sx={{
                            flex: 1,
                            width: "100%",
                            height: "100%",
                            pt: "max(64px, env(safe-area-inset-top, 64px))",
                            pb: "115px",
                            px: { xs: 1, sm: 2 },
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                        }}
                    >
                        <Box sx={{ flex: 1, width: "100%", minHeight: 0 }}>
                            {isScreenSharing ? (
                                <ParticipantVideoTile
                                    peerName={`${user?.full_name} (Sharing Screen)`}
                                    peerRole={user?.role || "MEMBER"}
                                    stream={localStream}
                                    isAudioMuted={audioMuted}
                                    isVideoEnabled
                                    isScreenShare
                                    callType="video"
                                />
                            ) : (
                                remotePresenter && (
                                    <ParticipantVideoTile
                                        peerName={`${remotePresenter.peerName} (Sharing Screen)`}
                                        peerRole={remotePresenter.peerRole}
                                        stream={remotePresenter.stream}
                                        isAudioMuted={remotePresenter.audioMuted}
                                        isVideoEnabled
                                        isScreenShare
                                        callType="video"
                                    />
                                )
                            )}
                        </Box>

                        <Box
                            sx={{
                                height: { xs: 100, sm: 120 },
                                width: "100%",
                                display: "flex",
                                gap: 1.2,
                                overflowX: "auto",
                                py: 0.5,
                            }}
                        >
                            <Box sx={{ width: { xs: 120, sm: 150 }, flexShrink: 0, height: "100%" }}>
                                <ParticipantVideoTile
                                    peerName={user?.full_name || "You"}
                                    peerRole={user?.role || "MEMBER"}
                                    stream={isScreenSharing ? cameraStreamRef.current : localStream}
                                    isAudioMuted={audioMuted}
                                    isVideoEnabled={!videoMuted && callType === "video"}
                                    isLocal
                                    callType={callType}
                                />
                            </Box>

                            {remoteParticipants
                                .filter((p) => p.peerId !== remotePresenter?.peerId)
                                .map((peer) => (
                                    <Box key={peer.peerId} sx={{ width: { xs: 120, sm: 150 }, flexShrink: 0, height: "100%" }}>
                                        <ParticipantVideoTile
                                            peerName={peer.peerName}
                                            peerRole={peer.peerRole}
                                            stream={peer.stream}
                                            isAudioMuted={peer.audioMuted}
                                            isVideoEnabled={peer.videoEnabled}
                                            callType={callType}
                                        />
                                    </Box>
                                ))}
                        </Box>
                    </Box>
                ) : (
                    // Regular Multi-Participant Video / Audio Conference Grid
                    <Box
                        sx={{
                            flex: 1,
                            width: "100%",
                            height: "100%",
                            pt: "max(64px, env(safe-area-inset-top, 64px))",
                            pb: "115px",
                            px: { xs: 1, sm: 2 },
                            display: "grid",
                            gridTemplateColumns: gridTemplate,
                            gap: 1.5,
                            overflowY: "auto",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ParticipantVideoTile
                            peerName={user?.full_name || "You"}
                            peerRole={user?.role || "MEMBER"}
                            stream={localStream}
                            isAudioMuted={audioMuted}
                            isVideoEnabled={!videoMuted && callType === "video"}
                            isLocal
                            hasHandRaised={isHandRaised}
                            callType={callType}
                        />

                        {remoteParticipants.map((peer) => (
                            <ParticipantVideoTile
                                key={peer.peerId}
                                peerName={peer.peerName}
                                peerRole={peer.peerRole}
                                stream={peer.stream}
                                isAudioMuted={peer.audioMuted}
                                isVideoEnabled={peer.videoEnabled}
                                hasHandRaised={Boolean(raisedHands[peer.peerId])}
                                callType={callType}
                            />
                        ))}
                    </Box>
                )}

                {/* Floating Emojis (ONLY ACTIVE IN VIDEO CONFERENCES) */}
                {isVideoSession &&
                    floatingEmojis.map((item) => (
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

                {/* Professional Bottom Control Bar: Minimal in Audio Calls, Full in Video Calls */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        pb: "max(20px, env(safe-area-inset-bottom, 18px))",
                        pt: 1.5,
                        px: 1.5,
                        background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)",
                    }}
                >
                    <Stack spacing={1.5} sx={{ alignItems: "center" }}>
                        {/* FIX 2: Emojis Bar ONLY appears in Video Calls (Hidden in Audio Call) */}
                        {isVideoSession && (
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
                        )}

                        {/* Primary Call Controls */}
                        <Stack direction="row" spacing={{ xs: 2.5, sm: 3 }} sx={{ justifyContent: "center", alignItems: "center" }}>
                            {/* 1. Mic Toggle */}
                            <ControlBtn active={audioMuted} label={audioMuted ? "Unmute" : "Mute"} onClick={toggleAudio}>
                                {audioMuted ? <MicOffIcon /> : <MicIcon />}
                            </ControlBtn>

                            {/* 2. Cam Toggle: In Audio Call, displays "Cam On" to allow upgrade */}
                            <ControlBtn
                                active={videoMuted || callType === "audio"}
                                label={videoMuted || callType === "audio" ? "Cam On" : "Cam Off"}
                                onClick={toggleVideo}
                            >
                                {videoMuted || callType === "audio" ? <VideocamOffIcon /> : <VideocamIcon />}
                            </ControlBtn>

                            {/* 3. Hand Raise (Video Call Only) */}
                            {isVideoSession && (
                                <ControlBtn active={isHandRaised} activeColor="warning.main" label={isHandRaised ? "Lower Hand" : "Raise Hand"} onClick={toggleHandRaise}>
                                    {isHandRaised ? <PanToolIcon /> : <PanToolOutlinedIcon />}
                                </ControlBtn>
                            )}

                            {/* 4. Screen Share (Video Call Officers Only) */}
                            {isVideoSession && isOfficer && (
                                <ControlBtn active={isScreenSharing} activeColor="info.main" label={isScreenSharing ? "Stop Share" : "Share"} onClick={toggleScreen}>
                                    {isScreenSharing ? <StopScreenShareIcon /> : <PresentToAllIcon />}
                                </ControlBtn>
                            )}

                            {/* 5. End / Leave Button */}
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

                {/* Professional Multi-Screen Participants Drawer */}
                <Drawer
                    anchor="right"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    sx={{
                        zIndex: 10001,
                        "& .MuiDrawer-paper": {
                            width: { xs: "85vw", sm: 380, md: 440 },
                            maxWidth: 460,
                            p: { xs: 2.2, sm: 3 },
                            bgcolor: "#0d1b2a",
                            color: "white",
                            borderLeft: "1.5px solid rgba(242, 169, 0, 0.35)",
                        },
                    }}
                >
                    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: "white", fontSize: { xs: "1.1rem", sm: "1.25rem" } }}>
                                👥 Meeting Participants
                            </Typography>
                            <Chip
                                label={`${remoteParticipants.length + 1} Online`}
                                color="success"
                                size="small"
                                sx={{ fontWeight: 800, height: 24 }}
                            />
                        </Stack>
                        <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.15)" }} />

                        <List sx={{ flex: 1, overflowY: "auto", p: 0 }}>
                            {/* 1. Self Participant Card */}
                            <Paper
                                elevation={2}
                                sx={{
                                    p: 1.8,
                                    mb: 1.8,
                                    borderRadius: 3.5,
                                    bgcolor: "rgba(255, 255, 255, 0.08)",
                                    border: "1.5px solid #F2A900",
                                    color: "white",
                                }}
                            >
                                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                                        <Avatar sx={{ bgcolor: "#002F6C", color: "#F2A900", border: "1.5px solid #F2A900", fontWeight: 800 }}>
                                            {user?.full_name?.charAt(0)}
                                        </Avatar>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "white" }} noWrap>
                                                {user?.full_name} (You)
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
                                                {user?.role}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
                                        {audioMuted ? (
                                            <Chip icon={<MicOffIcon sx={{ fontSize: 13, color: "white !important" }} />} label="Muted" size="small" sx={{ bgcolor: "#d32f2f", color: "white", height: 22, fontSize: "0.68rem", fontWeight: 800 }} />
                                        ) : (
                                            <Chip icon={<MicIcon sx={{ fontSize: 13, color: "white !important" }} />} label="Mic On" size="small" sx={{ bgcolor: "#2e7d32", color: "white", height: 22, fontSize: "0.68rem", fontWeight: 800 }} />
                                        )}
                                        {videoMuted && (
                                            <Chip label="Cam Off" size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", height: 22, fontSize: "0.68rem" }} />
                                        )}
                                    </Stack>
                                </Stack>
                            </Paper>

                            {/* 2. Remote Connected Peers Cards */}
                            {remoteParticipants.map((peer) => (
                                <Paper
                                    key={peer.peerId}
                                    elevation={1}
                                    sx={{
                                        p: 1.8,
                                        mb: 1.8,
                                        borderRadius: 3.5,
                                        bgcolor: "rgba(255, 255, 255, 0.04)",
                                        border: "1px solid rgba(255, 255, 255, 0.12)",
                                        color: "white",
                                    }}
                                >
                                    <Stack spacing={1.2}>
                                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                                            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0, flex: 1 }}>
                                                <Avatar sx={{ bgcolor: "#1565C0", color: "white", fontWeight: 800 }}>
                                                    {peer.peerName.charAt(0)}
                                                </Avatar>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "white" }} noWrap>
                                                        {peer.peerName}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>
                                                        {peer.peerRole}
                                                    </Typography>
                                                </Box>
                                            </Stack>

                                            <Stack direction="row" spacing={0.8} sx={{ alignItems: "center" }}>
                                                {peer.audioMuted && (
                                                    <Chip icon={<MicOffIcon sx={{ fontSize: 13, color: "white !important" }} />} label="Muted" size="small" sx={{ bgcolor: "#d32f2f", color: "white", height: 22, fontSize: "0.68rem", fontWeight: 800 }} />
                                                )}
                                                {!peer.videoEnabled && (
                                                    <Chip label="Cam Off" size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "white", height: 22, fontSize: "0.68rem" }} />
                                                )}
                                            </Stack>
                                        </Stack>

                                        {isOfficer && (
                                            <Stack direction="row" spacing={1} sx={{ pt: 0.5, borderTop: "1px solid rgba(255,255,255,0.08)", justifyContent: "flex-end" }}>
                                                <Tooltip title={peer.audioMuted ? "Member already Muted" : "Mute Member Mic"}>
                                                    <span>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color={peer.audioMuted ? "inherit" : "warning"}
                                                            onClick={() => hostMutePeer(peer.peerId)}
                                                            disabled={peer.audioMuted}
                                                            startIcon={peer.audioMuted ? <MicOffIcon /> : <VolumeOffIcon />}
                                                            sx={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "none", py: 0.3 }}
                                                        >
                                                            {peer.audioMuted ? "Muted" : "Mute Mic"}
                                                        </Button>
                                                    </span>
                                                </Tooltip>

                                                <Tooltip title={peer.videoEnabled ? "Turn Off Member Camera" : "Camera already Off"}>
                                                    <span>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color={peer.videoEnabled ? "info" : "inherit"}
                                                            onClick={() => hostStopPeerVideo(peer.peerId)}
                                                            disabled={!peer.videoEnabled}
                                                            startIcon={<VideocamOffIcon />}
                                                            sx={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "none", py: 0.3 }}
                                                        >
                                                            Stop Cam
                                                        </Button>
                                                    </span>
                                                </Tooltip>

                                                <Tooltip title="Remove Member from Meeting">
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        color="error"
                                                        onClick={() => hostKickPeer(peer.peerId)}
                                                        startIcon={<PersonRemoveIcon />}
                                                        sx={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "none", py: 0.3 }}
                                                    >
                                                        Kick
                                                    </Button>
                                                </Tooltip>
                                            </Stack>
                                        )}
                                    </Stack>
                                </Paper>
                            ))}
                        </List>

                        {/* 3. Luxury Absent Member List */}
                        {isOfficer && (
                            <>
                                <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,0.15)" }} />
                                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.2 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>
                                        Not Joined Yet (Absent):
                                    </Typography>
                                    <Chip
                                        label={`${absentMembersList.length} Absent`}
                                        size="small"
                                        sx={{ bgcolor: "rgba(255,255,255,0.12)", color: "white", fontSize: "0.7rem", height: 20 }}
                                    />
                                </Stack>

                                <List dense sx={{ maxHeight: 180, overflowY: "auto", p: 0 }}>
                                    {absentMembersList.length === 0 ? (
                                        <Box sx={{ p: 2, textAlign: "center", bgcolor: "rgba(46, 125, 50, 0.15)", borderRadius: 2 }}>
                                            <Typography variant="caption" sx={{ color: "#81C784", fontWeight: 800 }}>
                                                🎉 All club members have joined the meeting!
                                            </Typography>
                                        </Box>
                                    ) : (
                                        absentMembersList.map((m) => {
                                            const isRinging = ringingMemberId === m.id;
                                            return (
                                                <ListItem
                                                    key={m.id}
                                                    secondaryAction={
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color={isRinging ? "success" : "warning"}
                                                            disabled={isRinging}
                                                            startIcon={
                                                                isRinging ? (
                                                                    <CircularProgress size={12} sx={{ color: "white" }} />
                                                                ) : (
                                                                    <NotificationsActiveIcon sx={{ fontSize: 14 }} />
                                                                )
                                                            }
                                                            onClick={() => ringAbsentMemberToCurrentMeeting(m)}
                                                            sx={{
                                                                fontWeight: 800,
                                                                fontSize: "0.72rem",
                                                                borderRadius: 2,
                                                                textTransform: "none",
                                                                py: 0.3,
                                                            }}
                                                        >
                                                            {isRinging ? "Ringing…" : "Ring"}
                                                        </Button>
                                                    }
                                                    sx={{
                                                        py: 0.8,
                                                        px: 1.2,
                                                        borderRadius: 2.5,
                                                        mb: 0.8,
                                                        bgcolor: "rgba(255,255,255,0.03)",
                                                        border: "1px solid rgba(255,255,255,0.06)",
                                                    }}
                                                >
                                                    <ListItemText
                                                        primary={<Typography variant="body2" sx={{ fontWeight: 700, color: "white" }} noWrap>{m.full_name}</Typography>}
                                                        secondary={<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>{m.role}</Typography>}
                                                    />
                                                </ListItem>
                                            );
                                        })
                                    )}
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
                            Join Active Club {activeCallInfo.call_type === "audio" ? "Audio" : "Video"} Meeting ({activeCallInfo.participant_count} Online)
                        </Button>
                    )}

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

            <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>📞 Call a Member</DialogTitle>
                <DialogContent>
                    {members.length === 0 ? (
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>No other members available</Typography>
                    ) : (
                        <List disablePadding>
                            {members
                                .filter((m) => m.id !== user?.user_id)
                                .map((m) => (
                                    <ListItem
                                        key={m.id}
                                        secondaryAction={
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
                                        }
                                        sx={{ py: 1.2, px: 1, borderRadius: 2, mb: 1, bgcolor: "background.paper" }}
                                    >
                                        <ListItemIcon><Avatar sx={{ bgcolor: "primary.main" }}>{m.full_name.charAt(0)}</Avatar></ListItemIcon>
                                        <ListItemText primary={<Typography sx={{ fontWeight: 700 }}>{m.full_name}</Typography>} secondary={m.role} />
                                    </ListItem>
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