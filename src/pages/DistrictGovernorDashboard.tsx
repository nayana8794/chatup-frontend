// chatup/frontend/src/pages/DistrictGovernorDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Stack,
    Chip,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Paper,
    AppBar,
    Toolbar,
    Select,
    MenuItem,
    Tooltip,
    IconButton,
    Divider,
    LinearProgress,
    Avatar,
    InputAdornment,
    FormControl,
} from "@mui/material";
import DomainIcon from "@mui/icons-material/Domain";
import PeopleIcon from "@mui/icons-material/People";
import CampaignIcon from "@mui/icons-material/Campaign";
import EventIcon from "@mui/icons-material/Event";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LogoutIcon from "@mui/icons-material/Logout";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import VerifiedIcon from "@mui/icons-material/Verified";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/ThemeContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";

interface RegionalOverview {
    district_name: string;
    governor_name: string;
    total_district_clubs: number;
    active_district_clubs: number;
    total_regional_members: number;
    total_club_presidents: number;
    circulars_issued_count: number;
}

interface DistrictClub {
    id: string;
    name: string;
    slug: string;
    district: string;
    is_active: boolean;
    member_count: number;
    president_name?: string;
    president_email?: string;
    president_phone?: string;
}

interface CircularDoc {
    id: string;
    title: string;
    description?: string;
    file_url: string;
    file_name: string;
    file_size_bytes: number;
    created_at: string;
}

interface CredentialsInfo {
    club_name: string;
    president_name: string;
    email: string;
    temp_password: string;
}

export const DistrictGovernorDashboard: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { mode, toggleColorMode } = useAppTheme();
    const { lastEvent } = useRealtime();

    const [tabIndex, setTabIndex] = useState(0); // 0: Clubs Roster, 1: Circulars Archive, 2: District Events
    const [overview, setOverview] = useState<RegionalOverview | null>(null);
    const [clubs, setClubs] = useState<DistrictClub[]>([]);
    const [circulars, setCirculars] = useState<CircularDoc[]>([]);
    const [loading, setLoading] = useState(true);

    // Search and Status Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Onboard Club Dialog
    const [openClubModal, setOpenClubModal] = useState(false);
    const [newClubName, setNewClubName] = useState("");
    const [newClubSlug, setNewClubSlug] = useState("");
    const [newPresName, setNewPresName] = useState("");
    const [newPresEmail, setNewPresEmail] = useState("");
    const [newPresPhone, setNewPresPhone] = useState("");
    const [onboardingClub, setOnboardingClub] = useState(false);
    const [onboardError, setOnboardError] = useState("");

    // Assign President to Unassigned Club Dialog
    const [assignTargetClub, setAssignTargetClub] = useState<DistrictClub | null>(null);
    const [assignPresName, setAssignPresName] = useState("");
    const [assignPresEmail, setAssignPresEmail] = useState("");
    const [assignPresPhone, setAssignPresPhone] = useState("");
    const [assigningPres, setAssigningPres] = useState(false);

    // Credentials Modal
    const [credentials, setCredentials] = useState<CredentialsInfo | null>(null);
    const [copied, setCopied] = useState(false);

    // Broadcast Circular Dialog
    const [openCircularModal, setOpenCircularModal] = useState(false);
    const [circularTitle, setCircularTitle] = useState("");
    const [circularDesc, setCircularDesc] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastSuccess, setBroadcastSuccess] = useState("");

    // Schedule Convention Dialog
    const [openEventModal, setOpenEventModal] = useState(false);
    const [eventTitle, setEventTitle] = useState("");
    const [eventDesc, setEventDesc] = useState("");
    const [eventStart, setEventStart] = useState("");
    const [eventLocation, setEventLocation] = useState("");
    const [scheduling, setScheduling] = useState(false);

    const fetchGovernorData = useCallback(async () => {
        try {
            setLoading(true);
            const [ovRes, clubsRes, circRes] = await Promise.all([
                apiClient.get<RegionalOverview>("/governor/overview"),
                apiClient.get<DistrictClub[]>("/governor/clubs"),
                apiClient.get<CircularDoc[]>("/documents?category=DISTRICT").catch(() => ({ data: [] })),
            ]);
            setOverview(ovRes.data);
            setClubs(clubsRes.data);
            setCirculars(circRes.data);
        } catch (err) {
            console.error("Failed to load governor telemetry:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGovernorData();
    }, [fetchGovernorData]);

    // Live WebSockets Sync
    useEffect(() => {
        if (
            lastEvent?.type === "PLATFORM_UPDATE" ||
            lastEvent?.type === "DOCUMENT_UPLOADED" ||
            lastEvent?.type === "EVENT_CREATED"
        ) {
            fetchGovernorData();
        }
    }, [lastEvent, fetchGovernorData]);

    const handleOnboardClubSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setOnboardError("");
        setOnboardingClub(true);
        try {
            const res = await apiClient.post("/governor/clubs", {
                name: newClubName.trim(),
                slug: newClubSlug.toLowerCase().trim(),
                president_name: newPresName.trim(),
                president_email: newPresEmail.toLowerCase().trim(),
                president_phone: newPresPhone.trim() || undefined,
            });
            setOpenClubModal(false);
            setNewClubName("");
            setNewClubSlug("");
            setNewPresName("");
            setNewPresEmail("");
            setNewPresPhone("");
            setCredentials(res.data.credentials);
            fetchGovernorData();
        } catch (err: any) {
            setOnboardError(err.response?.data?.detail || "Failed to charter club workspace");
        } finally {
            setOnboardingClub(false);
        }
    };

    const handleAssignPresidentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignTargetClub) return;
        setAssigningPres(true);
        try {
            const res = await apiClient.post(`/admin/clubs/${assignTargetClub.id}/initial-president`, {
                full_name: assignPresName.trim(),
                email: assignPresEmail.toLowerCase().trim(),
                phone_number: assignPresPhone.trim() || undefined,
            });
            setAssignTargetClub(null);
            setAssignPresName("");
            setAssignPresEmail("");
            setAssignPresPhone("");
            setCredentials(res.data.credentials);
            fetchGovernorData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to appoint president");
        } finally {
            setAssigningPres(false);
        }
    };

    const handleBroadcastCircular = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            alert(t("select_file_warning", "Please attach the official circular PDF/DOCX file."));
            return;
        }

        setBroadcasting(true);
        const formData = new FormData();
        formData.append("title", circularTitle.trim());
        if (circularDesc.trim()) formData.append("description", circularDesc.trim());
        formData.append("file", selectedFile);

        try {
            const res = await apiClient.post("/governor/circulars", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setBroadcastSuccess(res.data.message);
            setOpenCircularModal(false);
            setCircularTitle("");
            setCircularDesc("");
            setSelectedFile(null);
            fetchGovernorData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to broadcast circular");
        } finally {
            setBroadcasting(false);
        }
    };

    const handleScheduleConvention = async (e: React.FormEvent) => {
        e.preventDefault();
        setScheduling(true);
        try {
            await apiClient.post("/governor/events", {
                title: eventTitle.trim(),
                description: eventDesc.trim() || undefined,
                start_time: new Date(eventStart).toISOString(),
                location: eventLocation.trim(),
            });
            setOpenEventModal(false);
            setEventTitle("");
            setEventDesc("");
            setEventStart("");
            setEventLocation("");
            alert("District Convention synchronized with all club calendars!");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to schedule convention");
        } finally {
            setScheduling(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const filteredClubs = clubs.filter((c) => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.president_name && c.president_name.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus =
            statusFilter === "all" ? true : statusFilter === "active" ? c.is_active : !c.is_active;
        return matchesSearch && matchesStatus;
    });

    const activeGovernorName = overview?.governor_name || user?.full_name || "District Governor";
    const activeDistrictName = overview?.district_name || (user as any)?.district || "Lions District 107-N";

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 6 }}>
            {/* Top Regional App Bar */}
            <AppBar
                position="sticky"
                elevation={3}
                sx={{
                    bgcolor: mode === "light" ? "#002F6C" : "#1E1E1E",
                    borderBottom: "2px solid #F2A900",
                }}
            >
                <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, sm: 4 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: "white", display: "flex", alignItems: "center", gap: 1 }}>
                            🦁 {t("app_name", "ChatUp")}
                        </Typography>
                        <Chip
                            label="DISTRICT GOVERNOR"
                            size="small"
                            sx={{ bgcolor: "#F2A900", color: "#002F6C", fontWeight: 900, height: 22 }}
                        />
                    </Box>

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
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

                        <Tooltip title={mode === "dark" ? t("light_mode", "Day Mode") : t("dark_mode", "Night Mode")}>
                            <IconButton onClick={toggleColorMode} color="inherit" size="small">
                                {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
                            </IconButton>
                        </Tooltip>

                        <Button
                            variant="contained"
                            color="error"
                            onClick={logout}
                            startIcon={<LogoutIcon />}
                            sx={{ fontWeight: 800, borderRadius: 2.5, height: 36, px: 2 }}
                        >
                            {t("logout", "Log Out")}
                        </Button>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Regional Banner & Executive Profile */}
            <Container maxWidth="lg" sx={{ mt: 3, px: { xs: 2, sm: 3 } }}>
                <Paper
                    elevation={3}
                    sx={{
                        p: { xs: 2.5, sm: 4 },
                        mb: 3.5,
                        borderRadius: 3.5,
                        background: mode === "light"
                            ? "linear-gradient(135deg, #002F6C 0%, #001f4d 100%)"
                            : "linear-gradient(135deg, #1E1E1E 0%, #00122e 100%)",
                        border: "1.5px solid rgba(242, 169, 0, 0.4)",
                        color: "white",
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
                        <Box>
                            <Typography variant="overline" sx={{ color: "#F2A900", fontWeight: 900, letterSpacing: 1.5 }}>
                                {t("regional_jurisdiction", "REGIONAL JURISDICTION • LIONS CLUBS INTERNATIONAL")}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                                {activeDistrictName}
                            </Typography>
                            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.9)", mt: 0.5, fontWeight: 700 }}>
                                🏛️ {t("district_governor_label", "District Governor (Piirikuvernööri)")}: <b>{activeGovernorName}</b>
                            </Typography>
                        </Box>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                            <Button
                                variant="contained"
                                startIcon={<AddBusinessIcon />}
                                onClick={() => setOpenClubModal(true)}
                                sx={{
                                    bgcolor: "white",
                                    color: "#002F6C",
                                    fontWeight: 900,
                                    px: 2.5,
                                    py: 1.2,
                                    borderRadius: 3,
                                    textTransform: "none",
                                    "&:hover": { bgcolor: "grey.100" },
                                }}
                            >
                                {t("onboard_club_btn", "Onboard Club in District")}
                            </Button>

                            <Button
                                variant="contained"
                                startIcon={<CampaignIcon />}
                                onClick={() => setOpenCircularModal(true)}
                                sx={{
                                    bgcolor: "#F2A900",
                                    color: "#002F6C",
                                    fontWeight: 900,
                                    px: 2.5,
                                    py: 1.2,
                                    borderRadius: 3,
                                    textTransform: "none",
                                    "&:hover": { bgcolor: "#d99800" },
                                }}
                            >
                                {t("broadcast_circular_btn", "Broadcast Directive")}
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                {broadcastSuccess && (
                    <Alert severity="success" sx={{ mb: 3, borderRadius: 2.5 }} onClose={() => setBroadcastSuccess("")}>
                        {broadcastSuccess}
                    </Alert>
                )}

                {/* Regional KPI Summary Bar */}
                {overview && (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                            gap: 2,
                            mb: 4,
                        }}
                    >
                        <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #002F6C" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <DomainIcon sx={{ color: "#002F6C", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("kpi_district_clubs", "District Clubs")}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, color: "#002F6C", mt: 0.5 }}>
                                {overview.active_district_clubs} <span style={{ fontSize: "1rem", color: "gray" }}>/ {overview.total_district_clubs}</span>
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                {t("active_jurisdiction", "Active Regional Charters")}
                            </Typography>
                        </Card>

                        <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #2e7d32" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <PeopleIcon sx={{ color: "#2e7d32", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("kpi_regional_members", "Regional Lions")}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, color: "#2e7d32", mt: 0.5 }}>
                                {overview.total_regional_members}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                {t("members_good_standing", "Active Members")}
                            </Typography>
                        </Card>

                        <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #F2A900" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <VerifiedIcon sx={{ color: "#b78103", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("kpi_club_presidents", "Club Presidents")}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, color: "#b78103", mt: 0.5 }}>
                                {overview.total_club_presidents}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                {t("appointed_officers", "Charter Executives")}
                            </Typography>
                        </Card>

                        <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #C2185B" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <CampaignIcon sx={{ color: "#C2185B", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("kpi_circulars_sent", "Circulars Issued")}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, color: "#C2185B", mt: 0.5 }}>
                                {overview.circulars_issued_count}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {t("published_piirikirjeet", "Published Piirikirjeet")}
                            </Typography>
                        </Card>
                    </Box>
                )}

                {/* Main Navigation Tabs */}
                <Card elevation={1} sx={{ borderRadius: 3.5, mb: 3.5 }}>
                    <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)} variant="fullWidth">
                        <Tab icon={<DomainIcon />} iconPosition="start" label={`${t("tab_district_clubs", "District Clubs Roster")} (${clubs.length})`} sx={{ minHeight: 52, fontWeight: 800 }} />
                        <Tab icon={<DescriptionIcon />} iconPosition="start" label={`${t("tab_issued_circulars", "Issued Circulars Archive")} (${circulars.length})`} sx={{ minHeight: 52, fontWeight: 800 }} />
                        <Tab icon={<EventIcon />} iconPosition="start" label={t("tab_district_events", "District Conventions & Events")} sx={{ minHeight: 52, fontWeight: 800 }} />
                    </Tabs>
                </Card>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                        <CircularProgress size={50} />
                    </Box>
                ) : tabIndex === 0 ? (
                    /* ================= TAB 0: DISTRICT CLUBS ROSTER ================= */
                    <Box>
                        {/* Search & Filter Bar */}
                        <Card elevation={1} sx={{ p: 2, borderRadius: 3.5, mb: 3 }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
                                <TextField
                                    fullWidth
                                    placeholder={t("search_clubs_placeholder", "Search clubs by name, slug, or president...")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />

                                <FormControl sx={{ minWidth: { xs: "100%", sm: 200 } }}>
                                    <Select
                                        size="small"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <MenuItem value="all">{t("status_all", "All Clubs")}</MenuItem>
                                        <MenuItem value="active">{t("status_active", "Active Only")}</MenuItem>
                                        <MenuItem value="suspended">{t("status_suspended", "Suspended Only")}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Stack>
                        </Card>

                        {filteredClubs.length === 0 ? (
                            <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                                <DomainIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    {t("no_clubs_found", "No District Clubs Found")}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    No clubs match your query or none have been chartered yet in {activeDistrictName}.
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddBusinessIcon />}
                                    onClick={() => setOpenClubModal(true)}
                                    sx={{ fontWeight: 800, bgcolor: "#002F6C" }}
                                >
                                    {t("onboard_club_btn", "Onboard First Club")}
                                </Button>
                            </Paper>
                        ) : (
                            <Stack spacing={2.5}>
                                {filteredClubs.map((c) => {
                                    const quota = 50;
                                    const quotaPct = Math.min(100, Math.round((c.member_count / quota) * 100));

                                    return (
                                        <Card key={c.id} elevation={2} sx={{ borderRadius: 3.5, borderLeft: "6px solid #002F6C" }}>
                                            <CardContent sx={{ p: { xs: 2.2, sm: 3 } }}>
                                                {/* Club Header Info */}
                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
                                                    <Box>
                                                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                            🦁 {c.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                            Slug: <b>{c.slug}</b> • Region: {c.district}
                                                        </Typography>
                                                    </Box>
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                        <Chip label={c.is_active ? t("active_status", "Active Club") : t("suspended_status", "Suspended")} color={c.is_active ? "success" : "error"} size="small" sx={{ fontWeight: 800 }} />
                                                        <Chip label={`${c.member_count} / ${quota} Members`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                                                    </Stack>
                                                </Box>

                                                {/* Member Capacity Progress */}
                                                <Box sx={{ mb: 2 }}>
                                                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                                                            Membership Capacity ({quotaPct}%)
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ fontWeight: 800, color: "#002F6C" }}>
                                                            {c.member_count} Active Lions
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress variant="determinate" value={quotaPct} sx={{ height: 6, borderRadius: 3, "& .MuiLinearProgress-bar": { bgcolor: "#002F6C" } }} />
                                                </Box>

                                                {/* President Appointment / Contact Card */}
                                                {c.president_name ? (
                                                    <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                                            <Avatar sx={{ bgcolor: "#002F6C", color: "#F2A900", fontWeight: 900 }}>
                                                                {c.president_name.charAt(0)}
                                                            </Avatar>
                                                            <Box>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                                    👑 {t("president_label", "Club President")}: {c.president_name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Executive officer in charge of local governance
                                                                </Typography>
                                                            </Box>
                                                        </Box>

                                                        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                                                            {c.president_email && (
                                                                <Tooltip title="Email President">
                                                                    <Button
                                                                        size="small"
                                                                        startIcon={<EmailIcon />}
                                                                        component="a"
                                                                        href={`mailto:${c.president_email}`}
                                                                        sx={{ fontWeight: 700, textTransform: "none" }}
                                                                    >
                                                                        {c.president_email}
                                                                    </Button>
                                                                </Tooltip>
                                                            )}
                                                            {c.president_phone && (
                                                                <Tooltip title="Call President">
                                                                    <Button
                                                                        size="small"
                                                                        startIcon={<PhoneIcon />}
                                                                        component="a"
                                                                        href={`tel:${c.president_phone}`}
                                                                        sx={{ fontWeight: 700, textTransform: "none" }}
                                                                    >
                                                                        {c.president_phone}
                                                                    </Button>
                                                                </Tooltip>
                                                            )}
                                                        </Stack>
                                                    </Paper>
                                                ) : (
                                                    <Alert
                                                        severity="warning"
                                                        action={
                                                            <Button
                                                                color="inherit"
                                                                size="small"
                                                                startIcon={<PersonAddAlt1Icon />}
                                                                onClick={() => {
                                                                    setAssignTargetClub(c);
                                                                    setAssignPresName("");
                                                                    setAssignPresEmail("");
                                                                    setAssignPresPhone("");
                                                                }}
                                                                sx={{ fontWeight: 800 }}
                                                            >
                                                                Appoint President
                                                            </Button>
                                                        }
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        No President appointed for this chartered club.
                                                    </Alert>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>
                        )}
                    </Box>
                ) : tabIndex === 1 ? (
                    /* ================= TAB 1: ISSUED CIRCULARS ARCHIVE ================= */
                    <Box>
                        {circulars.length === 0 ? (
                            <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                                <CampaignIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    No Directives Issued Yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Broadcast official circulars (Piirikirje) to distribute to all {clubs.length} clubs across {activeDistrictName}.
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<CampaignIcon />}
                                    onClick={() => setOpenCircularModal(true)}
                                    sx={{ fontWeight: 800, bgcolor: "#002F6C" }}
                                >
                                    Broadcast First Circular
                                </Button>
                            </Paper>
                        ) : (
                            <Stack spacing={2}>
                                {circulars.map((circ) => (
                                    <Card key={circ.id} elevation={2} sx={{ borderRadius: 3, borderLeft: "5px solid #C2185B" }}>
                                        <CardContent sx={{ p: 2.5 }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                                                <Box>
                                                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#002F6C" }}>
                                                        {circ.title}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {circ.description}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
                                                        Published on: {new Date(circ.created_at).toLocaleDateString()} • Distributed to all district clubs
                                                    </Typography>
                                                </Box>

                                                <Button
                                                    variant="outlined"
                                                    startIcon={<DownloadIcon />}
                                                    component="a"
                                                    href={circ.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    sx={{ fontWeight: 800, borderRadius: 2, textTransform: "none" }}
                                                >
                                                    Download PDF
                                                </Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </Box>
                ) : (
                    /* ================= TAB 2: DISTRICT CONVENTIONS & EVENTS ================= */
                    <Card elevation={2} sx={{ p: 4, borderRadius: 3.5, textAlign: "center" }}>
                        <EventIcon sx={{ fontSize: 60, color: "#002F6C", mb: 1.5 }} />
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                            Regional Conventions & Cabinet Meetings
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: "auto", mb: 3 }}>
                            Schedule district-wide conventions (Piirikokous) and leadership seminars. Events will automatically synchronize to all {clubs.length} clubs' calendars across {activeDistrictName}.
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<EventIcon />}
                            onClick={() => setOpenEventModal(true)}
                            sx={{ fontWeight: 900, bgcolor: "#002F6C", borderRadius: 2.5, px: 3, py: 1 }}
                        >
                            Schedule Regional Convention
                        </Button>
                    </Card>
                )}
            </Container>

            {/* Onboard New Club Dialog (Governor Level) */}
            <Dialog open={openClubModal} onClose={() => !onboardingClub && setOpenClubModal(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    🏢 Charter New Club Workspace in {activeDistrictName}
                </DialogTitle>
                <Box component="form" onSubmit={handleOnboardClubSubmit}>
                    <DialogContent dividers>
                        {onboardError && <Alert severity="error" sx={{ mb: 2 }}>{onboardError}</Alert>}

                        <TextField
                            fullWidth
                            required
                            label="Official Club Name"
                            value={newClubName}
                            onChange={(e) => {
                                setNewClubName(e.target.value);
                                if (!newClubSlug) {
                                    setNewClubSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"));
                                }
                            }}
                            margin="normal"
                            placeholder="e.g. Lions Club Varkaus"
                        />

                        <TextField
                            fullWidth
                            required
                            label="Workspace Slug Identifier"
                            value={newClubSlug}
                            onChange={(e) => setNewClubSlug(e.target.value)}
                            margin="normal"
                            placeholder="e.g. lions-varkaus"
                        />

                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                            Inaugural Club President Appointment
                        </Typography>

                        <TextField
                            fullWidth
                            required
                            label="President Full Name"
                            value={newPresName}
                            onChange={(e) => setNewPresName(e.target.value)}
                            margin="normal"
                            placeholder="Jari Savolainen"
                        />

                        <TextField
                            fullWidth
                            required
                            type="email"
                            label="Official Email Address"
                            value={newPresEmail}
                            onChange={(e) => setNewPresEmail(e.target.value)}
                            margin="normal"
                            placeholder="president@lionsvarkaus.fi"
                        />

                        <TextField
                            fullWidth
                            label="Phone Number"
                            value={newPresPhone}
                            onChange={(e) => setNewPresPhone(e.target.value)}
                            margin="normal"
                            placeholder="+358 40 1234567"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenClubModal(false)} disabled={onboardingClub}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={onboardingClub} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {onboardingClub ? <CircularProgress size={24} color="inherit" /> : "Charter Club & Appoint President"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Assign President to Existing Club Modal */}
            <Dialog open={Boolean(assignTargetClub)} onClose={() => !assigningPres && setAssignTargetClub(null)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    👑 Appoint President ({assignTargetClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleAssignPresidentSubmit}>
                    <DialogContent dividers>
                        <TextField
                            fullWidth
                            required
                            label="President Full Name"
                            value={assignPresName}
                            onChange={(e) => setAssignPresName(e.target.value)}
                            margin="normal"
                            placeholder="Matti Virtanen"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label="President Email Address"
                            value={assignPresEmail}
                            onChange={(e) => setAssignPresEmail(e.target.value)}
                            margin="normal"
                            placeholder="president@lionsclub.fi"
                        />
                        <TextField
                            fullWidth
                            label="Phone Number"
                            value={assignPresPhone}
                            onChange={(e) => setAssignPresPhone(e.target.value)}
                            margin="normal"
                            placeholder="+358 40 1234567"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setAssignTargetClub(null)} disabled={assigningPres}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={assigningPres} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {assigningPres ? <CircularProgress size={24} color="inherit" /> : "Appoint President"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Credentials Generated Modal */}
            <Dialog open={Boolean(credentials)} onClose={() => setCredentials(null)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "#2e7d32", color: "white", fontWeight: 800 }}>
                    <CheckCircleIcon /> Inaugural President Credentials
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        Club chartered successfully. Share these temporary login credentials with the newly appointed President:
                    </Typography>

                    <Card variant="outlined" sx={{ p: 2, bgcolor: "action.hover", mb: 2, borderRadius: 2.5 }}>
                        <Typography variant="caption" color="text.secondary">Club Workspace</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.club_name}</Typography>

                        <Typography variant="caption" color="text.secondary">President Name</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.president_name}</Typography>

                        <Typography variant="caption" color="text.secondary">Login Email</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.email}</Typography>

                        <Typography variant="caption" color="text.secondary">Temporary Password</Typography>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", color: "#002F6C", fontWeight: 900 }}>
                            {credentials?.temp_password}
                        </Typography>
                    </Card>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
                    <Button
                        startIcon={copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                        onClick={() => copyToClipboard(`ChatUp Club: ${credentials?.club_name}\nEmail: ${credentials?.email}\nPassword: ${credentials?.temp_password}`)}
                        sx={{ fontWeight: 800 }}
                    >
                        {copied ? "Copied!" : "Copy Credentials"}
                    </Button>
                    <Button variant="contained" onClick={() => setCredentials(null)} sx={{ fontWeight: 800 }}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Broadcast District Directive Modal */}
            <Dialog open={openCircularModal} onClose={() => !broadcasting && setOpenCircularModal(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    📢 {t("broadcast_directive_title", "Broadcast District Directive (Piirikirje)")}
                </DialogTitle>
                <Box component="form" onSubmit={handleBroadcastCircular}>
                    <DialogContent dividers>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            This circular will be distributed into the official Document Repository of all <b>{clubs.length} clubs</b> across <b>{activeDistrictName}</b> instantly.
                        </Typography>

                        <TextField
                            fullWidth
                            required
                            label="Circular Subject / Title"
                            value={circularTitle}
                            onChange={(e) => setCircularTitle(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Piirikuvernöörin kuukausikirje - Marraskuu 2026"
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Governor's Executive Remarks (Optional)"
                            value={circularDesc}
                            onChange={(e) => setCircularDesc(e.target.value)}
                            margin="normal"
                            placeholder="Key priorities, district convention details, or charity targets"
                        />

                        <Box sx={{ mt: 2, p: 2.5, border: "2px dashed #002F6C", borderRadius: 3, textAlign: "center", bgcolor: "rgba(0, 47, 108, 0.03)" }}>
                            <input
                                type="file"
                                id="gov-file-input"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedFile(e.target.files[0]);
                                        if (!circularTitle) {
                                            setCircularTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
                                        }
                                    }
                                }}
                            />
                            <label htmlFor="gov-file-input">
                                <Button variant="outlined" component="span" startIcon={<UploadFileIcon />} sx={{ fontWeight: 800 }}>
                                    Attach Official PDF / Document
                                </Button>
                            </label>
                            {selectedFile && (
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main", mt: 1 }}>
                                    ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenCircularModal(false)} disabled={broadcasting}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={broadcasting} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {broadcasting ? <CircularProgress size={24} color="inherit" /> : "Broadcast to All District Clubs"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Schedule Convention Modal */}
            <Dialog open={openEventModal} onClose={() => !scheduling && setOpenEventModal(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    🏛️ Schedule District Convention / Event
                </DialogTitle>
                <Box component="form" onSubmit={handleScheduleConvention}>
                    <DialogContent dividers>
                        <TextField
                            fullWidth
                            required
                            label="Convention Title"
                            value={eventTitle}
                            onChange={(e) => setEventTitle(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Lions District 107-N Syyspiirikokous 2026"
                        />

                        <TextField
                            fullWidth
                            required
                            type="datetime-local"
                            label="Start Date & Time"
                            value={eventStart}
                            onChange={(e) => setEventStart(e.target.value)}
                            margin="normal"
                            slotProps={{ inputLabel: { shrink: true } }}
                        />

                        <TextField
                            fullWidth
                            required
                            label="Venue / Location"
                            value={eventLocation}
                            onChange={(e) => setEventLocation(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Finlandia-talo, Helsinki"
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Convention Agenda / Information"
                            value={eventDesc}
                            onChange={(e) => setEventDesc(e.target.value)}
                            margin="normal"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenEventModal(false)} disabled={scheduling}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={scheduling} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {scheduling ? <CircularProgress size={24} color="inherit" /> : "Synchronize across District"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
};