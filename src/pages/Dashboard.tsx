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
} from "@mui/material";
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
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import HomeIcon from "@mui/icons-material/Home";
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
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { Calling } from "./Calling";
import { IncomingCallModal } from "../components/IncomingCallModal";
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

const parseEventDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    return new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
};

export const Dashboard: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { mode, toggleColorMode } = useAppTheme();
    const theme = useTheme();

    const { totalUnread, lastEvent } = useRealtime();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");

    const [currentView, setCurrentView] = useState<
        "dashboard" | "members" | "admin" | "mom" | "chat" | "events" | "dues" | "calling" | "voting"
    >("dashboard");

    // Tracks which tab to open in SuperAdminConsole (0: Directory, 1: Onboard Studio)
    const [adminInitialTab, setAdminInitialTab] = useState<number>(0);

    const [callingRoomId, setCallingRoomId] = useState<string | undefined>(undefined);
    const [callingType, setCallingType] = useState<"video" | "audio">("video");

    const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
    const [clubs, setClubs] = useState<ClubStats[]>([]);
    const [unpaidDuesCount, setUnpaidDuesCount] = useState(0);

    const fetchDashboardData = useCallback(async () => {
        try {
            if (isSuperAdmin) {
                const res = await apiClient.get("/admin/clubs");
                setClubs(res.data);
            } else {
                const [evRes, duesRes] = await Promise.all([
                    apiClient.get("/events"),
                    apiClient.get("/financial/dues"),
                ]);

                const now = new Date();
                const futureEvents = evRes.data.filter((ev: any) => parseEventDate(ev.start_time) >= now);
                setUpcomingEvents(futureEvents);

                const unpaid = duesRes.data.filter(
                    (d: any) => d.user_id === user?.user_id && d.status === "PENDING"
                ).length;
                setUnpaidDuesCount(unpaid);
            }
        } catch { }
    }, [isSuperAdmin, user]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData, currentView]);

    useEffect(() => {
        if (
            lastEvent?.type === "EVENT_CREATED" ||
            lastEvent?.type === "EVENT_UPDATED" ||
            lastEvent?.type === "RSVP_UPDATED" ||
            lastEvent?.type === "EVENT_DELETED" ||
            lastEvent?.type === "DUES_GENERATED" ||
            lastEvent?.type === "DUES_PAID" ||
            lastEvent?.type === "POLL_CREATED" ||
            lastEvent?.type === "POLL_CLOSED"
        ) {
            if (
                lastEvent?.type === "EVENT_CREATED" ||
                lastEvent?.type === "DUES_GENERATED" ||
                lastEvent?.type === "POLL_CREATED"
            ) {
                playNotificationChime();
            }
            fetchDashboardData();
        }
    }, [lastEvent, fetchDashboardData]);

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

    if (currentView === "calling") {
        return (
            <Calling
                onBack={() => {
                    setCallingRoomId(undefined);
                    setCurrentView("dashboard");
                }}
                initialRoomId={callingRoomId}
                initialCallType={callingType}
            />
        );
    }

    const clubModules = [
        {
            title: t("menu_members", "Members Directory"),
            icon: <PeopleIcon sx={{ fontSize: 44, color: "#1976D2" }} />,
            show: isPresident,
            onClick: () => setCurrentView("members"),
        },
        {
            title: t("menu_chat", "Club Chat"),
            icon: (
                <Badge badgeContent={totalUnread} color="error">
                    <ChatIcon sx={{ fontSize: 44, color: "primary.main" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("chat"),
        },
        {
            title: t("menu_events", "Calendar & Events"),
            icon: (
                <Badge badgeContent={pendingRsvpCount} color="warning">
                    <EventIcon sx={{ fontSize: 44, color: "#E65100" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("events"),
        },
        {
            title: t("menu_mom", "Meeting Minutes"),
            icon: <DescriptionIcon sx={{ fontSize: 44, color: "#1565C0" }} />,
            show: true,
            onClick: () => setCurrentView("mom"),
        },
        {
            title: t("menu_dues", "Membership Dues"),
            icon: (
                <Badge badgeContent={unpaidDuesCount} color="error">
                    <PaymentsIcon sx={{ fontSize: 44, color: "#2E7D32" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("dues"),
        },
        {
            title: t("menu_voting", "Secret Voting"),
            icon: <HowToVoteIcon sx={{ fontSize: 44, color: "#002F6C" }} />,
            show: true,
            onClick: () => setCurrentView("voting"),
        },
        {
            title: t("menu_calls", "Video Meetings"),
            icon: <VideoCallIcon sx={{ fontSize: 44, color: "#2E7D32" }} />,
            show: true,
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
                    bgcolor: mode === "light" ? "#002F6C" : "#1E1E1E",
                    pt: "max(10px, env(safe-area-inset-top, 0px))",
                }}
            >
                <Toolbar
                    sx={{
                        justifyContent: "space-between",
                        px: { xs: 1.5, sm: 2.5 },
                        minHeight: { xs: 58, sm: 64 },
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.8,
                            fontSize: { xs: "1.15rem", sm: "1.35rem" },
                            letterSpacing: 0.5,
                            color: "white",
                        }}
                    >
                        🦁 ChatUp
                        {isSuperAdmin && (
                            <Chip
                                label="Admin"
                                size="small"
                                sx={{ ml: 0.5, bgcolor: "#F2A900", color: "#000", fontWeight: 900, height: 20 }}
                            />
                        )}
                    </Typography>

                    <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} sx={{ alignItems: "center" }}>
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
                                fontSize: "0.85rem",
                                "& .MuiSelect-select": { py: 0.5, px: 1 },
                            }}
                        >
                            <MenuItem value="en">EN</MenuItem>
                            <MenuItem value="fi">FI</MenuItem>
                            <MenuItem value="sv">SV</MenuItem>
                        </Select>

                        <Tooltip title={mode === "dark" ? t("light_mode", "Light Mode") : t("dark_mode", "Dark Mode")}>
                            <IconButton
                                onClick={toggleColorMode}
                                color="inherit"
                                size="small"
                                sx={{
                                    bgcolor: "rgba(255,255,255,0.12)",
                                    "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                                    p: 0.8,
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
                                height: 36,
                                px: { xs: 1.2, sm: 2 },
                                fontSize: "0.85rem",
                                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.8 } },
                            }}
                        >
                            <Box sx={{ display: { xs: "none", sm: "inline" } }}>{t("logout", "Log Out")}</Box>
                        </Button>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Main Container */}
            <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
                <Paper
                    elevation={2}
                    sx={{
                        p: { xs: 2.2, sm: 3 },
                        mb: 2.5,
                        borderRadius: 3.5,
                        bgcolor: "background.paper",
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.75rem" } }}>
                                {t("welcome", "Welcome back")}, {user?.full_name}!
                            </Typography>
                            <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t("role", "Role")}:
                                </Typography>
                                <Chip
                                    label={isSuperAdmin ? "PLATFORM OWNER" : user?.role}
                                    color={isSuperAdmin ? "warning" : "primary"}
                                    size="small"
                                    sx={{ fontWeight: "bold", fontSize: "0.85rem" }}
                                />
                            </Box>
                        </Box>

                        {isSuperAdmin && (
                            <Chip
                                icon={<CloudDoneIcon sx={{ color: "success.main !important" }} />}
                                label="EU Cloud • Helsinki (GDPR Compliant)"
                                variant="outlined"
                                sx={{ fontWeight: 700, borderRadius: 2 }}
                            />
                        )}
                    </Box>
                </Paper>

                {/* Mobile View: Live Conference Card */}
                {isMobile && !isSuperAdmin && (
                    <Box sx={{ mb: 3 }}>
                        <Card
                            elevation={4}
                            sx={{
                                borderRadius: 3.5,
                                background: mode === "dark"
                                    ? "linear-gradient(135deg, #001A3D 0%, #002F6C 100%)"
                                    : "linear-gradient(135deg, #002F6C 0%, #064595 100%)",
                                border: "1.5px solid rgba(242, 169, 0, 0.45)",
                                color: "white",
                                transition: "transform 0.18s, box-shadow 0.18s",
                                "&:active": { transform: "scale(0.985)" },
                            }}
                        >
                            <CardActionArea
                                onClick={() => {
                                    setCallingRoomId(undefined);
                                    setCallingType("video");
                                    setCurrentView("calling");
                                }}
                                sx={{ p: 2 }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.8 }}>
                                        <Box
                                            sx={{
                                                width: 50,
                                                height: 50,
                                                borderRadius: "14px",
                                                bgcolor: "rgba(242, 169, 0, 0.18)",
                                                border: "1.5px solid #F2A900",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#F2A900",
                                                boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                                            }}
                                        >
                                            <VideoCallIcon sx={{ fontSize: 30 }} />
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.25, color: "white" }}>
                                                {t("menu_calls", "Live Video Conference")}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.78)", fontWeight: 600 }}>
                                                {isPresident ? t("host_calls_desc", "Host or ring all club members") : t("connect_calls_desc", "Connect live with club members")}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <ArrowForwardIosIcon sx={{ color: "#F2A900", fontSize: 16, mr: 0.5 }} />
                                </Box>
                            </CardActionArea>
                        </Card>

                        {isPresident && (
                            <Button
                                fullWidth
                                variant="outlined"
                                color="primary"
                                startIcon={<PeopleIcon />}
                                onClick={() => setCurrentView("members")}
                                sx={{
                                    mt: 1.5,
                                    fontWeight: 800,
                                    minHeight: 46,
                                    borderRadius: 3,
                                    fontSize: "0.92rem",
                                }}
                            >
                                {t("menu_members", "Manage Members")}
                            </Button>
                        )}
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
                                        {t("total_clubs_label", "Total Clubs (Tenants)")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "primary.main" }}>
                                        {totalClubs}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                        {activeClubs} {t("active_status", "Active Clubs")}
                                    </Typography>
                                </CardContent>
                            </Card>

                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #2E7D32" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("kpi_total_members", "Platform Members")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "success.main" }}>
                                        {totalPlatformUsers}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("across_nordics", "Across Europe / Nordics")}
                                    </Typography>
                                </CardContent>
                            </Card>

                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #C2185B" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("saas_subscriptions_label", "SaaS Subscriptions")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#C2185B" }}>
                                        100%
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t("accounts_standing", "All accounts in good standing")}
                                    </Typography>
                                </CardContent>
                            </Card>

                            <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #E65100" }}>
                                <CardContent sx={{ p: 2.5 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {t("system_engine_label", "System Engine")}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#E65100" }}>
                                        Healthy
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                        WebSockets Live & Synced
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>

                        {/* Super Admin Action Cards: Dedicated Tabbed Routing */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                                gap: 3,
                                mb: 4,
                            }}
                        >
                            {/* Card 1: Navigates strictly to Tab 0 (Club Directory & Governance) */}
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
                                                {t("super_admin_console_heading", "Super Admin SaaS Console")}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {t("manage_clubs_desc", "Manage Club subscriptions, member limits, and activate/deactivate individual features per club.")}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardActionArea>
                            </Card>

                            {/* Card 2: Navigates strictly to Tab 1 (Register & Onboard New Club) */}
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
                                                {t("tab_onboard", "Register & Onboard New Club")}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {t("onboard_card_desc", "Create new tenant workspace, configure district, and set initial Lions Club branding.")}
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
                                        {t("view_all_events", "View All Events")}
                                    </Button>
                                }
                                sx={{
                                    mb: 3,
                                    borderRadius: 3,
                                    boxShadow: 2,
                                    "& .MuiAlert-message": { fontSize: "1.05rem", fontWeight: 700 },
                                }}
                            >
                                {t("pending_rsvp_alert", "You have {count} pending event invitations requiring your response.").replace("{count}", String(pendingRsvpCount))}
                            </Alert>
                        )}

                        {/* Pending Invitations Quick RSVP */}
                        {pendingInvitations.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, mb: 1.5, color: "#E65100" }}>
                                    🔔 {t("pending_invitations_title", "Pending Event Invitations")}
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
                                                                        Map
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
                                                                {t("rsvp_going", "Going")}
                                                            </Button>
                                                            <Button
                                                                variant="outlined"
                                                                color="warning"
                                                                size="small"
                                                                startIcon={<HelpIcon />}
                                                                onClick={() => handleQuickRSVP(ev.id, "MAYBE")}
                                                                sx={{ fontWeight: 800, minHeight: 38 }}
                                                            >
                                                                {t("rsvp_maybe", "Maybe")}
                                                            </Button>
                                                            <Button
                                                                variant="outlined"
                                                                color="error"
                                                                size="small"
                                                                startIcon={<CancelIcon />}
                                                                onClick={() => handleQuickRSVP(ev.id, "DECLINED")}
                                                                sx={{ fontWeight: 800, minHeight: 38 }}
                                                            >
                                                                {t("rsvp_declined", "Declined")}
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
                                    ✅ {t("confirmed_events_title", "Confirmed Upcoming Schedule")}
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
                                                            label={ev.my_rsvp === "GOING" ? t("rsvp_going", "Going") : t("rsvp_maybe", "Maybe")}
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

                        {/* Desktop Only Quick Access Modules */}
                        {!isMobile && (
                            <Box sx={{ mb: 4 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: "text.primary" }}>
                                    🚀 {t("club_quick_access", "Club Quick Access Modules")}
                                </Typography>
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: { sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" },
                                        gap: 3,
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
                                                    transition: "transform 0.2s, box-shadow 0.2s",
                                                    "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                                                }}
                                            >
                                                <CardActionArea sx={{ p: 3, textAlign: "center", minHeight: 150 }} onClick={item.onClick}>
                                                    <CardContent>
                                                        <Box sx={{ mb: 1.5 }}>{item.icon}</Box>
                                                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
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
                                📸 {isMobile ? t("club_community_wall", "Club Community Wall") : t("recent_community_posts", "Recent Community Posts")}
                            </Typography>
                            <SocialFeed inline limit={isMobile ? 25 : 6} />
                        </Box>
                    </Box>
                )}
            </Container>

            {/* Mobile Bottom Navigation Bar */}
            {isMobile && !isSuperAdmin && (
                <Paper
                    elevation={8}
                    sx={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1100,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        pb: "max(8px, env(safe-area-inset-bottom, 0px))",
                        bgcolor: mode === "light" ? "#FFFFFF" : "#1A1A1A",
                    }}
                >
                    <BottomNavigation
                        showLabels
                        value={
                            currentView === "dashboard"
                                ? 0
                                : currentView === "chat"
                                    ? 1
                                    : currentView === "events"
                                        ? 2
                                        : currentView === "mom"
                                            ? 3
                                            : currentView === "dues"
                                                ? 4
                                                : 0
                        }
                        onChange={(_, val) => {
                            if (val === 0) setCurrentView("dashboard");
                            if (val === 1) setCurrentView("chat");
                            if (val === 2) setCurrentView("events");
                            if (val === 3) setCurrentView("mom");
                            if (val === 4) setCurrentView("dues");
                        }}
                        sx={{ height: 62 }}
                    >
                        <BottomNavigationAction label={t("nav_home", "Home")} icon={<HomeIcon />} />
                        <BottomNavigationAction
                            label={t("nav_chat", "Chat")}
                            icon={
                                <Badge badgeContent={totalUnread} color="error">
                                    <ChatIcon />
                                </Badge>
                            }
                        />
                        <BottomNavigationAction
                            label={t("nav_events", "Events")}
                            icon={
                                <Badge badgeContent={pendingRsvpCount} color="warning">
                                    <EventIcon />
                                </Badge>
                            }
                        />
                        <BottomNavigationAction label={t("nav_minutes", "Minutes")} icon={<DescriptionIcon />} />
                        <BottomNavigationAction
                            label={t("nav_dues", "Dues")}
                            icon={
                                <Badge badgeContent={unpaidDuesCount} color="error">
                                    <PaymentsIcon />
                                </Badge>
                            }
                        />
                    </BottomNavigation>
                </Paper>
            )}

            <IncomingCallModal onAcceptCall={handleAcceptIncomingCall} />
            <ChangePasswordModal />
        </Box>
    );
};