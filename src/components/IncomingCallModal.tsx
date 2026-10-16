// chatup/frontend/src/components/IncomingCallModal.tsx
import React, { useEffect, useState } from "react";
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
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import CallEndIcon from "@mui/icons-material/CallEnd";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import { useRealtime } from "../context/useRealtime";
import { playRingingRingtone } from "../utils/sound";

const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.4); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(46, 125, 50, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
`;

export const IncomingCallModal: React.FC<{ onAcceptCall: (roomId: string) => void }> = ({
    onAcceptCall,
}) => {
    const { lastEvent } = useRealtime();
    const [callData, setCallData] = useState<{ room_id: string; caller_name: string; caller_role: string } | null>(null);

    useEffect(() => {
        if (lastEvent?.type === "INCOMING_CALL") {
            setCallData({
                room_id: lastEvent.room_id,
                caller_name: lastEvent.caller_name,
                caller_role: lastEvent.caller_role,
            });
            playRingingRingtone();
        }
    }, [lastEvent]);

    if (!callData) return null;

    return (
        <Dialog
            open={Boolean(callData)}
            maxWidth="xs"
            fullWidth
            sx={{
                "& .MuiDialog-paper": {
                    m: 2,
                    borderRadius: 5,
                    textAlign: "center",
                    p: 3,
                    bgcolor: "background.paper",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
                },
            }}
        >
            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                    <VideoCallIcon color="primary" sx={{ fontSize: 40 }} />
                </Box>

                <Typography variant="overline" sx={{ fontWeight: 800, color: "primary.main", letterSpacing: 1.5 }}>
                    🦁 LIVE CLUB CONFERENCE
                </Typography>

                <Box sx={{ my: 3, display: "flex", justifyContent: "center" }}>
                    <Avatar
                        sx={{
                            width: 90,
                            height: 90,
                            bgcolor: "primary.main",
                            fontSize: "2.5rem",
                            fontWeight: 900,
                            animation: `${pulse} 2s infinite`,
                        }}
                    >
                        {callData.caller_name.charAt(0)}
                    </Avatar>
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 900, color: "text.primary" }}>
                    {callData.caller_name}
                </Typography>
                <Chip
                    label={callData.caller_role}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 800, mt: 0.8, mb: 2 }}
                />

                <Typography variant="body2" color="text.secondary" sx={{ mb: 4, px: 2 }}>
                    has started a live group video meeting for all club members. Join now!
                </Typography>

                <Stack direction="row" spacing={3} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<CallEndIcon />}
                        onClick={() => setCallData(null)}
                        sx={{
                            fontWeight: 800,
                            borderRadius: 3,
                            px: 3,
                            py: 1.5,
                            flex: 1,
                            bgcolor: "#d32f2f",
                        }}
                    >
                        Decline
                    </Button>

                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<PhoneInTalkIcon />}
                        onClick={() => {
                            const rId = callData.room_id;
                            setCallData(null);
                            onAcceptCall(rId);
                        }}
                        sx={{
                            fontWeight: 800,
                            borderRadius: 3,
                            px: 3,
                            py: 1.5,
                            flex: 1,
                            bgcolor: "#2e7d32",
                            animation: `${pulse} 1.5s infinite`,
                        }}
                    >
                        Accept & Join
                    </Button>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};