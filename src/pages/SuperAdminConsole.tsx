// chatup/frontend/src/pages/SuperAdminConsole.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    Stack,
    Divider,
    Switch,
    FormControlLabel,
    Tabs,
    Tab,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import TuneIcon from "@mui/icons-material/Tune";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import DescriptionIcon from "@mui/icons-material/Description";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import PaymentsIcon from "@mui/icons-material/Payments";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockResetIcon from "@mui/icons-material/LockReset";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import SecurityIcon from "@mui/icons-material/Security";
import StorageIcon from "@mui/icons-material/Storage";
import DomainIcon from "@mui/icons-material/Domain";
import SpeedIcon from "@mui/icons-material/Speed";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface PresidentInfo {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    is_active: boolean;
}

interface Club {
    id: string;
    name: string;
    slug: string;
    district?: string;
    is_active: boolean;
    member_count: number;
    president?: PresidentInfo | null;
    features: {
        video_calls: boolean;
        mom_editor: boolean;
        social_feed: boolean;
        dues_module: boolean;
        max_members: number;
    };
}

interface ProvisionedCredentials {
    club_name: string;
    president_name: string;
    email: string;
    temp_password: string;
}

interface TelemetryData {
    total_clubs: number;
    active_clubs: number;
    suspended_clubs: number;
    total_members: number;
    total_presidents: number;
    subscription_health: string;
    system_status: string;
}

const NORDIC_DISTRICTS = [
    "District 107-A (Southwest Finland)",
    "District 107-B (Uusimaa)",
    "District 107-C (Häme)",
    "District 107-D (Kymenlaakso)",
    "District 107-E (Pirkanmaa)",
    "District 107-F (Ostrobothnia)",
    "District 107-G (Central Finland)",
    "District 107-H (North Karelia)",
    "District 107-I (Oulu Region)",
    "District 107-K (Savonia)",
    "District 107-L (Lapland)",
    "District 107-M (Satakunta)",
    "District 107-N (Helsinki Metropolitan)",
    "District 107-O (Kainuu)",
    "Other European District",
];

export const SuperAdminConsole: React.FC<{
    onBack: () => void;
    initialTab?: number;
}> = ({ onBack, initialTab = 0 }) => {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<number>(initialTab);
    const [clubs, setClubs] = useState<Club[]>([]);
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [loading, setLoading] = useState(true);

    // Search and Filtering
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Onboard New Club State
    const [clubName, setClubName] = useState("");
    const [clubSlug, setClubSlug] = useState("");
    const [district, setDistrict] = useState("District 107-N (Helsinki Metropolitan)");
    const [presidentName, setPresidentName] = useState("");
    const [presidentEmail, setPresidentEmail] = useState("");
    const [presidentPhone, setPresidentPhone] = useState("");
    const [featureVideo, setFeatureVideo] = useState(true);
    const [featureMOM, setFeatureMOM] = useState(true);
    const [featureSocial, setFeatureSocial] = useState(true);
    const [featureDues, setFeatureDues] = useState(true);
    const [maxMembers, setMaxMembers] = useState(50);

    // Edit President State
    const [editPresidentClub, setEditPresidentClub] = useState<Club | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");

    // Assign President State
    const [assignPresidentClub, setAssignPresidentClub] = useState<Club | null>(null);
    const [assignName, setAssignName] = useState("");
    const [assignEmail, setAssignEmail] = useState("");
    const [assignPhone, setAssignPhone] = useState("");

    // Modals
    const [resetClubTarget, setResetClubTarget] = useState<Club | null>(null);
    const [deleteClubTarget, setDeleteClubTarget] = useState<Club | null>(null);
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);
    const [credentials, setCredentials] = useState<ProvisionedCredentials | null>(null);
    const [copied, setCopied] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const [clubsRes, teleRes] = await Promise.all([
                apiClient.get("/admin/clubs", {
                    params: {
                        search: searchQuery || undefined,
                        status_filter: statusFilter !== "all" ? statusFilter : undefined,
                    },
                }),
                apiClient.get("/admin/stats"),
            ]);
            setClubs(clubsRes.data);
            setTelemetry(teleRes.data);
        } catch (err) {
            console.error("Failed to load SaaS telemetry or clubs:", err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, statusFilter]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleCreateClub = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const res = await apiClient.post("/admin/clubs", {
                name: clubName.trim(),
                slug: clubSlug.toLowerCase().trim(),
                district: district.trim() || undefined,
                president_name: presidentName.trim(),
                president_email: presidentEmail.toLowerCase().trim(),
                president_phone: presidentPhone.trim() || undefined,
                features: {
                    video_calls: featureVideo,
                    mom_editor: featureMOM,
                    social_feed: featureSocial,
                    dues_module: featureDues,
                    max_members: maxMembers,
                },
            });

            if (res.data.credentials) {
                setCredentials(res.data.credentials);
            }

            setClubName("");
            setClubSlug("");
            setPresidentName("");
            setPresidentEmail("");
            setPresidentPhone("");
            setActiveTab(0);
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to provision new club workspace");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAssignPresident = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignPresidentClub) return;

        setError(null);
        setSubmitting(true);
        try {
            const res = await apiClient.post(`/admin/clubs/${assignPresidentClub.id}/initial-president`, {
                full_name: assignName.trim(),
                email: assignEmail.toLowerCase().trim(),
                phone_number: assignPhone.trim() || undefined,
            });

            setCredentials(res.data.credentials);
            setAssignPresidentClub(null);
            setAssignName("");
            setAssignEmail("");
            setAssignPhone("");
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to assign club president");
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPresidentPassword = async () => {
        if (!resetClubTarget) return;
        setError(null);
        setSubmitting(true);
        try {
            const res = await apiClient.post(`/admin/clubs/${resetClubTarget.id}/reset-president-password`);
            setCredentials(res.data.credentials);
            setResetClubTarget(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to reset president credentials");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSavePresidentDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editPresidentClub) return;
        setError(null);
        setSubmitting(true);
        try {
            await apiClient.patch(`/admin/clubs/${editPresidentClub.id}/president`, {
                full_name: editName.trim(),
                email: editEmail.toLowerCase().trim(),
                phone_number: editPhone.trim() || undefined,
            });
            setEditPresidentClub(null);
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to update president details");
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleStatus = async (club: Club) => {
        try {
            await apiClient.patch(`/admin/clubs/${club.id}`, {
                is_active: !club.is_active,
            });
            fetchDashboardData();
        } catch (err) {
            console.error("Status toggle error:", err);
        }
    };

    const handleDeleteClub = async () => {
        if (!deleteClubTarget) return;
        setError(null);
        setSubmitting(true);
        try {
            await apiClient.delete(`/admin/clubs/${deleteClubTarget.id}`);
            setDeleteClubTarget(null);
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to decommission club workspace");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveFeatures = async () => {
        if (!selectedClub) return;
        try {
            await apiClient.patch(`/admin/clubs/${selectedClub.id}/features`, selectedClub.features);
            setSelectedClub(null);
            fetchDashboardData();
        } catch (err) {
            console.error("Feature save error:", err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 4 }, px: { xs: 2, sm: 3 } }}>
            {/* Top Navigation & Breadcrumb */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 3.5,
                }}
            >
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                    variant="outlined"
                    sx={{
                        fontWeight: 800,
                        minHeight: 48,
                        borderRadius: 3,
                        px: 2.5,
                        borderColor: "rgba(0, 47, 108, 0.3)",
                    }}
                >
                    {t("back_to_dashboard", "Back to Dashboard")}
                </Button>

                <Box sx={{ textAlign: { xs: "center", sm: "right" } }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: "primary.main" }}>
                        🛠️ {t("super_admin_console_heading", "Super Admin SaaS Console")}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                        {t("super_admin_subtitle", "Multi-Tenant Governance • Nordic & European Club Registry")}
                    </Typography>
                </Box>
            </Stack>

            {/* Executive KPI Summary Bar */}
            {telemetry && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                        gap: 2,
                        mb: 4,
                    }}
                >
                    <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #002F6C" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                            {t("kpi_active_clubs", "Active Clubs")}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: "#002F6C", mt: 0.5 }}>
                            {telemetry.active_clubs} <span style={{ fontSize: "1rem", color: "gray" }}>/ {telemetry.total_clubs}</span>
                        </Typography>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #2e7d32" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                            {t("kpi_total_members", "Total Members")}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: "#2e7d32", mt: 0.5 }}>
                            {telemetry.total_members}
                        </Typography>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #F2A900" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                            {t("kpi_club_presidents", "Club Presidents")}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: "#b78103", mt: 0.5 }}>
                            {telemetry.total_presidents}
                        </Typography>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #0288d1" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                            {t("kpi_platform_health", "Platform Health")}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: "#0288d1", mt: 0.5 }}>
                            {telemetry.system_status}
                        </Typography>
                    </Card>
                </Box>
            )}

            {/* Navigation Tabs */}
            <Card elevation={1} sx={{ borderRadius: 3.5, mb: 4, bgcolor: "background.paper" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, val) => setActiveTab(val)}
                    variant="fullWidth"
                    sx={{
                        "& .MuiTab-root": {
                            minHeight: 56,
                            fontWeight: 800,
                            fontSize: { xs: "0.85rem", sm: "1rem" },
                            textTransform: "none",
                        },
                    }}
                >
                    <Tab icon={<DomainIcon />} iconPosition="start" label={t("tab_directory", "Club Directory & Governance")} />
                    <Tab icon={<AddBusinessIcon />} iconPosition="start" label={t("tab_onboard", "Register & Onboard New Club")} />
                    <Tab icon={<SpeedIcon />} iconPosition="start" label={t("tab_telemetry", "Telemetry & Infrastructure")} />
                </Tabs>
            </Card>

            {/* ================= TAB 0: CLUB DIRECTORY & GOVERNANCE ================= */}
            {activeTab === 0 && (
                <Box>
                    {/* Search & Filter Controls */}
                    <Card elevation={1} sx={{ p: 2, borderRadius: 3.5, mb: 3 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
                            <TextField
                                fullWidth
                                placeholder={t("search_clubs_placeholder", "Search by club name, slug, or district...")}
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
                                <InputLabel>{t("workspace_status", "Workspace Status")}</InputLabel>
                                <Select
                                    value={statusFilter}
                                    label={t("workspace_status", "Workspace Status")}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <MenuItem value="all">{t("status_all", "All Clubs")}</MenuItem>
                                    <MenuItem value="active">{t("status_active", "Active Only")}</MenuItem>
                                    <MenuItem value="suspended">{t("status_suspended", "Suspended Only")}</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    </Card>

                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                            <CircularProgress size={50} />
                        </Box>
                    ) : clubs.length === 0 ? (
                        <Card elevation={1} sx={{ p: 5, borderRadius: 4, textAlign: "center" }}>
                            <DomainIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("no_clubs_found", "No Clubs Found")}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {t("no_clubs_match", "No club workspace matches your search criteria.")}
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddBusinessIcon />}
                                onClick={() => setActiveTab(1)}
                                sx={{ fontWeight: 800, borderRadius: 3 }}
                            >
                                {t("onboard_now", "Onboard New Club Now")}
                            </Button>
                        </Card>
                    ) : (
                        <Stack spacing={3}>
                            {clubs.map((club) => (
                                <Card
                                    key={club.id}
                                    elevation={3}
                                    sx={{
                                        borderRadius: 3.5,
                                        borderLeft: "6px solid",
                                        borderLeftColor: club.is_active ? "#2e7d32" : "#d32f2f",
                                    }}
                                >
                                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexDirection: { xs: "column", sm: "row" },
                                                justifyContent: "space-between",
                                                alignItems: { xs: "flex-start", sm: "center" },
                                                gap: 1.5,
                                                mb: 2,
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                    🦁 {club.name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                    Slug: <b>{club.slug}</b> {club.district && ` • ${t("district", "District")}: ${club.district}`}
                                                </Typography>
                                            </Box>

                                            <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                                                <Chip
                                                    label={club.is_active ? t("active_status", "Active") : t("suspended_status", "Suspended")}
                                                    color={club.is_active ? "success" : "error"}
                                                    sx={{ fontWeight: 800 }}
                                                />
                                                <Chip
                                                    label={`${club.member_count} / ${club.features?.max_members || 50} ${t("members_count_label", "Members")}`}
                                                    color={club.member_count === 0 ? "warning" : "default"}
                                                    variant={club.member_count === 0 ? "filled" : "outlined"}
                                                    sx={{ fontWeight: 700 }}
                                                />
                                            </Stack>
                                        </Box>

                                        {/* President Details Card */}
                                        {club.president ? (
                                            <Card
                                                variant="outlined"
                                                sx={{
                                                    p: 2,
                                                    mb: 2,
                                                    bgcolor: "action.hover",
                                                    borderRadius: 2.5,
                                                    display: "flex",
                                                    flexDirection: { xs: "column", sm: "row" },
                                                    justifyContent: "space-between",
                                                    alignItems: { xs: "flex-start", sm: "center" },
                                                    gap: 1.5,
                                                }}
                                            >
                                                <Box>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                        👑 {t("president_label", "Club President")}: {club.president.full_name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                        {t("email_label", "Email")}: <b>{club.president.email}</b>{" "}
                                                        {club.president.phone_number && `• ${t("phone_label", "Phone")}: ${club.president.phone_number}`}
                                                    </Typography>
                                                </Box>
                                                <Stack direction="row" spacing={1}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="primary"
                                                        startIcon={<EditIcon />}
                                                        onClick={() => {
                                                            setEditPresidentClub(club);
                                                            setEditName(club.president?.full_name || "");
                                                            setEditEmail(club.president?.email || "");
                                                            setEditPhone(club.president?.phone_number || "");
                                                        }}
                                                        sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                                                    >
                                                        {t("edit_contact", "Edit Contact")}
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="warning"
                                                        startIcon={<LockResetIcon />}
                                                        onClick={() => setResetClubTarget(club)}
                                                        sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
                                                    >
                                                        {t("reset_password", "Reset Password")}
                                                    </Button>
                                                </Stack>
                                            </Card>
                                        ) : (
                                            <Alert
                                                severity="warning"
                                                icon={<WarningAmberIcon />}
                                                action={
                                                    <Button
                                                        color="inherit"
                                                        size="small"
                                                        startIcon={<PersonAddAlt1Icon />}
                                                        onClick={() => setAssignPresidentClub(club)}
                                                        sx={{ fontWeight: 800 }}
                                                    >
                                                        {t("assign_president", "Assign President")}
                                                    </Button>
                                                }
                                                sx={{ mb: 2, borderRadius: 2.5 }}
                                            >
                                                {t("club_no_president_warning", "This club workspace has no appointed President account.")}
                                            </Alert>
                                        )}

                                        <Divider sx={{ my: 1.5 }} />

                                        {/* Features List */}
                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontWeight: 800, textTransform: "uppercase", display: "block" }}>
                                            {t("active_modules_title", "Active Enterprise Modules")}:
                                        </Typography>
                                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
                                            <Chip
                                                icon={<VideoCallIcon />}
                                                label={t("feat_video_calls", "Live Video Calls")}
                                                color={club.features?.video_calls ? "primary" : "default"}
                                                variant={club.features?.video_calls ? "filled" : "outlined"}
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                            <Chip
                                                icon={<DescriptionIcon />}
                                                label={t("feat_mom_editor", "Word MOM Editor")}
                                                color={club.features?.mom_editor ? "primary" : "default"}
                                                variant={club.features?.mom_editor ? "filled" : "outlined"}
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                            <Chip
                                                icon={<DynamicFeedIcon />}
                                                label={t("feat_social_feed", "Social Media Wall")}
                                                color={club.features?.social_feed ? "primary" : "default"}
                                                variant={club.features?.social_feed ? "filled" : "outlined"}
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                            <Chip
                                                icon={<PaymentsIcon />}
                                                label={t("feat_dues_module", "Treasury & Dues")}
                                                color={club.features?.dues_module ? "primary" : "default"}
                                                variant={club.features?.dues_module ? "filled" : "outlined"}
                                                size="small"
                                                sx={{ fontWeight: 700 }}
                                            />
                                        </Box>

                                        {/* Governance Actions Bar */}
                                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap", gap: 1 }}>
                                            <Button
                                                variant="outlined"
                                                color={club.is_active ? "error" : "success"}
                                                size="small"
                                                onClick={() => handleToggleStatus(club)}
                                                sx={{ fontWeight: 800, minHeight: 40, borderRadius: 2.5 }}
                                            >
                                                {club.is_active ? t("suspend_club", "Suspend Club") : t("activate_club", "Activate Club")}
                                            </Button>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                startIcon={<TuneIcon />}
                                                size="small"
                                                onClick={() => setSelectedClub(club)}
                                                sx={{ fontWeight: 800, minHeight: 40, borderRadius: 2.5 }}
                                            >
                                                {t("configure_features", "Configure Features")}
                                            </Button>
                                            <Button
                                                variant="text"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                size="small"
                                                onClick={() => setDeleteClubTarget(club)}
                                                sx={{ fontWeight: 700, minHeight: 40 }}
                                            >
                                                {t("delete_btn", "Delete")}
                                            </Button>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Box>
            )}

            {/* ================= TAB 1: ENTERPRISE ONBOARD NEW CLUB ================= */}
            {activeTab === 1 && (
                <Card elevation={3} sx={{ borderRadius: 4, p: { xs: 2.5, sm: 4.5 } }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#002F6C" }}>
                            🚀 {t("onboard_title", "Provision New Community Club Workspace")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t("onboard_subtitle", "Set up tenant isolation, assign official Lions/Rotary district parameters, and auto-provision temporary credentials for the inaugural Club President.")}
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2.5 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleCreateClub}>
                        <Stack spacing={3}>
                            {/* Section 1: Tenant Workspace Info */}
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 0.5 }}>
                                    {t("section_org", "1. Organization & Workspace Details")}
                                </Typography>
                                <Divider />
                            </Box>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                                <TextField
                                    fullWidth
                                    required
                                    label={t("club_name", "Official Club Name")}
                                    value={clubName}
                                    onChange={(e) => {
                                        setClubName(e.target.value);
                                        if (!clubSlug) {
                                            setClubSlug(
                                                e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")
                                            );
                                        }
                                    }}
                                    placeholder="e.g. Lions Club Helsinki"
                                />

                                <TextField
                                    fullWidth
                                    required
                                    label={t("club_slug", "Unique Workspace Identifier (Slug)")}
                                    value={clubSlug}
                                    onChange={(e) => setClubSlug(e.target.value)}
                                    placeholder="e.g. lions-helsinki"
                                    helperText={t("club_slug_hint", "Used for multi-tenant workspace routing")}
                                />
                            </Box>

                            <FormControl fullWidth>
                                <InputLabel>{t("district_preset", "Nordic / European District Preset")}</InputLabel>
                                <Select
                                    value={district}
                                    label={t("district_preset", "Nordic / European District Preset")}
                                    onChange={(e) => setDistrict(e.target.value)}
                                >
                                    {NORDIC_DISTRICTS.map((dist) => (
                                        <MenuItem key={dist} value={dist}>
                                            {dist}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* Section 2: Inaugural President Details */}
                            <Box sx={{ pt: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 0.5 }}>
                                    {t("section_president", "2. Inaugural President Appointment")}
                                </Typography>
                                <Divider />
                            </Box>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
                                <TextField
                                    fullWidth
                                    required
                                    label={t("president_name", "President Full Name")}
                                    value={presidentName}
                                    onChange={(e) => setPresidentName(e.target.value)}
                                    placeholder="Matti Virtanen"
                                />

                                <TextField
                                    fullWidth
                                    required
                                    type="email"
                                    label={t("president_email", "Official Email Address")}
                                    value={presidentEmail}
                                    onChange={(e) => setPresidentEmail(e.target.value)}
                                    placeholder="president@lionshelsinki.fi"
                                />

                                <TextField
                                    fullWidth
                                    label={t("president_phone", "Phone Number (SEPA / MobilePay)")}
                                    value={presidentPhone}
                                    onChange={(e) => setPresidentPhone(e.target.value)}
                                    placeholder="+358 40 1234567"
                                />
                            </Box>

                            {/* Section 3: Feature Modules Toggles */}
                            <Box sx={{ pt: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 0.5 }}>
                                    {t("section_features", "3. SaaS Feature Modules & Capacity Entitlements")}
                                </Typography>
                                <Divider />
                            </Box>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1.5 }}>
                                <FormControlLabel
                                    control={<Switch checked={featureVideo} onChange={(e) => setFeatureVideo(e.target.checked)} color="primary" />}
                                    label={t("feat_video_calls", "Video Meetings")}
                                />
                                <FormControlLabel
                                    control={<Switch checked={featureMOM} onChange={(e) => setFeatureMOM(e.target.checked)} color="primary" />}
                                    label={t("feat_mom_editor", "Word MOM Editor")}
                                />
                                <FormControlLabel
                                    control={<Switch checked={featureSocial} onChange={(e) => setFeatureSocial(e.target.checked)} color="primary" />}
                                    label={t("feat_social_feed", "Social Wall")}
                                />
                                <FormControlLabel
                                    control={<Switch checked={featureDues} onChange={(e) => setFeatureDues(e.target.checked)} color="primary" />}
                                    label={t("feat_dues_module", "Treasury & Dues")}
                                />
                            </Box>

                            <Box sx={{ maxWidth: { xs: "100%", sm: 300 } }}>
                                <TextField
                                    fullWidth
                                    type="number"
                                    label={t("max_members", "Maximum Member Quota")}
                                    value={maxMembers}
                                    onChange={(e) => setMaxMembers(parseInt(e.target.value) || 50)}
                                />
                            </Box>

                            <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end", pt: 2 }}>
                                <Button
                                    variant="outlined"
                                    size="large"
                                    onClick={() => setActiveTab(0)}
                                    sx={{ minHeight: 52, borderRadius: 3, fontWeight: 800, px: 3 }}
                                >
                                    {t("cancel_btn", "Cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={submitting}
                                    startIcon={<AddBusinessIcon />}
                                    sx={{
                                        minHeight: 52,
                                        borderRadius: 3,
                                        fontWeight: 900,
                                        px: 4,
                                        bgcolor: "#002F6C",
                                        "&:hover": { bgcolor: "#001f4d" },
                                    }}
                                >
                                    {submitting ? <CircularProgress size={26} color="inherit" /> : t("deploy_club_btn", "Deploy & Onboard Club")}
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Card>
            )}

            {/* ================= TAB 2: TELEMETRY & INFRASTRUCTURE ================= */}
            {activeTab === 2 && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
                    <Card elevation={2} sx={{ p: 3, borderRadius: 3.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                            <StorageIcon color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("infra_db_title", "Database Infrastructure")}</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Provider:</b> Neon.tech Serverless PostgreSQL</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Region:</b> AWS Europe Central 1 (Frankfurt)</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Compliance:</b> 100% GDPR Compliant (EU Data Residency)</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Connection Driver:</b> SQLAlchemy 2.0 Asyncpg Pool</Typography>
                    </Card>

                    <Card elevation={2} sx={{ p: 3, borderRadius: 3.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                            <SecurityIcon color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("infra_sec_title", "Security & Realtime Bus")}</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Global Event Bus:</b> WebSocket Broadcast (`/ws/global/sync`)</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Web Push Engine:</b> RFC 8030 VAPID Protocol</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Authorization:</b> PyJWT Bearer Auth + Granular RBAC</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Tenant Boundary:</b> Scoped Tenant ID Foreign Key Guards</Typography>
                    </Card>
                </Box>
            )}

            {/* ================= CREDENTIALS GENERATED MODAL ================= */}
            <Dialog
                open={Boolean(credentials)}
                onClose={() => setCredentials(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "#2e7d32", color: "white", fontWeight: 800 }}>
                    <CheckCircleIcon /> {t("temp_password_title", "Inaugural Credentials Generated")}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                        {t("credentials_desc", "The club workspace and President account were provisioned. Share these temporary login credentials securely:")}
                    </Typography>

                    <Card variant="outlined" sx={{ p: 2, bgcolor: "action.hover", mb: 2, borderRadius: 2.5 }}>
                        <Typography variant="caption" color="text.secondary">{t("club_name", "Club Workspace")}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.club_name}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("president_label", "President Name")}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.president_name}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("email_label", "Login Email")}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.email}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("temp_password_label", "Temporary Password")}</Typography>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", color: "#002F6C", fontWeight: 900 }}>
                            {credentials?.temp_password}
                        </Typography>
                    </Card>

                    <Alert severity="info" sx={{ fontSize: "0.82rem", borderRadius: 2 }}>
                        {t("password_reset_mandate", "The President will be mandated to set a new permanent password immediately upon first login.")}
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
                    <Button
                        startIcon={copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                        onClick={() =>
                            copyToClipboard(
                                `ChatUp Club Workspace: ${credentials?.club_name}\nLogin Email: ${credentials?.email}\nTemporary Password: ${credentials?.temp_password}\nPortal: https://chatup-frontend-steel.vercel.app`
                            )
                        }
                        sx={{ fontWeight: 800 }}
                    >
                        {copied ? t("password_copied", "Copied to Clipboard!") : t("copy_password", "Copy Credentials")}
                    </Button>
                    <Button variant="contained" onClick={() => setCredentials(null)} sx={{ fontWeight: 800 }}>
                        {t("done_btn", "Done")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================= EDIT PRESIDENT CONTACT DIALOG ================= */}
            <Dialog
                open={Boolean(editPresidentClub)}
                onClose={() => !submitting && setEditPresidentClub(null)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    ✏️ {t("edit_president", "Edit President Information")} ({editPresidentClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleSavePresidentDetails}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField
                            fullWidth
                            required
                            label={t("full_name_label", "Full Name")}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("email_label", "Email Address")}
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label={t("phone_label", "Phone Number")}
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            margin="normal"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditPresidentClub(null)} disabled={submitting}>
                            {t("cancel_btn", "Cancel")}
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting} sx={{ fontWeight: 800 }}>
                            {submitting ? <CircularProgress size={24} /> : t("save_changes_btn", "Save Changes")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* ================= RESET PASSWORD CONFIRMATION MODAL ================= */}
            <Dialog
                open={Boolean(resetClubTarget)}
                onClose={() => !submitting && setResetClubTarget(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: "warning.main", display: "flex", alignItems: "center", gap: 1 }}>
                    <LockResetIcon /> {t("reset_president_title", "Reset President Credentials?")}
                </DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Typography variant="body2">
                        {t("reset_confirm_msg", "Are you sure you want to generate a new temporary password for President")} <b>{resetClubTarget?.president?.full_name}</b>?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setResetClubTarget(null)} disabled={submitting}>
                        {t("cancel_btn", "Cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={handleResetPresidentPassword}
                        disabled={submitting}
                        sx={{ fontWeight: 800 }}
                    >
                        {submitting ? <CircularProgress size={24} /> : t("reset_password", "Reset Password")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================= DELETE CLUB CONFIRMATION MODAL ================= */}
            <Dialog
                open={Boolean(deleteClubTarget)}
                onClose={() => !submitting && setDeleteClubTarget(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: "error.main", display: "flex", alignItems: "center", gap: 1 }}>
                    <DeleteIcon /> {t("decommission_title", "Decommission Club Workspace?")}
                </DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Typography variant="body2">
                        {t("delete_confirm_msg", "Are you sure you want to permanently delete")} <b>{deleteClubTarget?.name}</b>? {t("delete_warning_details", "All associated members, chat rooms, dues, and meeting minutes will be removed.")}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteClubTarget(null)} disabled={submitting}>
                        {t("cancel_btn", "Cancel")}
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteClub}
                        disabled={submitting}
                        sx={{ fontWeight: 800 }}
                    >
                        {submitting ? <CircularProgress size={24} /> : t("confirm_delete_btn", "Confirm Delete")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================= ASSIGN PRESIDENT TO EXISTING CLUB DIALOG ================= */}
            <Dialog
                open={Boolean(assignPresidentClub)}
                onClose={() => !submitting && setAssignPresidentClub(null)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    👤 {t("assign_president", "Appoint Club President")} ({assignPresidentClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleAssignPresident}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField
                            fullWidth
                            required
                            label={t("president_name", "President Full Name")}
                            value={assignName}
                            onChange={(e) => setAssignName(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("president_email", "Email Address")}
                            value={assignEmail}
                            onChange={(e) => setAssignEmail(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label={t("phone_label", "Phone Number")}
                            value={assignPhone}
                            onChange={(e) => setAssignPhone(e.target.value)}
                            margin="normal"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setAssignPresidentClub(null)} disabled={submitting}>
                            {t("cancel_btn", "Cancel")}
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting} sx={{ fontWeight: 800 }}>
                            {submitting ? <CircularProgress size={24} /> : t("assign_president", "Appoint President")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* ================= FEATURE FLAGS MODAL ================= */}
            <Dialog
                open={Boolean(selectedClub)}
                onClose={() => setSelectedClub(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, bgcolor: "primary.main", color: "white" }}>
                    ⚙️ {t("feature_entitlements", "Feature Entitlements")}: {selectedClub?.name}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={1}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(selectedClub?.features?.video_calls)}
                                    onChange={(e) =>
                                        selectedClub &&
                                        setSelectedClub({
                                            ...selectedClub,
                                            features: { ...selectedClub.features, video_calls: e.target.checked },
                                        })
                                    }
                                    color="primary"
                                />
                            }
                            label={t("feat_video_calls", "Live Video Calling Module")}
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(selectedClub?.features?.mom_editor)}
                                    onChange={(e) =>
                                        selectedClub &&
                                        setSelectedClub({
                                            ...selectedClub,
                                            features: { ...selectedClub.features, mom_editor: e.target.checked },
                                        })
                                    }
                                    color="primary"
                                />
                            }
                            label={t("feat_mom_editor", "Word MOM Editor & Archives")}
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(selectedClub?.features?.social_feed)}
                                    onChange={(e) =>
                                        selectedClub &&
                                        setSelectedClub({
                                            ...selectedClub,
                                            features: { ...selectedClub.features, social_feed: e.target.checked },
                                        })
                                    }
                                    color="primary"
                                />
                            }
                            label={t("feat_social_feed", "Community Social Wall & Photos")}
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(selectedClub?.features?.dues_module)}
                                    onChange={(e) =>
                                        selectedClub &&
                                        setSelectedClub({
                                            ...selectedClub,
                                            features: { ...selectedClub.features, dues_module: e.target.checked },
                                        })
                                    }
                                    color="primary"
                                />
                            }
                            label={t("feat_dues_module", "Treasury & Membership Dues")}
                        />
                    </Stack>

                    <TextField
                        fullWidth
                        type="number"
                        label={t("max_members", "Maximum Member Quota")}
                        value={selectedClub?.features?.max_members || 50}
                        onChange={(e) =>
                            selectedClub &&
                            setSelectedClub({
                                ...selectedClub,
                                features: { ...selectedClub.features, max_members: parseInt(e.target.value) || 50 },
                            })
                        }
                        margin="normal"
                        sx={{ mt: 3 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setSelectedClub(null)}>{t("cancel_btn", "Cancel")}</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveFeatures} sx={{ fontWeight: 800 }}>
                        {t("save_entitlements", "Save Entitlements")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};