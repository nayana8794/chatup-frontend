// chatup/frontend/src/pages/Chat.tsx
import React, { useState, useEffect, useRef } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    TextField,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Chip,
    Divider,
    Stack,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    Badge,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import TagIcon from "@mui/icons-material/Tag";
import LockIcon from "@mui/icons-material/Lock";
import PersonIcon from "@mui/icons-material/Person";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";
import { playNotificationChime } from "../utils/sound";

interface ChatRoom {
    id: string;
    name: string;
    room_type: "GENERAL" | "BOARD" | "DIRECT";
    last_message?: string;
    last_message_time?: string;
    unread_count: number;
}

interface ChatMessage {
    id: string;
    room_id: string;
    sender_id?: string;
    sender_name: string;
    sender_role: string;
    content: string;
    created_at: string;
}

interface Member {
    id: string;
    full_name: string;
    role: string;
}

export const Chat: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { refreshUnread } = useRealtime(); // Live badge refresh function
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageInput, setMessageInput] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const [openUserList, setOpenUserList] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [showMobileChat, setShowMobileChat] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Backend එකේ කාමරය කියවූ බව සටහන් කර Global Badge එක ක්ෂණිකව 0 කිරීම
    const markAsRead = async (roomId: string) => {
        try {
            await apiClient.post(`/chat/rooms/${roomId}/read`);
            setRooms((prev) =>
                prev.map((r) => (r.id === roomId ? { ...r, unread_count: 0 } : r))
            );
            refreshUnread(); // Global unread badge එක ක්ෂණිකව update කිරීම
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRooms = async () => {
        try {
            setLoadingRooms(true);
            const res = await apiClient.get("/chat/rooms");
            setRooms(res.data);
            if (res.data.length > 0 && !activeRoom) {
                setActiveRoom(res.data[0]);
                markAsRead(res.data[0].id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingRooms(false);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (!activeRoom) return;

        const fetchMessages = async () => {
            try {
                setLoadingMessages(true);
                const res = await apiClient.get(`/chat/rooms/${activeRoom.id}/messages`);
                setMessages(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();
        markAsRead(activeRoom.id);
    }, [activeRoom]);

    // Live WebSocket Connection for active room
    useEffect(() => {
        if (!activeRoom) return;

        const token = localStorage.getItem("chatup_token");
        if (!token) return;

        const wsUrl = `ws://127.0.0.1:8000/api/v1/chat/ws/${activeRoom.id}?token=${token}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onmessage = (event) => {
            const incomingMessage: ChatMessage = JSON.parse(event.data);
            setMessages((prev) => [...prev, incomingMessage]);

            const isSender =
                String(incomingMessage.sender_id).toLowerCase() === String(user?.user_id).toLowerCase();

            if (!isSender) {
                playNotificationChime();
                markAsRead(activeRoom.id);
            }
        };

        return () => {
            ws.close();
        };
    }, [activeRoom, user]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim() || !socketRef.current) return;

        if (socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ content: messageInput.trim() }));
            setMessageInput("");
        }
    };

    const handleStartDirectChat = async (targetUserId: string) => {
        try {
            const res = await apiClient.post("/chat/direct", { target_user_id: targetUserId });
            setOpenUserList(false);
            await fetchRooms();
            setActiveRoom(res.data);
            markAsRead(res.data.id);
            if (isMobile) setShowMobileChat(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleOpenUserList = async () => {
        try {
            const res = await apiClient.get("/members");
            setMembers(res.data.filter((m: Member) => m.id !== user?.user_id));
            setOpenUserList(true);
        } catch (err) {
            console.error(err);
        }
    };

    const selectRoom = (room: ChatRoom) => {
        setActiveRoom(room);
        markAsRead(room.id);
        if (isMobile) {
            setShowMobileChat(true);
        }
    };

    const handleBackToDashboard = () => {
        refreshUnread();
        onBack();
    };

    return (
        <Container maxWidth="xl" sx={{ py: { xs: 1, sm: 3 }, px: { xs: 1, sm: 2 } }}>
            <Stack
                direction="row"
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBackToDashboard}
                    variant="outlined"
                    sx={{ fontWeight: "bold", minHeight: 44 }}
                >
                    {t("back_to_dashboard")}
                </Button>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    💬 {t("chat_title")}
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PersonAddAltIcon />}
                    onClick={handleOpenUserList}
                    sx={{ fontWeight: "bold", minHeight: 44 }}
                >
                    {t("start_chat_with")}
                </Button>
            </Stack>

            <Paper
                elevation={3}
                sx={{
                    height: { xs: "calc(100vh - 150px)", sm: "75vh" },
                    borderRadius: 3,
                    overflow: "hidden",
                    display: "flex",
                }}
            >
                {/* ================= LEFT COLUMN: CHANNELS & UNREAD BADGES ================= */}
                {(!isMobile || !showMobileChat) && (
                    <Box
                        sx={{
                            width: { xs: "100%", md: 320 },
                            borderRight: "1px solid",
                            borderColor: "divider",
                            display: "flex",
                            flexDirection: "column",
                            bgcolor: "background.paper",
                        }}
                    >
                        <Box sx={{ p: 2, bgcolor: "grey.100" }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
                                🦁 Channels & Chats
                            </Typography>
                        </Box>

                        <Divider />

                        {loadingRooms ? (
                            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                                <CircularProgress size={36} />
                            </Box>
                        ) : (
                            <List sx={{ flex: 1, overflowY: "auto", p: 1 }}>
                                {rooms.map((room) => {
                                    const isSelected = activeRoom?.id === room.id;
                                    return (
                                        <ListItemButton
                                            key={room.id}
                                            selected={isSelected}
                                            onClick={() => selectRoom(room)}
                                            sx={{
                                                borderRadius: 2,
                                                mb: 0.5,
                                                "&.Mui-selected": { bgcolor: "primary.main", color: "white" },
                                                "&.Mui-selected:hover": { bgcolor: "primary.dark" },
                                            }}
                                        >
                                            <ListItemIcon sx={{ color: isSelected ? "white" : "primary.main", minWidth: 38 }}>
                                                {room.room_type === "GENERAL" ? (
                                                    <TagIcon />
                                                ) : room.room_type === "BOARD" ? (
                                                    <LockIcon />
                                                ) : (
                                                    <PersonIcon />
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography sx={{ fontWeight: isSelected ? 800 : 600, fontSize: "1rem" }}>
                                                        {room.name}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography
                                                        noWrap
                                                        sx={{ color: isSelected ? "grey.300" : "text.secondary", fontSize: "0.85rem" }}
                                                    >
                                                        {room.last_message || "No messages yet"}
                                                    </Typography>
                                                }
                                            />
                                            {room.unread_count > 0 && !isSelected && (
                                                <Badge
                                                    badgeContent={room.unread_count}
                                                    color="error"
                                                    sx={{
                                                        "& .MuiBadge-badge": {
                                                            fontWeight: "bold",
                                                            fontSize: "0.8rem",
                                                            height: 20,
                                                            minWidth: 20,
                                                        },
                                                    }}
                                                />
                                            )}
                                        </ListItemButton>
                                    );
                                })}
                            </List>
                        )}
                    </Box>
                )}

                {/* ================= RIGHT COLUMN: CONVERSATION AREA ================= */}
                {(!isMobile || showMobileChat) && (
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            bgcolor: theme.palette.mode === "dark" ? "#181818" : "#F4F6F8",
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                bgcolor: "background.paper",
                                borderBottom: "1px solid",
                                borderColor: "divider",
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                            }}
                        >
                            {isMobile && (
                                <IconButton onClick={() => setShowMobileChat(false)} color="primary">
                                    <ArrowBackIcon />
                                </IconButton>
                            )}

                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
                                    {activeRoom?.room_type === "GENERAL" ? "📢 " : activeRoom?.room_type === "BOARD" ? "🔒 " : "👤 "}
                                    {activeRoom?.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {activeRoom?.room_type === "GENERAL"
                                        ? t("general_chat_desc")
                                        : activeRoom?.room_type === "BOARD"
                                            ? t("board_chat_desc")
                                            : "Direct 1-on-1 Conversation"}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ flex: 1, p: { xs: 1.5, sm: 3 }, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                            {loadingMessages ? (
                                <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                                    <CircularProgress size={36} />
                                </Box>
                            ) : messages.length === 0 ? (
                                <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
                                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                        No messages here yet
                                    </Typography>
                                    <Typography variant="body2">Send the first message to start the conversation!</Typography>
                                </Box>
                            ) : (
                                messages.map((msg) => {
                                    const isMine =
                                        String(msg.sender_id).toLowerCase() === String(user?.user_id).toLowerCase();
                                    return (
                                        <Box
                                            key={msg.id}
                                            sx={{
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: isMine ? "flex-end" : "flex-start",
                                            }}
                                        >
                                            {!isMine && (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mb: 0.5, ml: 1 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: "text.primary", fontSize: "0.9rem" }}>
                                                        {msg.sender_name}
                                                    </Typography>
                                                    <Chip
                                                        label={msg.sender_role}
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ height: 18, fontSize: "0.7rem", fontWeight: "bold" }}
                                                    />
                                                </Box>
                                            )}

                                            <Paper
                                                elevation={2}
                                                sx={{
                                                    p: { xs: 1.5, sm: 2 },
                                                    maxWidth: { xs: "88%", sm: "70%" },
                                                    borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                                    bgcolor: isMine ? "primary.main" : "background.paper",
                                                    color: isMine ? "white" : "text.primary",
                                                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                                }}
                                            >
                                                <Typography
                                                    variant="body1"
                                                    sx={{
                                                        fontSize: "1.1rem",
                                                        lineHeight: 1.5,
                                                        wordBreak: "break-word",
                                                    }}
                                                >
                                                    {msg.content}
                                                </Typography>
                                                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontSize: "0.75rem",
                                                            color: isMine ? "grey.300" : "text.secondary",
                                                        }}
                                                    >
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    </Typography>
                                                </Box>
                                            </Paper>
                                        </Box>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        <Box
                            component="form"
                            onSubmit={handleSendMessage}
                            sx={{
                                p: { xs: 1.5, sm: 2 },
                                bgcolor: "background.paper",
                                borderTop: "1px solid",
                                borderColor: "divider",
                                display: "flex",
                                gap: 1.5,
                                alignItems: "center",
                            }}
                        >
                            <TextField
                                fullWidth
                                placeholder={t("type_message_placeholder")}
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                sx={{
                                    bgcolor: theme.palette.mode === "dark" ? "#242424" : "#F9FAFB",
                                    borderRadius: 3,
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: 3,
                                        fontSize: "1.05rem",
                                    },
                                }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={!messageInput.trim()}
                                endIcon={<SendIcon />}
                                sx={{
                                    minHeight: 52,
                                    px: { xs: 2, sm: 3 },
                                    borderRadius: 3,
                                    fontWeight: 800,
                                    fontSize: "1rem",
                                }}
                            >
                                {t("send_btn")}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Paper>

            <Dialog open={openUserList} onClose={() => setOpenUserList(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>👥 {t("start_chat_with")}</DialogTitle>
                <DialogContent sx={{ p: 1 }}>
                    <List>
                        {members.map((member) => (
                            <ListItemButton
                                key={member.id}
                                onClick={() => handleStartDirectChat(member.id)}
                                sx={{ borderRadius: 2, mb: 0.5 }}
                            >
                                <ListItemIcon>
                                    <PersonIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={<Typography sx={{ fontWeight: 700 }}>{member.full_name}</Typography>}
                                    secondary={member.role}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </DialogContent>
            </Dialog>
        </Container>
    );
};