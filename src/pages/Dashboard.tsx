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
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import ChatIcon from "@mui/icons-material/Chat";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import EventIcon from "@mui/icons-material/Event";
import DescriptionIcon from "@mui/icons-material/Description";
import PaymentsIcon from "@mui/icons-material/Payments";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LogoutIcon from "@mui/icons-material/Logout";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpIcon from "@mui/icons-material/Help";
import CancelIcon from "@mui/icons-material/Cancel";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import BusinessIcon from "@mui/icons-material/Business";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
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
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import apiClient from "../api/client";
import { Calling } from "./Calling";

interface DashboardEvent {
    id: string;
    title: string;
    start_time: string;
    location: string;
    event_type: string;
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
        "dashboard" | "members" | "admin" | "mom" | "chat" | "events" | "dues" | "calling"
    >("dashboard");

    const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
    const [clubs, setClubs] = useState<ClubStats[]>([]);

    // Unpaid Dues Count for current user
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
        } catch (err) {
            // Ignore
        }
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
            lastEvent?.type === "DUES_PAID"
        ) {
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
            await apiClient.post(`/events/${eventId}/rsvp`, { status });
            fetchDashboardData();
        } catch (err) {
            console.error(err);
        }
    };

    const totalClubs = clubs.length;
    const activeClubs = clubs.filter((c) => c.is_active).length;
    const totalPlatformUsers = clubs.reduce((acc, c) => acc + (c.member_count || 0), 0);

    if (currentView === "members") {
        return <MembersManagement onBack={() => setCurrentView("dashboard")} />;
    }

    if (currentView === "admin") {
        return <SuperAdminConsole onBack={() => setCurrentView("dashboard")} />;
    }

    if (currentView === "mom") {
        return <MeetingMinutes onBack={() => setCurrentView("dashboard")} />;
    }

    if (currentView === "chat") {
        return <Chat onBack={() => setCurrentView("dashboard")} />;
    }

    if (currentView === "events") {
        return <Events onBack={() => setCurrentView("dashboard")} />;
    }

    if (currentView === "dues") {
        return <MembershipDues onBack={() => setCurrentView("dashboard")} />;
    }

    if (currentView === "calling") {
        return <Calling onBack={() => setCurrentView("dashboard")} />;
    }

    const clubModules = [
        {
            title: t("menu_members"),
            icon: <PeopleIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#1976D2" }} />,
            show: isPresident,
            onClick: () => setCurrentView("members"),
        },
        {
            title: t("menu_chat"),
            icon: (
                <Badge badgeContent={totalUnread} color="error">
                    <ChatIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "primary.main" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("chat"),
        },
        {
            title: t("menu_events"),
            icon: (
                <Badge badgeContent={pendingRsvpCount} color="warning">
                    <EventIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#E65100" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("events"),
        },
        {
            title: t("menu_mom"),
            icon: <DescriptionIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#1565C0" }} />,
            show: true,
            onClick: () => setCurrentView("mom"),
        },
        {
            title: t("menu_dues"),
            icon: (
                <Badge badgeContent={unpaidDuesCount} color="error">
                    <PaymentsIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#2E7D32" }} />
                </Badge>
            ),
            show: true,
            onClick: () => setCurrentView("dues"),
        },
        {
            title: t("menu_calls"),
            icon: <VideoCallIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#2E7D32" }} />,
            show: true,
            onClick: () => setCurrentView("calling"), // Fixed: Calling පිටුවට මාරු වීම
        }
    ];

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", overflowX: "hidden" }}>
            {/* Top App Bar */}
            <AppBar position="sticky" elevation={2}>
                <Toolbar sx={{ justifyContent: "space-between", px: { xs: 1, sm: 2 }, minHeight: { xs: 56, sm: 64 } }}>
                    <Typography
                        variant="h6"
                        sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 0.5, fontSize: { xs: "1.1rem", sm: "1.3rem" } }}
                    >
                        🦁 ChatUp {isSuperAdmin && <Chip label={t("saas_console")} size="small" sx={{ ml: 1, bgcolor: "warning.main", color: "black", fontWeight: 800 }} />}
                    </Typography>

                    <Stack direction="row" spacing={{ xs: 0.5, sm: 1.5 }} sx={{ alignItems: "center" }}>
                        <Select
                            size="small"
                            value={i18n.language}
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
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

                        <Tooltip title={mode === "dark" ? t("light_mode") : t("dark_mode")}>
                            <IconButton onClick={toggleColorMode} color="inherit" size="small">
                                {mode === "dark" ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
                            </IconButton>
                        </Tooltip>

                        {isMobile ? (
                            <Tooltip title={t("logout")}>
                                <IconButton
                                    color="inherit"
                                    onClick={logout}
                                    sx={{ bgcolor: "error.main", color: "white", "&:hover": { bgcolor: "error.dark" }, p: 0.8 }}
                                >
                                    <LogoutIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<LogoutIcon />}
                                onClick={logout}
                                sx={{ fontWeight: "bold" }}
                            >
                                {t("logout")}
                            </Button>
                        )}
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Main Container */}
            <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, pb: 5, px: { xs: 2, sm: 3 } }}>
                {/* Welcome Header */}
                <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3, bgcolor: "background.paper" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.75rem" } }}>
                                {t("welcome")}, {user?.full_name}!
                            </Typography>
                            <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
                                <Typography variant="body2" color="text.secondary">
                                    {t("role")}:
                                </Typography>
                                <Chip
                                    label={isSuperAdmin ? t("platform_owner") : user?.role}
                                    color={isSuperAdmin ? "warning" : "primary"}
                                    size="small"
                                    sx={{ fontWeight: "bold", fontSize: "0.85rem" }}
                                />
                            </Box>
                        </Box>

                        {isSuperAdmin && (
                            <Chip
                                icon={<CloudDoneIcon sx={{ color: "success.main !important" }} />}
                                label={t("eu_cloud_info")}
                                variant="outlined"
                                sx={{ fontWeight: 700, borderRadius: 2 }}
                            />
                        )}
                    </Box>
                </Paper>

                {/* Super Admin Dashboard vs Club Member Dashboard */}
                {isSuperAdmin ? (
                    <Box>
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
                                        {t("active_clubs_count", { count: activeClubs })}
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

                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                            🛠️ {t("saas_management_tools")}
                        </Typography>

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
                                    transition: "transform 0.2s",
                                    "&:hover": { transform: "translateY(-4px)" },
                                }}
                            >
                                <CardActionArea onClick={() => setCurrentView("admin")} sx={{ p: 3.5 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
                                        <AdminPanelSettingsIcon sx={{ fontSize: 60, color: "#C2185B" }} />
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                {t("menu_super_admin")}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {t("login_subtitle")}
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
                                    transition: "transform 0.2s",
                                    "&:hover": { transform: "translateY(-4px)" },
                                }}
                            >
                                <CardActionArea onClick={() => setCurrentView("admin")} sx={{ p: 3.5 }}>
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

                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                            🏛️ {t("active_club_tenants")}
                        </Typography>

                        <Stack spacing={2}>
                            {clubs.map((c) => (
                                <Paper
                                    key={c.id}
                                    elevation={2}
                                    sx={{
                                        p: 2.5,
                                        borderRadius: 3,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 2,
                                    }}
                                >
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main" }}>
                                            🦁 {c.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Slug: <b>{c.slug}</b> {c.district && `• ${t("district")}: ${c.district}`}
                                        </Typography>
                                    </Box>

                                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                                        <Chip
                                            label={c.is_active ? t("active_status") : t("suspended_status")}
                                            color={c.is_active ? "success" : "error"}
                                            sx={{ fontWeight: 800 }}
                                        />
                                        <Chip label={`${c.member_count} Members`} variant="outlined" sx={{ fontWeight: 700 }} />
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => setCurrentView("admin")}
                                            sx={{ fontWeight: 800 }}
                                        >
                                            {t("configure")}
                                        </Button>
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    </Box>
                ) : (
                    <Box>
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

                        <Box sx={{ mb: 4 }}>
                            {pendingInvitations.length > 0 && (
                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, mb: 1.5, color: "#E65100" }}>
                                        🔔 {t("pending_invitations_title")}
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        {pendingInvitations.map((ev) => {
                                            const evDate = parseEventDate(ev.start_time);
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
                                                                <Stack direction="row" spacing={2} sx={{ mt: 0.5, color: "text.secondary" }}>
                                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                        <AccessTimeIcon fontSize="small" />
                                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                            {evDate.toLocaleDateString()} • {evDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                                        </Typography>
                                                                    </Box>
                                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                                        <LocationOnIcon fontSize="small" />
                                                                        <Typography variant="body2">{ev.location}</Typography>
                                                                    </Box>
                                                                </Stack>
                                                            </Box>

                                                            <Stack direction="row" spacing={1}>
                                                                <Button
                                                                    variant="contained"
                                                                    color="success"
                                                                    size="small"
                                                                    startIcon={<CheckCircleIcon />}
                                                                    onClick={() => handleQuickRSVP(ev.id, "GOING")}
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
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        {/* Club Modules */}
                        {isMobile ? (
                            <Stack spacing={1.5}>
                                {clubModules
                                    .filter((m) => m.show)
                                    .map((item, index) => (
                                        <Card
                                            key={index}
                                            elevation={2}
                                            sx={{
                                                borderRadius: 3,
                                                border: "1px solid",
                                                borderColor: "divider",
                                                transition: "transform 0.15s",
                                                "&:active": { transform: "scale(0.98)" },
                                            }}
                                        >
                                            <CardActionArea
                                                onClick={item.onClick}
                                                sx={{
                                                    p: 2,
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    minHeight: 72,
                                                }}
                                            >
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center" }}>{item.icon}</Box>
                                                    <Typography variant="body1" sx={{ fontWeight: "bold", fontSize: "1.05rem", color: "text.primary" }}>
                                                        {item.title}
                                                    </Typography>
                                                </Box>
                                                <ChevronRightIcon color="action" />
                                            </CardActionArea>
                                        </Card>
                                    ))}
                            </Stack>
                        ) : (
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: {
                                        sm: "repeat(2, 1fr)",
                                        md: "repeat(3, 1fr)",
                                    },
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
                                                borderRadius: 3,
                                                transition: "transform 0.2s, box-shadow 0.2s",
                                                "&:hover": { transform: "translateY(-4px)" },
                                            }}
                                        >
                                            <CardActionArea sx={{ p: 4, textAlign: "center", minHeight: 180 }} onClick={item.onClick}>
                                                <CardContent>
                                                    <Box sx={{ mb: 2 }}>{item.icon}</Box>
                                                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                                        {item.title}
                                                    </Typography>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    ))}
                            </Box>
                        )}
                    </Box>
                )}
            </Container>

            <ChangePasswordModal />
        </Box>
    );
};