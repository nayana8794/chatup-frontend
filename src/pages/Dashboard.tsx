// chatup/frontend/src/pages/Dashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Container,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    IconButton,
    Select,
    MenuItem,
    Tooltip,
    useMediaQuery,
    useTheme,
    Stack,
    Paper,
    Badge,
    Alert,
    Divider,
    BottomNavigation,
    BottomNavigationAction,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
} from "@mui/material";
import { ChatUpLogo, ChatUpTitle } from "../components/ChatUpLogo";
import PeopleIcon from "@mui/icons-material/People";
import ChatIcon from "@mui/icons-material/Chat";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import EventIcon from "@mui/icons-material/Event";
import DescriptionIcon from "@mui/icons-material/Description";
import PaymentsIcon from "@mui/icons-material/Payments";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpIcon from "@mui/icons-material/Help";
import CancelIcon from "@mui/icons-material/Cancel";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DirectionsIcon from "@mui/icons-material/Directions";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import BusinessIcon from "@mui/icons-material/Business";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import HomeIcon from "@mui/icons-material/Home";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import CloseIcon from "@mui/icons-material/Close";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import CardMembershipIcon from "@mui/icons-material/CardMembership";
import PaletteIcon from "@mui/icons-material/Palette";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useRealtime } from "../context/useRealtime";
import { MembersManagement } from "./MembersManagement";
import { SuperAdminConsole } from "./SuperAdminConsole";
import { MeetingMinutes } from "./MeetingMinutes";
import { Chat } from "./Chat";
import { Events } from "./Events";
import { MembershipDues } from "./MembershipDues";
import { SocialFeed } from "./SocialFeed";
import { Voting } from "./Voting";
import { Documents } from "./Documents";
import { Bookkeeping } from "./Bookkeeping";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { Calling } from "./Calling";
import { IncomingCallModal } from "../components/IncomingCallModal";
import { DigitalMembershipCardModal } from "../components/DigitalMembershipCardModal";
import { ClubBrandingModal } from "../components/ClubBrandingModal";
import apiClient from "../api/client";
import { playNotificationChime } from "../utils/sound";

interface DashboardEvent {
    id: string;
    title: string;
    start_time: string;
    location: string;
    event_type: string;
    allows_guests?: boolean;
    my_rsvp?: "GOING" | "MAYBE" | "DECLINED";
}

interface ClubStats {
    id: string;
    name: string;
    slug: string;
    district?: string;
    is_active: boolean;
    member_count: number;
}

interface ActiveCallInfo {
    is_active: boolean;
    room_id?: string;
    caller_name?: string;
    participant_count?: number;
    call_type: "video" | "audio";
}

const parseEventDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    return new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
};

export const Dashboard: React.FC = () => {
    const { t, i18n } = useTranslation();

    const { user, logout } = useAuth();
    const { mode, toggleColorMode, applyClubBranding } = useAppTheme();
    const theme = useTheme();

    const { totalUnread, pendingPollsCount, refreshPendingPolls, lastEvent } = useRealtime();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");
    const isOfficer = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "VICE_SECRETARY",
        "PLANNER",
        "VICE_PLANNER",
        "TREASURER",
    ].includes(user?.role || "");
    const isTreasurer = ["SUPER_ADMIN", "TREASURER", "VICE_TREASURER"].includes(user?.role || "");
    const hasFinancialManagement = isPresident || isTreasurer;

    const [currentView, setCurrentView] = useState<
        | "dashboard"
        | "members"
        | "admin"
        | "mom"
        | "chat"
        | "events"
        | "dues"
        | "calling"
        | "voting"
        | "documents"
        | "bookkeeping"
    >("dashboard");

    const [adminInitialTab, setAdminInitialTab] = useState<number>(0);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [openCardModal, setOpenCardModal] = useState(false);
    const [openBrandingModal, setOpenBrandingModal] = useState(false);

    const [callingRoomId, setCallingRoomId] = useState<string | undefined>(undefined);
    const [callingType, setCallingType] = useState<"video" | "audio">("video");
    const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);

    const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
    const [clubs, setClubs] = useState<ClubStats[]>([]);
    const [unpaidDuesCount, setUnpaidDuesCount] = useState(0);

    const checkActiveCall = useCallback(async () => {
        if (isSuperAdmin) return;
        try {
            const res = await apiClient.get<ActiveCallInfo>("/calling/active");
            setActiveCall(res.data);
        } catch {
            setActiveCall(null);
        }
    }, [isSuperAdmin]);

    const fetchDashboardData = useCallback(async () => {
        try {
            if (isSuperAdmin) {
                applyClubBranding(null, null, null);
                const res = await apiClient.get("/admin/clubs");
                setClubs(res.data);
            } else {
                const [evRes, duesRes, brandRes] = await Promise.all([
                    apiClient.get("/events"),
                    apiClient.get("/financial/dues"),
                    apiClient.get("/members/my-club/branding").catch(() => ({ data: { theme_config: {} } })),
                ]);
                const tc = brandRes.data?.theme_config || {};
                applyClubBranding(tc.primary_color, tc.secondary_color, tc.logo_url);

                const now = new Date();
                const futureEvents = evRes.data.filter((ev: any) => parseEventDate(ev.start_time) >= now);
                setUpcomingEvents(futureEvents);

                const unpaid = duesRes.data.filter(
                    (d: any) => d.user_id === user?.user_id && d.status === "PENDING"
                ).length;
                setUnpaidDuesCount(unpaid);
                refreshPendingPolls();
                checkActiveCall();
            }
        } catch { }
    }, [isSuperAdmin, user, refreshPendingPolls, checkActiveCall]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData, currentView]);

    useEffect(() => {
        if (
            lastEvent?.type === "CALL_STARTED" ||
            lastEvent?.type === "INCOMING_CALL" ||
            lastEvent?.type === "CALL_ENDED" ||
            lastEvent?.type === "CALL_DECLINED" ||
            lastEvent?.type === "MEETING_STARTED" ||
            lastEvent?.type === "MEETING_ENDED"
        ) {
            checkActiveCall();
        }

        if (
            lastEvent?.type === "EVENT_CREATED" ||
            lastEvent?.type === "EVENT_UPDATED" ||
            lastEvent?.type === "RSVP_UPDATED" ||
            lastEvent?.type === "EVENT_DELETED" ||
            lastEvent?.type === "DUES_GENERATED" ||
            lastEvent?.type === "DUES_PAID" ||
            lastEvent?.type === "POLL_CREATED" ||
            lastEvent?.type === "POLL_CLOSED" ||
            lastEvent?.type === "POLL_VOTED" ||
            lastEvent?.type === "DOCUMENT_UPLOADED" ||
            lastEvent?.type === "DOCUMENT_DELETED" ||
            lastEvent?.type === "FINANCIAL_SHEET_SUBMITTED" ||
            lastEvent?.type === "FINANCIAL_SHEET_APPROVED" ||
            lastEvent?.type === "FINANCIAL_SHEET_VOIDED"
        ) {
            if (
                lastEvent?.type === "EVENT_CREATED" ||
                lastEvent?.type === "DUES_GENERATED" ||
                lastEvent?.type === "POLL_CREATED" ||
                lastEvent?.type === "FINANCIAL_SHEET_SUBMITTED" ||
                lastEvent?.type === "FINANCIAL_SHEET_APPROVED"
            ) {
                playNotificationChime();
            }
            fetchDashboardData();
        }
    }, [lastEvent, fetchDashboardData, checkActiveCall]);

    const pendingInvitations = upcomingEvents.filter((ev) => !ev.my_rsvp);
    const confirmedEvents = upcomingEvents.filter(
        (ev) => ev.my_rsvp === "GOING" || ev.my_rsvp === "MAYBE"
    );
    const pendingRsvpCount = pendingInvitations.length;

    const handleQuickRSVP = async (eventId: string, status: "GOING" | "MAYBE" | "DECLINED") => {
        try {
            await apiClient.post(`/events/${eventId}/rsvp`, { status, guest_count: 0 });
            fetchDashboardData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAcceptIncomingCall = (roomId: string, callType?: "video" | "audio") => {
        const resolvedType = (callType || "video").toLowerCase() as "video" | "audio";
        setCallingRoomId(roomId);
        setCallingType(resolvedType);
        setCurrentView("calling");
    };

    const handleJoinLiveCall = () => {
        if (!activeCall) return;
        setCallingRoomId(activeCall.room_id);
        setCallingType(activeCall.call_type || "video");
        setCurrentView("calling");
    };

    const totalClubs = clubs.length;
    const activeClubs = clubs.filter((c) => c.is_active).length;
    const totalPlatformUsers = clubs.reduce((acc, c) => acc + (c.member_count || 0), 0);

    const renderSubPageWrapper = (component: React.ReactNode) => (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                color: "text.primary",
                pt: "max(12px, env(safe-area-inset-top, 0px))",
                pb: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 4,
            }}
        >
            {component}
        </Box>
    );

    if (currentView === "members") {
        return renderSubPageWrapper(<MembersManagement onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "admin") {
        return renderSubPageWrapper(
            <SuperAdminConsole
                onBack={() => setCurrentView("dashboard")}
                initialTab={adminInitialTab}
            />
        );
    }

    if (currentView === "mom") {
        return renderSubPageWrapper(<MeetingMinutes onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "chat") {
        return renderSubPageWrapper(<Chat onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "events") {
        return renderSubPageWrapper(<Events onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "dues") {
        return renderSubPageWrapper(<MembershipDues onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "voting") {
        return renderSubPageWrapper(<Voting onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "documents") {
        return renderSubPageWrapper(<Documents onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "bookkeeping") {
        return renderSubPageWrapper(<Bookkeeping onBack={() => setCurrentView("dashboard")} />);
    }

    if (currentView === "calling") {
        return (
            <Calling
                onBack={() => {
                    setCallingRoomId(undefined);
                    setCurrentView("dashboard");
                    checkActiveCall();
                }}
                initialRoomId={callingRoomId}
                initialCallType={callingType}
            />
        );
    }

    const clubModules = [
        {
            title: t("digital_card_btn", "Digital ID Card"),
            icon: <CardMembershipIcon sx={{ fontSize: 44, color: "#F2A900" }} />,
            show: !isSuperAdmin,
            onClick: () => setOpenCardModal(true),
        },
        {
            title: t("menu_members"),
            icon: <PeopleIcon sx={{ fontSize: 44, color: "#1976D2" }} />,
            show: isPresident,
            onClick: () => setCurrentView("members"),
        },
        {
            title: t("menu_chat"),
            icon: (
                <Badge badgeContent={totalUnread} color="error">
                    <ChatIcon sx={{ fontSize: 44, color: "primary.main" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("chat"),
        },
        {
            title: t("menu_voting"),
            icon: (
                <Badge badgeContent={pendingPollsCount} color="warning">
                    <HowToVoteIcon sx={{ fontSize: 44, color: "#002F6C" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("voting"),
        },
        {
            title: t("menu_events"),
            icon: (
                <Badge badgeContent={pendingRsvpCount} color="warning">
                    <EventIcon sx={{ fontSize: 44, color: "#E65100" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("events"),
        },
        {
            title: t("menu_mom"),
            icon: <DescriptionIcon sx={{ fontSize: 44, color: "#1565C0" }} />,
            show: true,
            onClick: () => setCurrentView("mom"),
        },
        {
            title: t("menu_dues"),
            icon: (
                <Badge badgeContent={unpaidDuesCount} color="error">
                    <PaymentsIcon sx={{ fontSize: 44, color: "#2E7D32" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("dues"),
        },
        {
            title: t("menu_documents"),
            icon: <FolderSharedIcon sx={{ fontSize: 44, color: "#002F6C" }} />,
            show: true,
            onClick: () => setCurrentView("documents"),
        },
        {
            title: t("menu_bookkeeping"),
            icon: <AccountBalanceWalletIcon sx={{ fontSize: 44, color: "#2E7D32" }} />,
            show: hasFinancialManagement,
            onClick: () => setCurrentView("bookkeeping"),
        },
        {
            title: t("club_branding", "Club Branding"),
            icon: <PaletteIcon sx={{ fontSize: 44, color: "#002F6C" }} />,
            show: !isSuperAdmin && isPresident,
            onClick: () => setOpenBrandingModal(true),
        },
        {
            title: isOfficer ? t("host_meeting_btn", "Host Virtual Meeting") : t("menu_calls", "Audio & Video Calls"),
            icon: <VideoCallIcon sx={{ fontSize: 44, color: "#2E7D32" }} />,
            show: isOfficer,
            onClick: () => {
                setCallingRoomId(undefined);
                setCallingType("video");
                setCurrentView("calling");
            },
        },
    ];

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                overflowX: "hidden",
                pb: isMobile ? "calc(70px + env(safe-area-inset-bottom, 0px))" : 5,
            }}
        >
            {/* Top App Bar */}
            <AppBar
                position="sticky"
                elevation={3}
                sx={{
                    top: 0,
                    zIndex: 1200,
                    bgcolor: mode === "light" ? "primary.main" : "#1E1E1E",
                    pt: "max(10px, env(safe-area-inset-top, 0px))",
                }}

            >
                <Toolbar
                    sx={{
                        justifyContent: "space-between",
                        px: { xs: 1.5, sm: 2.5 },
                        minHeight: { xs: 58, sm: 64 },
                        gap: 1,
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.8,
                            fontSize: { xs: "1.05rem", sm: "1.35rem" },
                            letterSpacing: 0.3,
                            color: "white",
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                            <ChatUpLogo size={32} useClubCrest={!isSuperAdmin} />
                            <ChatUpTitle color="white" />
                        </Box>
                        {isSuperAdmin && (
                            <Chip
                                label="Admin"
                                size="small"
                                sx={{ ml: 0.2, bgcolor: "#F2A900", color: "#000", fontWeight: 900, height: 20, fontSize: "0.7rem" }}
                            />
                        )}
                    </Typography>

                    <Stack direction="row" spacing={{ xs: 0.8, sm: 1.5 }} sx={{ alignItems: "center", flexShrink: 0 }}>
                        <Select
                            size="small"
                            value={i18n.language}
                            onChange={(e) => {
                                const lang = e.target.value;
                                i18n.changeLanguage(lang);
                                localStorage.setItem("chatup_lang", lang);
                            }}
                            sx={{
                                bgcolor: "background.paper",
                                borderRadius: 2,
                                fontSize: "0.82rem",
                                "& .MuiSelect-select": { py: 0.4, px: 0.8 },
                            }}
                        >
                            <MenuItem value="en">EN</MenuItem>
                            <MenuItem value="fi">FI</MenuItem>
                            <MenuItem value="sv">SV</MenuItem>
                        </Select>

                        <Tooltip title={mode === "dark" ? t("light_mode") : t("dark_mode")}>
                            <IconButton
                                onClick={toggleColorMode}
                                color="inherit"
                                size="small"
                                sx={{
                                    bgcolor: "rgba(255,255,255,0.12)",
                                    "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                                    p: 0.7,
                                }}
                            >
                                {mode === "dark" ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
                            </IconButton>
                        </Tooltip>

                        <Button
                            variant="contained"
                            color="error"
                            onClick={logout}
                            startIcon={<LogoutIcon />}
                            sx={{
                                fontWeight: 900,
                                borderRadius: 2.5,
                                height: 34,
                                minWidth: { xs: 40, sm: "auto" },
                                px: { xs: 1, sm: 2 },
                                fontSize: "0.85rem",
                                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.8 } },
                            }}
                        >
                            <Box sx={{ display: { xs: "none", sm: "inline" } }}>{t("logout")}</Box>
                        </Button>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Main Container */}
            <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
                {/* Welcome Profile Banner */}
                <Paper
                    elevation={2}
                    sx={{
                        p: { xs: 2.2, sm: 3 },
                        mb: 2.5,
                        borderRadius: 3.5,
                        bgcolor: "background.paper",
                        overflow: "hidden",
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.8 }}>
                        <Box sx={{ maxWidth: "100%" }}>
                            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.75rem" } }}>
                                {t("welcome")}, {user?.full_name}!
                            </Typography>
                            <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t("role")}:
                                </Typography>
                                <Chip
                                    label={isSuperAdmin ? t("platform_owner") : user?.role}
                                    color={isSuperAdmin ? "warning" : "primary"}
                                    size="small"
                                    sx={{
                                        fontWeight: "bold",
                                        fontSize: "0.8rem",
                                        maxWidth: "100%",
                                        height: "auto",
                                        py: 0.4,
                                        "& .MuiChip-label": { whiteSpace: "normal" },
                                    }}
                                />
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1.2,
                                alignItems: "center",
                                width: { xs: "100%", sm: "auto" },
                            }}
                        >
                            {!isSuperAdmin && (
                                <Button
                                    variant="contained"
                                    startIcon={<CardMembershipIcon />}
                                    onClick={() => setOpenCardModal(true)}
                                    sx={{
                                        bgcolor: "#F2A900",
                                        color: "#002F6C",
                                        fontWeight: 900,
                                        borderRadius: 2.5,
                                        px: 2,
                                        py: 0.9,
                                        textTransform: "none",
                                        boxShadow: "0 4px 12px rgba(242, 169, 0, 0.35)",
                                        "&:hover": { bgcolor: "#d99800" },
                                    }}
                                >
                                    {t("digital_card_btn", "Digital ID Card")}
                                </Button>
                            )}

                            {!isSuperAdmin && isPresident && (
                                <Button
                                    variant="outlined"
                                    startIcon={<PaletteIcon />}
                                    onClick={() => setOpenBrandingModal(true)}
                                    sx={{
                                        fontWeight: 800,
                                        borderRadius: 2.5,
                                        px: 2,
                                        py: 0.9,
                                        textTransform: "none",
                                        borderColor: "primary.main",
                                    }}
                                >
                                    {t("club_branding", "Club Branding")}
                                </Button>
                            )}

                            {isSuperAdmin && (
                                <Chip
                                    icon={<CloudDoneIcon sx={{ color: "success.main !important", flexShrink: 0 }} />}
                                    label={t("eu_cloud_info")}
                                    variant="outlined"
                                    sx={{
                                        fontWeight: 700,
                                        borderRadius: 2,
                                        maxWidth: "100%",
                                        height: "auto",
                                        py: 0.6,
                                        "& .MuiChip-label": {
                                            whiteSpace: "normal",
                                            overflowWrap: "break-word",
                                        },
                                    }}
                                />
                            )}
                        </Box>
                    </Box>
                </Paper>

                {/* ================= ULTRA-LUXURY ONGOING CALL RADAR INDICATOR (MOBILE & DESKTOP) ================= */}
                {activeCall?.is_active && !isSuperAdmin && (
                    <Box sx={{ mb: 3 }}>
                        <Card
                            elevation={6}
                            sx={{
                                borderRadius: 4,
                                background:
                                    mode === "dark"
                                        ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 78, 59, 0.35) 100%)"
                                        : "linear-gradient(135deg, #002F6C 0%, #001f4d 100%)",
                                border: "2px solid #10B981",
                                boxShadow: "0 14px 32px rgba(16, 185, 129, 0.28)",
                                color: "white",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            <CardActionArea onClick={handleJoinLiveCall} sx={{ p: { xs: 2.2, sm: 3 } }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 2,
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                        {/* Animated Pulsating Radar Ring */}
                                        <Box
                                            sx={{
                                                position: "relative",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                width: { xs: 54, sm: 62 },
                                                height: { xs: 54, sm: 62 },
                                                borderRadius: "50%",
                                                bgcolor: "#10B981",
                                                color: "white",
                                                animation: "radarPulse 2s infinite",
                                                "@keyframes radarPulse": {
                                                    "0%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.8)" },
                                                    "70%": { boxShadow: "0 0 0 16px rgba(16, 185, 129, 0)" },
                                                    "100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" },
                                                },
                                            }}
                                        >
                                            <VideoCallIcon sx={{ fontSize: { xs: 32, sm: 36 } }} />
                                        </Box>

                                        <Box>
                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                                                <Chip
                                                    label={t("live_meeting_badge", "LIVE NOW")}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: "#10B981",
                                                        color: "white",
                                                        fontWeight: 900,
                                                        fontSize: "0.72rem",
                                                        height: 22,
                                                        letterSpacing: 1,
                                                    }}
                                                />
                                                <Typography variant="caption" sx={{ color: "#F2A900", fontWeight: 800 }}>
                                                    • {t("club_meeting_active", "Virtual Club Meeting in Progress")}
                                                </Typography>
                                            </Stack>

                                            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                                                {activeCall.caller_name
                                                    ? `${activeCall.caller_name}'s Meeting Room`
                                                    : "Club Virtual Conference Hall"}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
                                                {t("click_to_join", "Tap to join your fellow Lions in the live video hall")}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Prominent Join Action */}
                                    <Button
                                        variant="contained"
                                        startIcon={<VideoCallIcon />}
                                        sx={{
                                            bgcolor: "#10B981",
                                            color: "white",
                                            fontWeight: 900,
                                            borderRadius: 3,
                                            px: 3,
                                            py: 1.2,
                                            fontSize: "0.95rem",
                                            textTransform: "none",
                                            boxShadow: "0 4px 14px rgba(16, 185, 129, 0.45)",
                                            "&:hover": { bgcolor: "#059669" },
                                        }}
                                    >
                                        {t("join_live_room", "Join Live Room")}
                                    </Button>
                                </Box>
                            </CardActionArea>
                        </Card>
                    </Box>
                )}

                {isSuperAdmin ? (
                    <Box>
                        {/* Super Admin KPI Cards */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                                gap: 2.5,
                                mb: 4,
                            }}
                        >
                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #002F6C" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("total_clubs")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "primary.main" }}>
                                        {totalClubs}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                        {t("active_clubs_count").replace("{count}", String(activeClubs))}
                                    </Typography>
                                </CardContent>
                            </Card>

                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #2E7D32" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("platform_members")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "success.main" }}>
                                        {totalPlatformUsers}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("nordics_text")}
                                    </Typography>
                                </CardContent>
                            </Card>

                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #C2185B" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("saas_subscriptions")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#C2185B" }}>
                                        100%
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("good_standing")}
                                    </Typography>
                                </CardContent>
                            </Card>

                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #E65100" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("system_engine")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#E65100" }}>
                                        {t("healthy_status")}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                        {t("websockets_synced")}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>

                        {/* Super Admin Action Cards */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                                gap: 3,
                                mb: 4,
                            }}
                        >
                            <Card
                                elevation={3}
                                sx={{
                                    borderRadius: 4,
                                    bgcolor: mode === "dark" ? "#1E1E1E" : "#F4F7FB",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    transition: "transform 0.2s, box-shadow 0.2s",
                                    "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                                }}
                            >
                                <CardActionArea
                                    onClick={() => {
                                        setAdminInitialTab(0);
                                        setCurrentView("admin");
                                    }}
                                    sx={{ p: 3.5 }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
                                        <AdminPanelSettingsIcon sx={{ fontSize: 60, color: "#C2185B" }} />
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                {t("super_admin_console_heading")}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {t("saas_management_tools")}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardActionArea>
                            </Card>

                            <Card
                                elevation={3}
                                sx={{
                                    borderRadius: 4,
                                    bgcolor: mode === "dark" ? "#1E1E1E" : "#F4F7FB",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    transition: "transform 0.2s, box-shadow 0.2s",
                                    "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                                }}
                            >
                                <CardActionArea
                                    onClick={() => {
                                        setAdminInitialTab(1);
                                        setCurrentView("admin");
                                    }}
                                    sx={{ p: 3.5 }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
                                        <BusinessIcon sx={{ fontSize: 60, color: "primary.main" }} />
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                {t("register_onboard_club")}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {t("register_club_desc")}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardActionArea>
                            </Card>
                        </Box>
                    </Box>
                ) : (
                    /* ================= CLUB COMMUNITY MEMBER DASHBOARD ================= */
                    <Box>
                        {/* Active Secret Ballot Alert Banner */}
                        {pendingPollsCount > 0 && (
                            <Alert
                                severity="info"
                                icon={<HowToVoteIcon fontSize="large" sx={{ color: "#002F6C" }} />}
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setCurrentView("voting")}
                                        sx={{ fontWeight: 900, bgcolor: "rgba(0, 47, 108, 0.1)" }}
                                    >
                                        {t("btn_submit_ballot")}
                                    </Button>
                                }
                                sx={{
                                    mb: 2.5,
                                    borderRadius: 3.5,
                                    boxShadow: 2,
                                    bgcolor: "rgba(0, 47, 108, 0.08)",
                                    border: "1.5px solid rgba(0, 47, 108, 0.25)",
                                    "& .MuiAlert-message": { fontSize: "1rem", fontWeight: 800, color: "#002F6C" },
                                }}
                            >
                                🗳️ {t("pending_rsvp_alert").replace("{count}", String(pendingPollsCount))}
                            </Alert>
                        )}

                        {/* Pending RSVP Alerts */}
                        {pendingRsvpCount > 0 && (
                            <Alert
                                severity="warning"
                                icon={<NotificationsActiveIcon fontSize="large" />}
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setCurrentView("events")}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        {t("view_all_events")}
                                    </Button>
                                }
                                sx={{
                                    mb: 3,
                                    borderRadius: 3,
                                    boxShadow: 2,
                                    "& .MuiAlert-message": { fontSize: "1.05rem", fontWeight: 700 },
                                }}
                            >
                                {t("pending_rsvp_alert").replace("{count}", String(pendingRsvpCount))}
                            </Alert>
                        )}

                        {/* Pending Invitations Quick RSVP */}
                        {pendingInvitations.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, mb: 1.5, color: "#E65100" }}>
                                    🔔 {t("pending_invitations_title")}
                                </Typography>
                                <Stack spacing={1.5}>
                                    {pendingInvitations.map((ev) => {
                                        const evDate = parseEventDate(ev.start_time);
                                        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                            ev.location
                                        )}`;

                                        return (
                                            <Card
                                                key={ev.id}
                                                elevation={3}
                                                sx={{
                                                    borderRadius: 3,
                                                    borderLeft: "6px solid #E65100",
                                                    bgcolor: mode === "dark" ? "#1E1E1E" : "#FFF9F4",
                                                }}
                                            >
                                                <CardContent sx={{ p: 2 }}>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            flexDirection: { xs: "column", sm: "row" },
                                                            justifyContent: "space-between",
                                                            alignItems: { xs: "stretch", sm: "center" },
                                                            gap: 2,
                                                        }}
                                                    >
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                                {ev.title}
                                                            </Typography>
                                                            <Stack direction="row" spacing={2} sx={{ mt: 0.5, color: "text.secondary", flexWrap: "wrap", gap: 1 }}>
                                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                    <AccessTimeIcon fontSize="small" />
                                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                        {evDate.toLocaleDateString()} • {evDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                    </Typography>
                                                                </Box>
                                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                    <LocationOnIcon fontSize="small" color="error" />
                                                                    <Typography variant="body2">{ev.location}</Typography>
                                                                </Box>
                                                                {ev.location && !ev.location.toLowerCase().includes("online") && (
                                                                    <Button
                                                                        size="small"
                                                                        variant="text"
                                                                        startIcon={<DirectionsIcon />}
                                                                        href={googleMapsUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        sx={{ fontWeight: 800, textTransform: "none", p: 0 }}
                                                                    >
                                                                        {t("drive_directions")}
                                                                    </Button>
                                                                )}
                                                            </Stack>
                                                        </Box>

                                                        <Stack direction="row" spacing={1}>
                                                            <Button
                                                                variant="contained"
                                                                color="success"
                                                                size="small"
                                                                startIcon={<CheckCircleIcon />}
                                                                onClick={() => {
                                                                    if (ev.allows_guests) {
                                                                        setCurrentView("events");
                                                                    } else {
                                                                        handleQuickRSVP(ev.id, "GOING");
                                                                    }
                                                                }}
                                                                sx={{ fontWeight: 800, minHeight: 38 }}
                                                            >
                                                                {t("rsvp_going")}
                                                            </Button>
                                                            <Button
                                                                variant="outlined"
                                                                color="warning"
                                                                size="small"
                                                                startIcon={<HelpIcon />}
                                                                onClick={() => handleQuickRSVP(ev.id, "MAYBE")}
                                                                sx={{ fontWeight: 800, minHeight: 38 }}
                                                            >
                                                                {t("rsvp_maybe")}
                                                            </Button>
                                                            <Button
                                                                variant="outlined"
                                                                color="error"
                                                                size="small"
                                                                startIcon={<CancelIcon />}
                                                                onClick={() => handleQuickRSVP(ev.id, "DECLINED")}
                                                                sx={{ fontWeight: 800, minHeight: 38 }}
                                                            >
                                                                {t("rsvp_declined")}
                                                            </Button>
                                                        </Stack>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </Stack>
                            </Box>
                        )}

                        {/* Confirmed Schedule Widget */}
                        {confirmedEvents.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, mb: 1.5, color: "success.main" }}>
                                    ✅ {t("confirmed_events_title")}
                                </Typography>
                                <Stack spacing={1.5}>
                                    {confirmedEvents.map((ev) => {
                                        const evDate = parseEventDate(ev.start_time);
                                        return (
                                            <Card key={ev.id} elevation={2} sx={{ borderRadius: 3, borderLeft: "6px solid #2E7D32" }}>
                                                <CardActionArea onClick={() => setCurrentView("events")} sx={{ p: 2 }}>
                                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <Box>
                                                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                                {ev.title}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {evDate.toLocaleDateString()} at {evDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {ev.location}
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            icon={<EventAvailableIcon />}
                                                            label={ev.my_rsvp === "GOING" ? t("rsvp_going") : t("rsvp_maybe")}
                                                            color={ev.my_rsvp === "GOING" ? "success" : "warning"}
                                                            sx={{ fontWeight: 800 }}
                                                        />
                                                    </Box>
                                                </CardActionArea>
                                            </Card>
                                        );
                                    })}
                                </Stack>
                            </Box>
                        )}

                        {/* Desktop Quick Access Modules Grid */}
                        {!isMobile && (
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: "text.primary" }}>
                                    🚀 {t("dashboard")}
                                </Typography>
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: { sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                                        gap: 2.5,
                                    }}
                                >
                                    {clubModules
                                        .filter((m) => m.show)
                                        .map((item, index) => (
                                            <Card
                                                key={index}
                                                elevation={2}
                                                sx={{
                                                    borderRadius: 3.5,
                                                    height: "100%",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    transition: "transform 0.2s, box-shadow 0.2s",
                                                    "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                                                }}
                                            >
                                                <CardActionArea
                                                    sx={{
                                                        p: { xs: 2, sm: 2.5, md: 3 },
                                                        textAlign: "center",
                                                        height: "100%",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        justifyContent: "center",
                                                    }}
                                                    onClick={item.onClick}
                                                >
                                                    <CardContent sx={{ p: 0, width: "100%" }}>
                                                        <Box sx={{ mb: 1.5, display: "flex", justifyContent: "center" }}>{item.icon}</Box>
                                                        <Typography
                                                            variant="subtitle1"
                                                            sx={{
                                                                fontWeight: 800,
                                                                fontSize: { xs: "0.95rem", sm: "1rem", md: "1.05rem" },
                                                                lineHeight: 1.35,
                                                                overflowWrap: "break-word",
                                                                wordBreak: "normal",
                                                                px: 0.5,
                                                            }}
                                                        >
                                                            {item.title}
                                                        </Typography>
                                                    </CardContent>
                                                </CardActionArea>
                                            </Card>
                                        ))}
                                </Box>
                                <Divider sx={{ my: 4 }} />
                            </Box>
                        )}

                        {/* Social Wall Stream */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                                📸 {t("community_feed_tab")}
                            </Typography>
                            <SocialFeed inline limit={isMobile ? 25 : 6} />
                        </Box>
                    </Box>
                )}
            </Container>

            {/* Mobile 5-Slot Luxury Bottom Navigation Bar */}
            {isMobile && !isSuperAdmin && (
                <Paper
                    elevation={16}
                    sx={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1100,
                        borderTop: "1px solid",
                        borderColor: mode === "light" ? "rgba(242, 169, 0, 0.35)" : "rgba(242, 169, 0, 0.2)",
                        pb: "max(10px, env(safe-area-inset-bottom, 0px))",
                        pt: 0.5,
                        bgcolor: mode === "light" ? "rgba(255, 255, 255, 0.92)" : "rgba(20, 20, 20, 0.92)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.08)",
                    }}
                >
                    <BottomNavigation
                        showLabels
                        value={
                            currentView === "dashboard"
                                ? 0
                                : currentView === "chat"
                                    ? 1
                                    : currentView === "voting"
                                        ? 2
                                        : currentView === "events"
                                            ? 3
                                            : 4
                        }
                        onChange={(_, val) => {
                            if (val === 0) setCurrentView("dashboard");
                            if (val === 1) setCurrentView("chat");
                            if (val === 2) setCurrentView("voting");
                            if (val === 3) setCurrentView("events");
                            if (val === 4) setMobileDrawerOpen(true);
                        }}
                        sx={{
                            height: 60,
                            bgcolor: "transparent",
                            "& .MuiBottomNavigationAction-root": {
                                minWidth: "auto",
                                px: 0.8,
                                py: 0.5,
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                color: mode === "light" ? "rgba(0, 47, 108, 0.65)" : "rgba(255, 255, 255, 0.6)",
                                "& .MuiSvgIcon-root": {
                                    fontSize: 24,
                                    transition: "transform 0.2s ease, color 0.2s ease",
                                },
                                "& .MuiBottomNavigationAction-label": {
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    letterSpacing: 0.2,
                                    mt: 0.3,
                                    whiteSpace: "nowrap",
                                },
                                "&.Mui-selected": {
                                    color: mode === "light" ? "#002F6C" : "#F2A900",
                                    "& .MuiSvgIcon-root": {
                                        transform: "scale(1.16)",
                                        color: mode === "light" ? "#002F6C" : "#F2A900",
                                    },
                                    "& .MuiBottomNavigationAction-label": {
                                        fontSize: "0.72rem",
                                        fontWeight: 900,
                                        letterSpacing: 0.3,
                                    },
                                },
                            },
                        }}
                    >
                        <BottomNavigationAction label={t("nav_home", "Home")} icon={<HomeIcon />} />
                        <BottomNavigationAction
                            label={t("nav_chat", "Chat")}
                            icon={
                                <Badge
                                    badgeContent={totalUnread}
                                    color="error"
                                    sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", height: 18, minWidth: 18, fontWeight: 900 } }}
                                >
                                    <ChatIcon />
                                </Badge>
                            }
                        />
                        <BottomNavigationAction
                            label={t("nav_vote", "Vote")}
                            icon={
                                <Badge
                                    badgeContent={pendingPollsCount}
                                    color="warning"
                                    sx={{
                                        "& .MuiBadge-badge": {
                                            fontSize: "0.65rem",
                                            height: 18,
                                            minWidth: 18,
                                            fontWeight: 900,
                                            bgcolor: "#F2A900",
                                            color: "#002F6C",
                                        },
                                    }}
                                >
                                    <HowToVoteIcon />
                                </Badge>
                            }
                        />
                        <BottomNavigationAction
                            label={t("nav_events", "Events")}
                            icon={
                                <Badge
                                    badgeContent={pendingRsvpCount}
                                    color="warning"
                                    sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", height: 18, minWidth: 18, fontWeight: 900 } }}
                                >
                                    <EventIcon />
                                </Badge>
                            }
                        />
                        <BottomNavigationAction
                            label={t("nav_more", "More")}
                            icon={
                                <Badge
                                    badgeContent={unpaidDuesCount}
                                    color="error"
                                    sx={{ "& .MuiBadge-badge": { fontSize: "0.65rem", height: 18, minWidth: 18, fontWeight: 900 } }}
                                >
                                    <MoreHorizIcon />
                                </Badge>
                            }
                        />
                    </BottomNavigation>
                </Paper>
            )}

            {/* Mobile Luxury "More •••" Action Hub Drawer */}
            <Drawer
                anchor="bottom"
                open={mobileDrawerOpen}
                onClose={() => setMobileDrawerOpen(false)}
                sx={{
                    zIndex: 1300,
                    "& .MuiDrawer-paper": {
                        borderTopLeftRadius: "24px",
                        borderTopRightRadius: "24px",
                        p: 2.5,
                        pb: "max(24px, env(safe-area-inset-bottom, 20px))",
                        bgcolor: mode === "light" ? "#F8FAFC" : "#1E1E1E",
                        maxHeight: "80vh",
                    },
                }}
            >
                <Box sx={{ width: 40, height: 4, bgcolor: "rgba(0,0,0,0.2)", borderRadius: 2, mx: "auto", mb: 2 }} />
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main", display: "flex", alignItems: "center", gap: 1 }}>
                        <ChatUpLogo size={30} useClubCrest /> <ChatUpTitle />
                    </Typography>
                    <IconButton size="small" onClick={() => setMobileDrawerOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </Stack>
                <Divider sx={{ mb: 1.5 }} />

                <List disablePadding>
                    {!isSuperAdmin && (
                        <ListItemButton
                            onClick={() => {
                                setMobileDrawerOpen(false);
                                setOpenCardModal(true);
                            }}
                            sx={{
                                py: 1.5,
                                borderRadius: 2.5,
                                mb: 1,
                                bgcolor: "rgba(242, 169, 0, 0.12)",
                                border: "1px solid rgba(242, 169, 0, 0.3)",
                            }}
                        >
                            <ListItemIcon>
                                <CardMembershipIcon sx={{ color: "#F2A900", fontSize: 28 }} />
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Typography sx={{ fontWeight: 900, color: mode === "dark" ? "#F2A900" : "#002F6C" }}>
                                        {t("digital_card_btn", "Digital ID Card")}
                                    </Typography>
                                }
                                secondary={t("digital_card_desc", "Apple/Google Wallet & Dynamic QR")}
                            />
                        </ListItemButton>
                    )}

                    {!isSuperAdmin && isPresident && (
                        <ListItemButton
                            onClick={() => {
                                setMobileDrawerOpen(false);
                                setOpenBrandingModal(true);
                            }}
                            sx={{ py: 1.5, borderRadius: 2.5, mb: 1, bgcolor: "background.paper" }}
                        >
                            <ListItemIcon><PaletteIcon sx={{ color: "#002F6C", fontSize: 28 }} /></ListItemIcon>
                            <ListItemText
                                primary={<Typography sx={{ fontWeight: 800 }}>{t("club_branding", "Club Branding")}</Typography>}
                                secondary={t("customize_crest_colors", "Customize crest and brand colors")}
                            />
                        </ListItemButton>
                    )}

                    <ListItemButton
                        onClick={() => {
                            setMobileDrawerOpen(false);
                            setCurrentView("documents");
                        }}
                        sx={{ py: 1.5, borderRadius: 2.5, mb: 1, bgcolor: "background.paper" }}
                    >
                        <ListItemIcon><FolderSharedIcon sx={{ color: "#002F6C", fontSize: 28 }} /></ListItemIcon>
                        <ListItemText
                            primary={<Typography sx={{ fontWeight: 800 }}>{t("menu_documents")}</Typography>}
                            secondary={t("cat_general")}
                        />
                    </ListItemButton>

                    <ListItemButton
                        onClick={() => {
                            setMobileDrawerOpen(false);
                            setCurrentView("mom");
                        }}
                        sx={{ py: 1.5, borderRadius: 2.5, mb: 1, bgcolor: "background.paper" }}
                    >
                        <ListItemIcon><DescriptionIcon sx={{ color: "#1565C0", fontSize: 28 }} /></ListItemIcon>
                        <ListItemText
                            primary={<Typography sx={{ fontWeight: 800 }}>{t("menu_mom")}</Typography>}
                            secondary={t("all_minutes")}
                        />
                    </ListItemButton>

                    <ListItemButton
                        onClick={() => {
                            setMobileDrawerOpen(false);
                            setCurrentView("dues");
                        }}
                        sx={{ py: 1.5, borderRadius: 2.5, mb: 1, bgcolor: "background.paper" }}
                    >
                        <ListItemIcon>
                            <Badge badgeContent={unpaidDuesCount} color="error">
                                <PaymentsIcon sx={{ color: "#2E7D32", fontSize: 28 }} />
                            </Badge>
                        </ListItemIcon>
                        <ListItemText
                            primary={<Typography sx={{ fontWeight: 800 }}>{t("menu_dues")}</Typography>}
                            secondary={t("bank_transfer_box_title")}
                        />
                    </ListItemButton>

                    {hasFinancialManagement && (
                        <ListItemButton
                            onClick={() => {
                                setMobileDrawerOpen(false);
                                setCurrentView("bookkeeping");
                            }}
                            sx={{ py: 1.5, borderRadius: 2.5, mb: 1, bgcolor: "background.paper" }}
                        >
                            <ListItemIcon><AccountBalanceWalletIcon sx={{ color: "#2E7D32", fontSize: 28 }} /></ListItemIcon>
                            <ListItemText
                                primary={<Typography sx={{ fontWeight: 800 }}>{t("menu_bookkeeping")}</Typography>}
                                secondary={t("ledger_tab")}
                            />
                        </ListItemButton>
                    )}

                    {isPresident && (
                        <ListItemButton
                            onClick={() => {
                                setMobileDrawerOpen(false);
                                setCurrentView("members");
                            }}
                            sx={{ py: 1.5, borderRadius: 2.5, mb: 1, bgcolor: "background.paper" }}
                        >
                            <ListItemIcon><PeopleIcon sx={{ color: "#1976D2", fontSize: 28 }} /></ListItemIcon>
                            <ListItemText
                                primary={<Typography sx={{ fontWeight: 800 }}>{t("menu_members")}</Typography>}
                                secondary={t("member_name")}
                            />
                        </ListItemButton>
                    )}

                    {isOfficer && (
                        <ListItemButton
                            onClick={() => {
                                setMobileDrawerOpen(false);
                                setCallingRoomId(undefined);
                                setCallingType("video");
                                setCurrentView("calling");
                            }}
                            sx={{ py: { xs: 1.2, sm: 1.5 }, borderRadius: 2.5, bgcolor: "background.paper" }}
                        >
                            <ListItemIcon><VideoCallIcon sx={{ color: "#2E7D32", fontSize: 28 }} /></ListItemIcon>
                            <ListItemText
                                primary={<Typography sx={{ fontWeight: 800 }}>{t("host_meeting_btn", "Host Virtual Meeting")}</Typography>}
                                secondary={t("calling_title")}
                            />
                        </ListItemButton>
                    )}
                </List>
            </Drawer>

            {/* Modals */}
            <DigitalMembershipCardModal open={openCardModal} onClose={() => setOpenCardModal(false)} />
            {!isSuperAdmin && isPresident && (
                <ClubBrandingModal
                    open={openBrandingModal}
                    onClose={() => setOpenBrandingModal(false)}
                    onSuccess={() => window.location.reload()}
                />
            )}
            <IncomingCallModal onAcceptCall={handleAcceptIncomingCall} />
            <ChangePasswordModal />
        </Box>
    );
};