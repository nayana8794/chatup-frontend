// chatup/frontend/src/components/IncomingCallModal.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    Dialog,
    DialogContent,
    Typography,
    Button,
    Stack,
    Avatar,
    Box,
    Chip,
    keyframes,
} from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { startRingtone, stopRingtone } from "../utils/sound";
import apiClient from "../api/client";

const ripple = keyframes`
  0% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.5); }
  70% { transform: scale(1.15); opacity: 0.3; box-shadow: 0 0 0 25px rgba(76, 175, 80, 0); }
  100% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
`;

const handledCallRooms = new Set<string>();

export const IncomingCallModal: React.FC<{ onAcceptCall: (roomId: string, callType?: "video" | "audio") => void }> = ({
    onAcceptCall,
}) => {
    const { user } = useAuth();
    const { lastEvent } = useRealtime();
    const [callData, setCallData] = useState<{
        room_id: string;
        caller_id: string;
        caller_name: string;
        caller_role: string;
        call_type: "video" | "audio";
        is_direct?: boolean;
    } | null>(null);

    const callDataRef = useRef(callData);
    useEffect(() => {
        callDataRef.current = callData;
    }, [callData]);

    const handleDismiss = useCallback(() => {
        stopRingtone();
        setCallData(null);
    }, []);

    useEffect(() => {
        if (!lastEvent) return;

        if (lastEvent.type === "INCOMING_CALL") {
            const roomId = String(lastEvent.room_id || "");
            const currentUserId = String(user?.user_id || "").toLowerCase();
            const callerId = String(lastEvent.caller_id || "").toLowerCase();

            if (callerId && currentUserId && callerId === currentUserId) {
                return;
            }

            // Direct or targeted invite check
            const isTargetedToMe = Boolean(
                lastEvent.target_user_id &&
                String(lastEvent.target_user_id).toLowerCase() === currentUserId
            );

            // FIX: If Host specifically rings this absent user, clear previous memory and allow ringing!
            if (isTargetedToMe) {
                handledCallRooms.delete(roomId);
            } else if (handledCallRooms.has(roomId)) {
                return;
            }

            if (lastEvent.is_direct && lastEvent.target_user_id && !isTargetedToMe) {
                return;
            }

            const incomingType = String(lastEvent.call_type || "video").toLowerCase() === "audio" ? "audio" : "video";

            setCallData({
                room_id: lastEvent.room_id,
                caller_id: lastEvent.caller_id,
                caller_name: lastEvent.caller_name || "Club Member",
                caller_role: lastEvent.caller_role || "MEMBER",
                call_type: incomingType,
                is_direct: lastEvent.is_direct,
            });

            startRingtone();

            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([300, 150, 300, 150, 500]);
            }
        } else if (lastEvent.type === "CALL_ENDED") {
            const endedRoomId = String(lastEvent.room_id || "");
            handledCallRooms.delete(endedRoomId);

            if (callDataRef.current && callDataRef.current.room_id === endedRoomId) {
                handleDismiss();
            }
        } else if (lastEvent.type === "CALL_DECLINED") {
            if (
                callDataRef.current &&
                callDataRef.current.is_direct &&
                callDataRef.current.room_id === lastEvent.room_id
            ) {
                handleDismiss();
            }
        }
    }, [lastEvent, user?.user_id, handleDismiss]);

    const handleDecline = async () => {
        if (callData) {
            handledCallRooms.add(callData.room_id);
            try {
                await apiClient.post("/calling/decline", { room_id: callData.room_id });
            } catch { }
        }
        handleDismiss();
    };

    const handleAccept = () => {
        if (!callData) return;
        const roomId = callData.room_id;
        const cType = callData.call_type;
        handledCallRooms.add(roomId);
        handleDismiss();
        onAcceptCall(roomId, cType);
    };

    if (!callData) return null;

    const isAudioCall = callData.call_type === "audio";

    return (
        <Dialog
            open={Boolean(callData)}
            maxWidth="xs"
            fullWidth
            disableRestoreFocus
            sx={{
                zIndex: 10000,
                "& .MuiBackdrop-root": {
                    bgcolor: "rgba(0, 10, 28, 0.75)",
                    backdropFilter: "blur(14px)",
                },
                "& .MuiDialog-paper": {
                    m: 2,
                    borderRadius: "28px",
                    textAlign: "center",
                    overflow: "hidden",
                    background: "linear-gradient(155deg, #001f4d 0%, #002F6C 60%, #00122e 100%)",
                    border: "1.5px solid rgba(242, 169, 0, 0.4)",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.65)",
                    color: "white",
                },
            }}
        >
            <DialogContent sx={{ p: { xs: 3.5, sm: 4.5 } }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: "rgba(242, 169, 0, 0.15)", border: "1px solid rgba(242, 169, 0, 0.35)", px: 2, py: 0.6, borderRadius: 5, mb: 3 }}>
                    {isAudioCall ? (
                        <PhoneInTalkIcon sx={{ color: "#F2A900", fontSize: 20 }} />
                    ) : (
                        <VideoCallIcon sx={{ color: "#F2A900", fontSize: 20 }} />
                    )}
                    <Typography variant="caption" sx={{ fontWeight: 900, color: "#F2A900", letterSpacing: 1.2, textTransform: "uppercase" }}>
                        {isAudioCall ? "Live Audio Meeting" : "Live Video Meeting"}
                    </Typography>
                </Box>

                <Box sx={{ my: 2, display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Box sx={{ position: "absolute", width: 110, height: 110, borderRadius: "50%", border: "2px solid rgba(76, 175, 80, 0.6)", animation: `${ripple} 2s infinite ease-out` }} />
                        <Avatar
                            sx={{
                                width: 94,
                                height: 94,
                                bgcolor: "#002F6C",
                                color: "#F2A900",
                                fontSize: "2.8rem",
                                fontWeight: 900,
                                border: "3px solid #F2A900",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                            }}
                        >
                            {callData.caller_name.charAt(0).toUpperCase()}
                        </Avatar>
                    </Box>
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 900, color: "white", mt: 2.5, mb: 0.5 }}>
                    {callData.caller_name}
                </Typography>

                <Chip
                    label={callData.caller_role}
                    size="small"
                    sx={{
                        fontWeight: 900,
                        bgcolor: "rgba(255, 255, 255, 0.15)",
                        color: "white",
                        fontSize: "0.75rem",
                        height: 24,
                        mb: 2,
                    }}
                />

                <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.75)", mb: 4, px: 1, lineHeight: 1.5 }}>
                    {isAudioCall
                        ? "Incoming group audio meeting invitation. Tap accept to join."
                        : "Incoming group video meeting invitation. Tap accept to join."}
                </Typography>

                <Stack direction="row" spacing={2.5} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="contained"
                        onClick={handleDecline}
                        startIcon={<CallEndIcon sx={{ fontSize: 24 }} />}
                        sx={{
                            flex: 1,
                            minHeight: 56,
                            borderRadius: 4,
                            bgcolor: "#d32f2f",
                            color: "white",
                            fontWeight: 800,
                            fontSize: "1rem",
                            boxShadow: "0 4px 14px rgba(211, 47, 47, 0.45)",
                            "&:hover": { bgcolor: "#b71c1c" },
                        }}
                    >
                        Decline
                    </Button>

                    <Button
                        variant="contained"
                        onClick={handleAccept}
                        startIcon={isAudioCall ? <PhoneInTalkIcon sx={{ fontSize: 24 }} /> : <CallIcon sx={{ fontSize: 24 }} />}
                        sx={{
                            flex: 1.2,
                            minHeight: 56,
                            borderRadius: 4,
                            bgcolor: "#2e7d32",
                            color: "white",
                            fontWeight: 900,
                            fontSize: "1.02rem",
                            boxShadow: "0 4px 18px rgba(46, 125, 50, 0.55)",
                            "&:hover": { bgcolor: "#1b5e20" },
                        }}
                    >
                        Join Call
                    </Button>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};