// chatup/frontend/src/components/IncomingCallModal.tsx
import React, { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    Box,
    Chip,
    Avatar,
} from "@mui/material";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { playRingingRingtone } from "../utils/sound";
import apiClient from "../api/client";

interface IncomingCallInfo {
    room_id: string;
    caller_id: string;
    caller_name: string;
    caller_role: string;
    call_type: string;
    is_direct: boolean;
    target_user_id?: string;
}

export const IncomingCallModal: React.FC<{ onAcceptCall: (roomId: string) => void }> = ({
    onAcceptCall,
}) => {
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const [callData, setCallData] = useState<IncomingCallInfo | null>(null);
    const ringtoneIntervalRef = useRef<any>(null);

    const stopRingtone = () => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
    };

    useEffect(() => {
        if (!lastEvent || !user) return;

        if (lastEvent.type === "INCOMING_CALL") {
            const isCaller =
                String(lastEvent.caller_id).toLowerCase() === String(user.user_id).toLowerCase();

            // Don't ring oneself
            if (isCaller) return;

            // If direct call, verify target is this user
            if (lastEvent.is_direct && lastEvent.target_user_id) {
                const isTarget =
                    String(lastEvent.target_user_id).toLowerCase() === String(user.user_id).toLowerCase();
                if (!isTarget) return;
            }

            setCallData({
                room_id: lastEvent.room_id,
                caller_id: lastEvent.caller_id,
                caller_name: lastEvent.caller_name,
                caller_role: lastEvent.caller_role,
                call_type: lastEvent.call_type,
                is_direct: lastEvent.is_direct,
                target_user_id: lastEvent.target_user_id,
            });

            // Play ringing sound loop
            playRingingRingtone();
            ringtoneIntervalRef.current = setInterval(() => {
                playRingingRingtone();
            }, 3000);
        }

        if (lastEvent.type === "CALL_DECLINED" && callData) {
            if (lastEvent.room_id === callData.room_id) {
                stopRingtone();
                setCallData(null);
            }
        }
    }, [lastEvent, user, callData]);

    const handleDecline = async () => {
        stopRingtone();
        if (callData) {
            try {
                await apiClient.post("/calling/decline", {
                    room_id: callData.room_id,
                    caller_id: callData.caller_id,
                });
            } catch (err) {
                // Ignore
            }
        }
        setCallData(null);
    };

    const handleAccept = () => {
        stopRingtone();
        if (callData) {
            const rId = callData.room_id;
            setCallData(null);
            onAcceptCall(rId);
        }
    };

    if (!callData) return null;

    return (
        <Dialog
            open={Boolean(callData)}
            maxWidth="xs"
            fullWidth
            sx={{ "& .MuiDialog-paper": { borderRadius: 4, textAlign: "center", p: 2.5, m: 2 } }}
        >
            <DialogTitle sx={{ fontWeight: 900, color: "primary.main", fontSize: "1.4rem" }}>
                {callData.is_direct ? "📞 Direct Call Incoming" : "🦁 Club Conference Call"}
            </DialogTitle>

            <DialogContent sx={{ py: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                    <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main", fontSize: "2rem" }}>
                        {callData.caller_name.charAt(0)}
                    </Avatar>
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {callData.caller_name}
                </Typography>

                <Chip
                    label={callData.caller_role}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 800, mt: 1, mb: 2 }}
                />

                <Typography variant="body2" color="text.secondary">
                    {callData.is_direct
                        ? "is calling you for a direct private video conversation."
                        : "has started a live group video meeting for all club members."}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ p: 2, justifyContent: "center", gap: 2 }}>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<CallEndIcon />}
                    onClick={handleDecline}
                    sx={{ fontWeight: 800, minHeight: 48, px: 3, borderRadius: 3 }}
                >
                    Decline
                </Button>
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<PhoneInTalkIcon />}
                    onClick={handleAccept}
                    sx={{ fontWeight: 800, minHeight: 48, px: 4, borderRadius: 3 }}
                >
                    Accept & Join
                </Button>
            </DialogActions>
        </Dialog>
    );
};