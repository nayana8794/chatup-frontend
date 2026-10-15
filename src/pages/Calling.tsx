// chatup/frontend/src/pages/Calling.tsx
import React, { useState, useEffect, useRef } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Stack,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Avatar,
    Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";

declare global {
    interface Window {
        JitsiMeetExternalAPI: any;
    }
}

interface Member {
    id: string;
    full_name: string;
    role: string;
}

export const Calling: React.FC<{ onBack: () => void; initialRoomId?: string }> = ({
    onBack,
    initialRoomId,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();

    // Role permissions
    const canLeadMeeting = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "VICE_SECRETARY",
        "PLANNER",
        "VICE_PLANNER",
    ].includes(user?.role || "");

    const [inCall, setInCall] = useState<boolean>(Boolean(initialRoomId));
    const [activeRoomName, setActiveRoomName] = useState<string | null>(initialRoomId || null);

    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);

    const jitsiContainerRef = useRef<HTMLDivElement>(null);
    const jitsiApiRef = useRef<any>(null);

    // Fetch members for direct calling
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

    // Mount Jitsi Meeting Canvas
    useEffect(() => {
        if (inCall && activeRoomName && jitsiContainerRef.current) {
            // Clean up previous instance if any
            if (jitsiApiRef.current) {
                jitsiApiRef.current.dispose();
            }

            const domain = "meet.jit.si";
            const options = {
                roomName: activeRoomName,
                parentNode: jitsiContainerRef.current,
                width: "100%",
                height: "100%",
                userInfo: {
                    displayName: `${user?.full_name} (${user?.role})`,
                    email: user?.user_id,
                },
                configOverwrite: {
                    startWithAudioMuted: false,
                    startWithVideoMuted: false,
                    prejoinPageEnabled: false, // Jump straight into active meeting
                    disableDeepLinking: true,
                    enableWelcomePage: false,
                },
                interfaceConfigOverwrite: {
                    TOOLBAR_BUTTONS: [
                        "microphone",
                        "camera",
                        "desktop", // Screen sharing
                        "fullscreen",
                        "fodeviceselection",
                        "hangup",
                        "chat",
                        "raisehand",
                        "tileview",
                        "mute-everyone",
                    ],
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                },
            };

            if (window.JitsiMeetExternalAPI) {
                const api = new window.JitsiMeetExternalAPI(domain, options);
                jitsiApiRef.current = api;

                api.addEventListeners({
                    videoConferenceLeft: () => {
                        handleLeaveCall();
                    },
                });
            }
        }

        return () => {
            if (jitsiApiRef.current) {
                jitsiApiRef.current.dispose();
                jitsiApiRef.current = null;
            }
        };
    }, [inCall, activeRoomName, user]);

    const handleStartGroupCall = async () => {
        // Generate secure tenant-isolated room name
        const room = `chatup-lions-${user?.tenant_id || "general"}-meeting`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: room,
                call_type: "video",
            });
            setActiveRoomName(room);
            setInCall(true);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to start meeting.");
        }
    };

    const handleStartDirectCall = async (targetMember: Member) => {
        setMembersModalOpen(false);
        const room = `chatup-direct-${[user?.user_id, targetMember.id].sort().join("-")}`;
        try {
            await apiClient.post("/calling/initiate", {
                room_id: room,
                call_type: "video",
                target_user_id: targetMember.id,
            });
            setActiveRoomName(room);
            setInCall(true);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to start direct call.");
        }
    };

    const handleLeaveCall = () => {
        if (jitsiApiRef.current) {
            jitsiApiRef.current.dispose();
            jitsiApiRef.current = null;
        }
        setInCall(false);
        setActiveRoomName(null);
        onBack();
    };

    // ================= VIEW 1: ACTIVE LIVE MEETING STAGE =================
    if (inCall) {
        return (
            <Box sx={{ height: "100vh", width: "100vw", position: "fixed", top: 0, left: 0, bgcolor: "#000", zIndex: 1300, display: "flex", flexDirection: "column" }}>
                {/* Top Floating App Bar */}
                <Box
                    sx={{
                        p: 1.5,
                        bgcolor: "rgba(0,0,0,0.85)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        color: "white",
                        zIndex: 1400,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <VideoCallIcon sx={{ color: "#4CAF50" }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            Live Club Video Meeting
                        </Typography>
                        <Chip label="Encrypted WebRTC Stream" color="success" size="small" sx={{ fontWeight: 800 }} />
                    </Box>

                    <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<CallEndIcon />}
                        onClick={handleLeaveCall}
                        sx={{ fontWeight: 800, borderRadius: 2 }}
                    >
                        Leave
                    </Button>
                </Box>

                {/* Live Video Canvas Container */}
                <Box ref={jitsiContainerRef} sx={{ flex: 1, width: "100%", height: "100%" }} />
            </Box>
        );
    }

    // ================= VIEW 2: LOBBY & INITIATOR =================
    return (
        <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 }, display: "flex", alignItems: "center", minHeight: "100vh" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 5 }, width: "100%", borderRadius: 4, textAlign: "center" }}>
                <Box sx={{ mb: 3 }}>
                    <VideoCallIcon color="primary" sx={{ fontSize: 65, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
                        {t("calling_title")}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                        Real-time HD audio, video conference & screen sharing.
                    </Typography>
                </Box>

                <Stack spacing={2.5} sx={{ mb: 4 }}>
                    {canLeadMeeting ? (
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
                    ) : (
                        <Alert severity="info" icon={<LockPersonIcon />} sx={{ borderRadius: 3, fontWeight: 700, textAlign: "left" }}>
                            Club conferences are initiated by President, Secretary, or Planner. You will receive a live ringtone when a meeting starts.
                        </Alert>
                    )}

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
                    <ArrowBackIcon sx={{ mr: 1 }} /> {t("back_to_dashboard")}
                </Button>
            </Paper>

            {/* Select Member Dialog */}
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