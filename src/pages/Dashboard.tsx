// chatup/frontend/src/pages/Dashboard.tsx
import React, { useState } from "react";
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
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useRealtime } from "../context/useRealtime";
import { MembersManagement } from "./MembersManagement";
import { SuperAdminConsole } from "./SuperAdminConsole";
import { MeetingMinutes } from "./MeetingMinutes";
import { Chat } from "./Chat";
import { ChangePasswordModal } from "../components/ChangePasswordModal";

export const Dashboard: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { mode, toggleColorMode } = useAppTheme();
    const theme = useTheme();

    // Global Realtime Context එකෙන් Live Unread Count එක ලබා ගැනීම
    const { totalUnread } = useRealtime();

    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [currentView, setCurrentView] = useState<"dashboard" | "members" | "admin" | "mom" | "chat">("dashboard");

    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");
    const isTreasurer = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "TREASURER",
        "VICE_TREASURER",
    ].includes(user?.role || "");

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

    const modules = [
        {
            title: t("menu_super_admin"),
            icon: <AdminPanelSettingsIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#C2185B" }} />,
            show: isSuperAdmin,
            onClick: () => setCurrentView("admin"),
        },
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
            title: t("menu_mom"),
            icon: <DescriptionIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#1565C0" }} />,
            show: true,
            onClick: () => setCurrentView("mom"),
        },
        {
            title: t("menu_calls"),
            icon: <VideoCallIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#2E7D32" }} />,
            show: true,
            onClick: () => { },
        },
        {
            title: t("menu_events"),
            icon: <EventIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#E65100" }} />,
            show: true,
            onClick: () => { },
        },
        {
            title: t("menu_dues"),
            icon: <PaymentsIcon sx={{ fontSize: { xs: 36, sm: 48 }, color: "#2E7D32" }} />,
            show: isTreasurer,
            onClick: () => { },
        },
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
                        🦁 ChatUp
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
                <Paper
                    elevation={2}
                    sx={{
                        p: { xs: 2, sm: 3 },
                        mb: 3,
                        borderRadius: 3,
                        bgcolor: "background.paper",
                    }}
                >
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 800,
                            fontSize: { xs: "1.25rem", sm: "1.75rem" },
                            lineHeight: 1.3,
                        }}
                    >
                        {t("welcome")}, {user?.full_name}!
                    </Typography>
                    <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
                        <Typography variant="body2" color="text.secondary">
                            {t("role")}:
                        </Typography>
                        <Chip
                            label={user?.role}
                            color="primary"
                            size="small"
                            sx={{ fontWeight: "bold", fontSize: "0.85rem" }}
                        />
                    </Box>
                </Paper>

                {/* Adaptive Action Cards */}
                {isMobile ? (
                    <Stack spacing={1.5}>
                        {modules
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
                                            <Typography
                                                variant="body1"
                                                sx={{ fontWeight: "bold", fontSize: "1.05rem", color: "text.primary" }}
                                            >
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
                        {modules
                            .filter((m) => m.show)
                            .map((item, index) => (
                                <Card
                                    key={index}
                                    elevation={2}
                                    sx={{
                                        borderRadius: 3,
                                        transition: "transform 0.2s, box-shadow 0.2s",
                                        "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                                    }}
                                >
                                    <CardActionArea
                                        sx={{ p: 4, textAlign: "center", minHeight: 180 }}
                                        onClick={item.onClick}
                                    >
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
            </Container>

            {/* Force Change Password Modal */}
            <ChangePasswordModal />
        </Box>
    );
};