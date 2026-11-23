// chatup/frontend/src/pages/SuperAdminConsole.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardActionArea,
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
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Tooltip,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import { ChatUpLogo } from "../components/ChatUpLogo";
import { ClubBrandingModal } from "../components/ClubBrandingModal";
import { ClubSubscriptionModal } from "../components/ClubSubscriptionModal";
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
import GavelIcon from "@mui/icons-material/Gavel";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PaletteIcon from "@mui/icons-material/Palette";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SettingsIcon from "@mui/icons-material/Settings";
import { useTranslation } from "react-i18next";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";

interface PresidentInfo {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    is_active: boolean;
}

interface GovernorInfo {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    district: string;
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
    governor?: GovernorInfo | null;
    features: {
        video_calls: boolean;
        mom_editor: boolean;
        social_feed: boolean;
        dues_module: boolean;
        max_members: number;
        org_type?: string;
        organization_header?: string;
        plan_type?: string;
        billing_cycle?: string;
        subscription_status?: string;
        trial_ends_at?: string;
        next_billing_date?: string;
        custom_price_eur?: number | null;
    };
    theme_config?: {
        primary_color?: string;
        secondary_color?: string;
        logo_url?: string;
    };
}

interface DistrictGovernor {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    district: string;
    is_active: boolean;
    created_at: string;
    total_clubs: number;
    total_members: number;
    clubs: Array<{
        id: string;
        name: string;
        slug: string;
        member_count: number;
        president_name?: string;
        president_email?: string;
    }>;
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
    total_governors?: number;
    estimated_arr_eur?: number;
    trial_clubs?: number;
    paid_clubs?: number;
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
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const { lastEvent } = useRealtime();

    const [activeTab, setActiveTab] = useState<number>(initialTab);
    const [clubs, setClubs] = useState<Club[]>([]);
    const [governors, setGovernors] = useState<DistrictGovernor[]>([]);
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Global Pricing & Platform Settings State
    const [pricingConfig, setPricingConfig] = useState({
        per_member_monthly_eur: 0.86,
        per_member_yearly_eur: 8.60,
        club_executive_monthly_eur: 49.0,
        club_executive_yearly_eur: 490.0,
        association_pro_monthly_eur: 79.0,
        association_pro_yearly_eur: 790.0,
        district_bundle_yearly_eur: 320.0,
        one_time_setup_fee_eur: 0.0,
        waive_setup_fee_on_yearly: true,
        default_trial_days: 60,
        default_member_quota: 75,
        sepa_iban: "FI21 1234 5600 0007 85",
        sepa_bic: "NDEAFIHH",
    });
    const [savingConfig, setSavingConfig] = useState(false);
    const [configSuccess, setConfigSuccess] = useState("");

    // Onboard New Club (Universal Governance Mode)
    const [orgType, setOrgType] = useState<"STANDALONE" | "LIONS" | "FEDERATION">("STANDALONE");
    const [clubName, setClubName] = useState("");
    const [clubSlug, setClubSlug] = useState("");
    const [district, setDistrict] = useState("District 107-N (Helsinki Metropolitan)");
    const [customDistrict, setCustomDistrict] = useState("");
    const [customOrgHeader, setCustomOrgHeader] = useState("");
    const [presName, setPresName] = useState("");
    const [presEmail, setPresEmail] = useState("");
    const [presPhone, setPresPhone] = useState("");
    const [planType, setPlanType] = useState("CLUB_EXECUTIVE");
    const [billingCycle, setBillingCycle] = useState("YEARLY");
    const [featureVideo, setFeatureVideo] = useState(true);
    const [featureMOM, setFeatureMOM] = useState(true);
    const [featureSocial, setFeatureSocial] = useState(true);
    const [featureDues, setFeatureDues] = useState(true);
    const [maxMembers, setMaxMembers] = useState(75);

    // Appoint Governor State
    const [openGovDialog, setOpenGovDialog] = useState(false);
    const [govName, setGovName] = useState("");
    const [govEmail, setGovEmail] = useState("");
    const [govPhone, setGovPhone] = useState("");
    const [govDistrict, setGovDistrict] = useState("District 107-N (Helsinki Metropolitan)");

    // Edit Governor State
    const [editGovTarget, setEditGovTarget] = useState<GovernorInfo | DistrictGovernor | null>(null);
    const [editGovName, setEditGovName] = useState("");
    const [editGovEmail, setEditGovEmail] = useState("");
    const [editGovPhone, setEditGovPhone] = useState("");
    const [editGovDistrict, setEditGovDistrict] = useState("");

    // Edit President State
    const [editPresidentClub, setEditPresidentClub] = useState<Club | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");

    // Club Branding & Subscription Modals
    const [brandingClubTarget, setBrandingClubTarget] = useState<Club | null>(null);
    const [subscriptionClubTarget, setSubscriptionClubTarget] = useState<Club | null>(null);

    const [assignPresidentClub, setAssignPresidentClub] = useState<Club | null>(null);
    const [assignName, setAssignName] = useState("");
    const [assignEmail, setAssignEmail] = useState("");
    const [assignPhone, setAssignPhone] = useState("");

    const [resetClubTarget, setResetClubTarget] = useState<Club | null>(null);
    const [deleteClubTarget, setDeleteClubTarget] = useState<Club | null>(null);
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);
    const [credentials, setCredentials] = useState<ProvisionedCredentials | null>(null);
    const [copied, setCopied] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchPricingConfig = useCallback(async () => {
        try {
            const res = await apiClient.get("/admin/pricing-config");
            setPricingConfig(res.data);
        } catch { }
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const [clubsRes, teleRes, govRes] = await Promise.all([
                apiClient.get("/admin/clubs", {
                    params: {
                        search: searchQuery || undefined,
                        status_filter: statusFilter !== "all" ? statusFilter : undefined,
                    },
                }),
                apiClient.get("/admin/stats"),
                apiClient.get("/admin/governors").catch(() => ({ data: [] })),
            ]);
            setClubs(clubsRes.data);
            setTelemetry(teleRes.data);
            setGovernors(govRes.data);
            fetchPricingConfig();
        } catch (err) {
            console.error("Failed to load SaaS telemetry or clubs:", err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, statusFilter, fetchPricingConfig]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        if (lastEvent?.type === "PLATFORM_UPDATE") {
            fetchDashboardData();
        }
    }, [lastEvent, fetchDashboardData]);

    const handleSavePricingConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingConfig(true);
        setConfigSuccess("");
        try {
            await apiClient.put("/admin/pricing-config", pricingConfig);
            setConfigSuccess(t("pricing_saved_msg", "Global pricing and billing settings updated successfully!"));
            setTimeout(() => setConfigSuccess(""), 3500);
            fetchDashboardData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to save settings");
        } finally {
            setSavingConfig(false);
        }
    };

    const handleCreateClub = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const resolvedDistrict =
            orgType === "STANDALONE"
                ? "Independent Association"
                : orgType === "LIONS"
                    ? district.trim()
                    : customDistrict.trim() || "Federated Association";

        try {
            const res = await apiClient.post("/admin/clubs", {
                name: clubName.trim(),
                slug: clubSlug.toLowerCase().trim(),
                district: resolvedDistrict,
                president_name: presName.trim() || undefined,
                president_email: presEmail.trim() ? presEmail.toLowerCase().trim() : undefined,
                president_phone: presPhone.trim() || undefined,
                features: {
                    video_calls: featureVideo,
                    mom_editor: featureMOM,
                    social_feed: featureSocial,
                    dues_module: featureDues,
                    max_members: maxMembers,
                    org_type: orgType,
                    organization_header: customOrgHeader.trim() || undefined,
                    plan_type: planType,
                    billing_cycle: billingCycle,
                    subscription_status: "TRIAL",
                },
            });

            if (res.data?.credentials) {
                setCredentials(res.data.credentials);
            }

            setClubName("");
            setClubSlug("");
            setCustomDistrict("");
            setCustomOrgHeader("");
            setPresName("");
            setPresEmail("");
            setPresPhone("");
            setActiveTab(0);
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to provision new club workspace");
        } finally {
            setSubmitting(false);
        }
    };

    const handleAppointGovernor = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const res = await apiClient.post("/admin/governors", {
                full_name: govName.trim(),
                email: govEmail.toLowerCase().trim(),
                phone_number: govPhone.trim() || undefined,
                district: govDistrict,
            });

            if (res.data.credentials) {
                setCredentials(res.data.credentials);
            }

            setOpenGovDialog(false);
            setGovName("");
            setGovEmail("");
            setGovPhone("");
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to appoint District Governor");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditGovernorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editGovTarget) return;
        setError(null);
        setSubmitting(true);
        try {
            await apiClient.patch(`/admin/governors/${editGovTarget.id}`, {
                full_name: editGovName.trim(),
                email: editGovEmail.toLowerCase().trim(),
                phone_number: editGovPhone.trim() || null,
                district: editGovDistrict,
            });
            setEditGovTarget(null);
            fetchDashboardData();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to update governor details");
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetGovernorPassword = async (govId: string) => {
        if (!window.confirm("Regenerate temporary credentials for this District Governor?")) return;
        try {
            const res = await apiClient.post(`/admin/governors/${govId}/reset-password`);
            if (res.data.credentials) {
                setCredentials(res.data.credentials);
            }
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to reset governor password");
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
                            Governors / Presidents
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: "#b78103", mt: 0.5 }}>
                            {telemetry.total_governors || 0} / {telemetry.total_presidents}
                        </Typography>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3.5, p: 2, borderLeft: "5px solid #C2185B" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                            {t("kpi_estimated_arr", "Projected ARR")}
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: "#C2185B", mt: 0.5 }}>
                            €{telemetry.estimated_arr_eur || 0}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                            {telemetry.paid_clubs || 0} Paid • {telemetry.trial_clubs || 0} Trial
                        </Typography>
                    </Card>
                </Box>
            )}

            {/* Navigation Tabs (Icons-Only on Mobile with 5th Settings Tab) */}
            <Card elevation={1} sx={{ borderRadius: 3.5, mb: 4, bgcolor: "background.paper" }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, val) => setActiveTab(val)}
                    variant="fullWidth"
                    sx={{
                        "& .MuiTab-root": {
                            minHeight: { xs: 50, sm: 56 },
                            minWidth: { xs: 0, sm: 80 },
                            px: { xs: 0.5, sm: 1.5 },
                            fontWeight: 800,
                            fontSize: { xs: "0.72rem", sm: "0.92rem" },
                            textTransform: "none",
                        },
                    }}
                >
                    <Tab
                        icon={<Tooltip title={t("tab_directory", "Club Directory & Governance")}><DomainIcon /></Tooltip>}
                        iconPosition={isMobile ? "top" : "start"}
                        label={isMobile ? undefined : t("tab_directory", "Club Directory")}
                        aria-label="Club Directory"
                    />
                    <Tab
                        icon={<Tooltip title={t("tab_onboard", "Register & Onboard New Club")}><AddBusinessIcon /></Tooltip>}
                        iconPosition={isMobile ? "top" : "start"}
                        label={isMobile ? undefined : t("tab_onboard", "Onboard Club")}
                        aria-label="Onboard New Club"
                    />
                    <Tab
                        icon={<Tooltip title={`District Governors (${governors.length})`}><GavelIcon /></Tooltip>}
                        iconPosition={isMobile ? "top" : "start"}
                        label={isMobile ? undefined : `Governors (${governors.length})`}
                        aria-label="District Governors"
                    />
                    <Tab
                        icon={<Tooltip title={t("tab_telemetry", "Telemetry & Infrastructure")}><SpeedIcon /></Tooltip>}
                        iconPosition={isMobile ? "top" : "start"}
                        label={isMobile ? undefined : t("tab_telemetry", "Telemetry")}
                        aria-label="Telemetry"
                    />
                    <Tab
                        icon={<Tooltip title={t("tab_platform_settings", "Global Platform Pricing & Settings")}><SettingsIcon /></Tooltip>}
                        iconPosition={isMobile ? "top" : "start"}
                        label={isMobile ? undefined : t("tab_platform_settings", "Pricing & Settings")}
                        aria-label="Platform Settings"
                    />
                </Tabs>
            </Card>

            {/* ================= TAB 0: CLUB DIRECTORY & GOVERNANCE ================= */}
            {activeTab === 0 && (
                <Box>
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
                            {clubs.map((club) => {
                                const subStatus = club.features?.subscription_status || "TRIAL";
                                const planLabel = (club.features?.plan_type || "CLUB_EXECUTIVE").replace(/_/g, " ");
                                const clubOrgType = club.features?.org_type || "LIONS";
                                const isStandalone = clubOrgType === "STANDALONE";

                                return (
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
                                                    <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C", display: "flex", alignItems: "center", gap: 1 }}>
                                                        <ChatUpLogo size={32} srcOverride={club.theme_config?.logo_url} /> {club.name}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                        Slug: <b>{club.slug}</b> {club.district && ` • ${club.district}`}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                                                    <Chip
                                                        label={clubOrgType}
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 800 }}
                                                    />
                                                    <Chip
                                                        icon={<WorkspacePremiumIcon sx={{ fontSize: "16px !important" }} />}
                                                        label={`${planLabel} • ${subStatus}`}
                                                        color={subStatus === "ACTIVE" ? "success" : subStatus === "TRIAL" ? "warning" : "error"}
                                                        variant="outlined"
                                                        size="small"
                                                        sx={{ fontWeight: 800 }}
                                                    />
                                                    <Chip
                                                        label={club.is_active ? t("active_status", "Active") : t("suspended_status", "Suspended")}
                                                        color={club.is_active ? "success" : "error"}
                                                        size="small"
                                                        sx={{ fontWeight: 800 }}
                                                    />
                                                    <Chip
                                                        label={`${club.member_count} / ${club.features?.max_members || 50} ${t("members_count_label", "Members")}`}
                                                        color={club.member_count === 0 ? "warning" : "default"}
                                                        variant={club.member_count === 0 ? "filled" : "outlined"}
                                                        size="small"
                                                        sx={{ fontWeight: 700 }}
                                                    />
                                                </Box>
                                            </Box>

                                            {/* Governance Block */}
                                            {isStandalone ? (
                                                <Card
                                                    variant="outlined"
                                                    sx={{
                                                        p: 1.8,
                                                        mb: 1.5,
                                                        bgcolor: "rgba(46, 125, 50, 0.04)",
                                                        borderColor: "rgba(46, 125, 50, 0.25)",
                                                        borderRadius: 2.5,
                                                    }}
                                                >
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#2e7d32" }}>
                                                        🏛️ {t("standalone_gov_badge", "Governance: Standalone Independent Association (Direct Local Board)")}
                                                    </Typography>
                                                </Card>
                                            ) : (
                                                <Card
                                                    variant="outlined"
                                                    sx={{
                                                        p: 2,
                                                        mb: 1.5,
                                                        bgcolor: "rgba(0, 47, 108, 0.04)",
                                                        borderColor: "rgba(0, 47, 108, 0.2)",
                                                        borderRadius: 2.5,
                                                        display: "flex",
                                                        flexDirection: { xs: "column", sm: "row" },
                                                        justifyContent: "space-between",
                                                        alignItems: { xs: "flex-start", sm: "center" },
                                                        gap: 1.5,
                                                    }}
                                                >
                                                    <Box>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#002F6C" }}>
                                                            🏛️ {t("district_governor_regional_head", "District Governor / Regional Head")} : {club.governor ? club.governor.full_name : "Unassigned Governor"}
                                                        </Typography>
                                                        {club.governor ? (
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                                {t("email_address", "Email Address")} : <b>{club.governor.email}</b> {club.governor.phone_number && `• Phone: ${club.governor.phone_number}`} • Jurisdiction: <b>{club.governor.district}</b>
                                                            </Typography>
                                                        ) : (
                                                            <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
                                                                {t("no_regional_governor_commissioned_for_this_district_yet", "No regional governor commissioned for this district yet.")}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    {club.governor && (
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            startIcon={<EditIcon />}
                                                            onClick={() => {
                                                                if (club.governor) {
                                                                    setEditGovTarget(club.governor);
                                                                    setEditGovName(club.governor.full_name);
                                                                    setEditGovEmail(club.governor.email);
                                                                    setEditGovPhone(club.governor.phone_number || "");
                                                                    setEditGovDistrict(club.governor.district);
                                                                }
                                                            }}
                                                            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                                                        >
                                                            {t("edit_governor", "Edit Governor")}
                                                        </Button>
                                                    )}
                                                </Card>
                                            )}

                                            {/* Club President Block */}
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
                                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
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
                                                    </Box>
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

                                            <Box sx={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 1.2 }}>
                                                <Button
                                                    variant="outlined"
                                                    color="secondary"
                                                    startIcon={<WorkspacePremiumIcon />}
                                                    size="small"
                                                    onClick={() => setSubscriptionClubTarget(club)}
                                                    sx={{ fontWeight: 800, minHeight: 40, borderRadius: 2.5 }}
                                                >
                                                    {t("manage_plan_btn", "Manage Plan")}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    color="primary"
                                                    startIcon={<PaletteIcon />}
                                                    size="small"
                                                    onClick={() => setBrandingClubTarget(club)}
                                                    sx={{ fontWeight: 800, minHeight: 40, borderRadius: 2.5 }}
                                                >
                                                    {t("branding_crest_btn", "Branding & Crest")}
                                                </Button>
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
                                            </Box>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Stack>
                    )}
                </Box>
            )}

            {/* ================= TAB 1: REGISTER & ONBOARD NEW CLUB ================= */}
            {activeTab === 1 && (
                <Card elevation={3} sx={{ borderRadius: 4, p: { xs: 2.5, sm: 4.5 } }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: "#002F6C" }}>
                            🚀 {t("onboard_title", "Provision New Community Club Workspace")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {t("onboard_universal_subtitle", "Configure either a Standalone Independent Association or a Multi-Tier District Club with 60-day pilot access.")}
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2.5 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleCreateClub}>
                        <Stack spacing={3}>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 1.5 }}>
                                    {t("org_governance_section", "1. Organization Type & Governance Model")}
                                </Typography>
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                                    {[
                                        {
                                            id: "STANDALONE" as const,
                                            title: t("org_standalone_title", "Standalone Independent Club"),
                                            desc: t("org_standalone_desc", "No District Governor. Managed directly by local President & Board."),
                                            icon: <GroupsIcon sx={{ fontSize: 32, color: orgType === "STANDALONE" ? "#002F6C" : "text.secondary" }} />,
                                        },
                                        {
                                            id: "LIONS" as const,
                                            title: t("org_lions_title", "Lions District Club"),
                                            desc: t("org_lions_desc", "Multi-tier hierarchy overseen by a Lions District Governor."),
                                            icon: <PublicIcon sx={{ fontSize: 32, color: orgType === "LIONS" ? "#002F6C" : "text.secondary" }} />,
                                        },
                                        {
                                            id: "FEDERATION" as const,
                                            title: t("org_federation_title", "Rotary / Other Federation"),
                                            desc: t("org_federation_desc", "Rotary district, union, or federated association."),
                                            icon: <AccountTreeIcon sx={{ fontSize: 32, color: orgType === "FEDERATION" ? "#002F6C" : "text.secondary" }} />,
                                        },
                                    ].map((modeOption) => {
                                        const isSelected = orgType === modeOption.id;
                                        return (
                                            <Card
                                                key={modeOption.id}
                                                variant="outlined"
                                                sx={{
                                                    borderRadius: 3,
                                                    borderWidth: isSelected ? 2 : 1,
                                                    borderColor: isSelected ? "#002F6C" : "divider",
                                                    bgcolor: isSelected ? "rgba(0, 47, 108, 0.04)" : "background.paper",
                                                    transition: "all 0.2s",
                                                }}
                                            >
                                                <CardActionArea onClick={() => setOrgType(modeOption.id)} sx={{ p: 2, height: "100%" }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                                                        {modeOption.icon}
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 900, color: isSelected ? "#002F6C" : "text.primary" }}>
                                                            {modeOption.title}
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
                                                        {modeOption.desc}
                                                    </Typography>
                                                </CardActionArea>
                                            </Card>
                                        );
                                    })}
                                </Box>
                            </Box>

                            <Divider />

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                                <TextField
                                    fullWidth
                                    required
                                    label={t("club_name", "Official Club / Association Name")}
                                    value={clubName}
                                    onChange={(e) => {
                                        setClubName(e.target.value);
                                        if (!clubSlug) {
                                            setClubSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"));
                                        }
                                    }}
                                    placeholder="e.g. Helsinki Rotary / Kulttuuriyhdistys"
                                />

                                <TextField
                                    fullWidth
                                    required
                                    label={t("club_slug", "Unique Workspace Identifier (Slug)")}
                                    value={clubSlug}
                                    onChange={(e) => setClubSlug(e.target.value)}
                                    placeholder="e.g. helsinki-society"
                                />
                            </Box>

                            {orgType === "LIONS" && (
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
                            )}

                            {orgType === "FEDERATION" && (
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                                    <TextField
                                        fullWidth
                                        required
                                        label={t("custom_district_label", "District / Federation Name")}
                                        value={customDistrict}
                                        onChange={(e) => setCustomDistrict(e.target.value)}
                                        placeholder="e.g. Rotary District 1420"
                                    />
                                    <TextField
                                        fullWidth
                                        label={t("custom_org_header_label", "Official Card & Letterhead Header (Optional)")}
                                        value={customOrgHeader}
                                        onChange={(e) => setCustomOrgHeader(e.target.value)}
                                        placeholder="e.g. ROTARY INTERNATIONAL"
                                    />
                                </Box>
                            )}

                            {orgType === "STANDALONE" && (
                                <TextField
                                    fullWidth
                                    label={t("custom_org_header_label", "Official Card & Letterhead Header (Optional)")}
                                    value={customOrgHeader}
                                    onChange={(e) => setCustomOrgHeader(e.target.value)}
                                    placeholder="e.g. HELSINKI CULTURAL SOCIETY (Leave blank for club name)"
                                />
                            )}

                            <Box sx={{ pt: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main", mb: 0.5 }}>
                                    {t("inaugural_president_section", "2. Inaugural President / Chairperson (1-Step Setup)")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                                    {orgType === "STANDALONE"
                                        ? t("standalone_pres_required_note", "Required for Standalone Clubs: Automatically generates temporary credentials for the Club President.")
                                        : t("district_pres_optional_note", "Optional: Leave blank if you prefer the District Governor to appoint the President later.")}
                                </Typography>

                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                                    <TextField
                                        fullWidth
                                        required={orgType === "STANDALONE"}
                                        label={t("president_name", "President / Chair Full Name")}
                                        value={presName}
                                        onChange={(e) => setPresName(e.target.value)}
                                        placeholder="Matti Virtanen"
                                    />
                                    <TextField
                                        fullWidth
                                        required={orgType === "STANDALONE"}
                                        type="email"
                                        label={t("president_email", "Official Email Address")}
                                        value={presEmail}
                                        onChange={(e) => setPresEmail(e.target.value)}
                                        placeholder="chair@club.fi"
                                    />
                                    <TextField
                                        fullWidth
                                        label={t("phone_label", "Phone Number")}
                                        value={presPhone}
                                        onChange={(e) => setPresPhone(e.target.value)}
                                        placeholder="+358 40 1234567"
                                    />
                                </Box>
                            </Box>

                            <Divider />

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                                <FormControl fullWidth>
                                    <InputLabel>{t("select_plan_label", "Subscription Package")}</InputLabel>
                                    <Select
                                        value={planType}
                                        label={t("select_plan_label", "Subscription Package")}
                                        onChange={(e) => {
                                            const p = e.target.value;
                                            setPlanType(p);
                                            if (p === "FLEX_PER_PERSON") setMaxMembers(35);
                                            else if (p === "CLUB_EXECUTIVE") setMaxMembers(75);
                                            else if (p === "ASSOCIATION_PRO") setMaxMembers(200);
                                            else if (p === "DISTRICT_BUNDLE") setMaxMembers(100);
                                        }}
                                    >
                                        <MenuItem value="FLEX_PER_PERSON">Flex Per-Person (€{pricingConfig.per_member_monthly_eur.toFixed(2)}/mo or €{pricingConfig.per_member_yearly_eur.toFixed(2)}/yr)</MenuItem>
                                        <MenuItem value="CLUB_EXECUTIVE">Club Executive Flat (€{pricingConfig.club_executive_monthly_eur.toFixed(0)}/mo or €{pricingConfig.club_executive_yearly_eur.toFixed(0)}/yr)</MenuItem>
                                        <MenuItem value="ASSOCIATION_PRO">Association Pro Flat (€{pricingConfig.association_pro_monthly_eur.toFixed(0)}/mo or €{pricingConfig.association_pro_yearly_eur.toFixed(0)}/yr)</MenuItem>
                                        <MenuItem value="DISTRICT_BUNDLE">District Wholesale (€{pricingConfig.district_bundle_yearly_eur.toFixed(0)}/club/yr)</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl fullWidth>
                                    <InputLabel>{t("billing_cycle_label", "Billing Cycle")}</InputLabel>
                                    <Select
                                        value={billingCycle}
                                        label={t("billing_cycle_label", "Billing Cycle")}
                                        onChange={(e) => setBillingCycle(e.target.value)}
                                        disabled={planType === "DISTRICT_BUNDLE"}
                                    >
                                        <MenuItem value="YEARLY">Yearly (Save ~17% • SEPA Invoice)</MenuItem>
                                        <MenuItem value="MONTHLY">Monthly (Flexible)</MenuItem>
                                    </Select>
                                </FormControl>
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
                                    sx={{ minHeight: 52, borderRadius: 3, fontWeight: 900, px: 4, bgcolor: "#002F6C" }}
                                >
                                    {submitting ? <CircularProgress size={26} color="inherit" /> : t("create_workspace_btn", "Create Club Workspace")}
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Card>
            )}

            {/* ================= TAB 2: DISTRICT GOVERNORS HIERARCHY & MANAGEMENT ================= */}
            {activeTab === 2 && (
                <Card elevation={3} sx={{ borderRadius: 4, p: { xs: 2.5, sm: 4 } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                🏛️ District Governors Regional Hierarchy
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("regional_oversight", "Regional oversight: inspect each Governor's chartered clubs, presidents, and membership totals.")}
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<PersonAddAlt1Icon />}
                            onClick={() => setOpenGovDialog(true)}
                            sx={{ bgcolor: "#002F6C", fontWeight: 800, borderRadius: 2.5, textTransform: "none" }}
                        >
                            {t("appoint_district_governor", "Appoint District Governor")}
                        </Button>
                    </Box>

                    {governors.length === 0 ? (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                            <Typography color="text.secondary" variant="h6">
                                {t("no_district_governors", "No District Governors appointed yet.")}
                            </Typography>
                        </Paper>
                    ) : (
                        <Stack spacing={2.5}>
                            {governors.map((gov) => (
                                <Accordion key={gov.id} elevation={2} defaultExpanded sx={{ borderRadius: "16px !important", overflow: "hidden", border: "1.5px solid rgba(0, 47, 108, 0.15)" }}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "rgba(0, 47, 108, 0.03)", px: 3, py: 1.5 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", pr: 2, flexWrap: "wrap", gap: 2 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                    🏛️ {gov.full_name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                                    {gov.email} {gov.phone_number && `• ${gov.phone_number}`}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                                                <Chip label={gov.district} color="primary" sx={{ fontWeight: 800 }} />
                                                <Chip label={`${gov.total_clubs} Clubs`} color="default" variant="outlined" sx={{ fontWeight: 800 }} />
                                                <Chip label={`${gov.total_members} Members`} color="success" variant="outlined" sx={{ fontWeight: 800 }} />
                                            </Box>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 3 }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary" }}>
                                                Clubs chartered under this Governor's jurisdiction:
                                            </Typography>
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => {
                                                        setEditGovTarget(gov);
                                                        setEditGovName(gov.full_name);
                                                        setEditGovEmail(gov.email);
                                                        setEditGovPhone(gov.phone_number || "");
                                                        setEditGovDistrict(gov.district);
                                                    }}
                                                    sx={{ fontWeight: 700, borderRadius: 2 }}
                                                >
                                                    Edit Governor Details
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="warning"
                                                    startIcon={<LockResetIcon />}
                                                    onClick={() => handleResetGovernorPassword(gov.id)}
                                                    sx={{ fontWeight: 700, borderRadius: 2 }}
                                                >
                                                    Reset Password
                                                </Button>
                                            </Box>
                                        </Box>

                                        {gov.clubs && gov.clubs.length > 0 ? (
                                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                                                {gov.clubs.map((c) => (
                                                    <Paper key={c.id} elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2.5, borderLeft: "4px solid #002F6C" }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
                                                            <ChatUpLogo size={22} /> {c.name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                                            Slug: <b>{c.slug}</b> • Active Members: <b>{c.member_count}</b>
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ fontWeight: 700, color: c.president_name ? "success.main" : "warning.main", mt: 0.5, display: "block" }}>
                                                            {c.president_name ? `👑 President: ${c.president_name} (${c.president_email})` : "⚠️ No President Appointed"}
                                                        </Typography>
                                                    </Paper>
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                                No clubs chartered in this district yet.
                                            </Typography>
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                        </Stack>
                    )}
                </Card>
            )}

            {/* ================= TAB 3: TELEMETRY & INFRASTRUCTURE ================= */}
            {activeTab === 3 && (
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
                    </Card>

                    <Card elevation={2} sx={{ p: 3, borderRadius: 3.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                            <SecurityIcon color="primary" />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("infra_sec_title", "Security & Realtime Bus")}</Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Global Event Bus:</b> WebSocket Broadcast (`/ws/global/sync`)</Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}><b>Web Push Engine:</b> RFC 8030 VAPID Protocol</Typography>
                    </Card>
                </Box>
            )}

            {/* ================= TAB 4: GLOBAL PLATFORM SETTINGS & PRICING ================= */}
            {activeTab === 4 && (
                <Box component="form" onSubmit={handleSavePricingConfig}>
                    <Stack spacing={3}>
                        {configSuccess && (
                            <Alert severity="success" sx={{ borderRadius: 3 }}>
                                {configSuccess}
                            </Alert>
                        )}

                        <Card elevation={2} sx={{ borderRadius: 3.5, p: { xs: 2.5, sm: 3.5 } }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                                <WorkspacePremiumIcon sx={{ color: "#F2A900", fontSize: 28 }} />
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                                        {t("global_pricing_title", "Global SaaS Subscription Pricing & Tiers")}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Configure live subscription rates for standalone clubs, district wholesale, and per-seat models.
                                    </Typography>
                                </Box>
                            </Box>
                            <Divider sx={{ mb: 3 }} />

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2.5 }}>
                                <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                                        1. Flex Per-Member Tier (Micro Clubs 5–20)
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Monthly Rate (€ / member / month)"
                                            value={pricingConfig.per_member_monthly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, per_member_monthly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Yearly Rate (€ / member / year • Discounted)"
                                            value={pricingConfig.per_member_yearly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, per_member_yearly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                    </Stack>
                                </Paper>

                                <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                                        2. Club Executive Flat Tier (Lions/Rotary 21–75)
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Monthly Flat Rate (€ / club / month)"
                                            value={pricingConfig.club_executive_monthly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, club_executive_monthly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Yearly Flat Rate (€ / club / year • Popular)"
                                            value={pricingConfig.club_executive_yearly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, club_executive_yearly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                    </Stack>
                                </Paper>

                                <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                                        3. Association Pro Flat Tier (Societies 76–200)
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Monthly Flat Rate (€ / club / month)"
                                            value={pricingConfig.association_pro_monthly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, association_pro_monthly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Yearly Flat Rate (€ / club / year)"
                                            value={pricingConfig.association_pro_yearly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, association_pro_yearly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                    </Stack>
                                </Paper>

                                <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 2.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main", mb: 1 }}>
                                        4. District Wholesale & Default Pilot Duration
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="District Wholesale Rate (€ / club / year)"
                                            value={pricingConfig.district_bundle_yearly_eur}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, district_bundle_yearly_eur: parseFloat(e.target.value) || 0 })}
                                            slotProps={{ input: { startAdornment: <InputAdornment position="start">€</InputAdornment> } }}
                                        />
                                        <TextField
                                            fullWidth
                                            type="number"
                                            size="small"
                                            label="Free Pilot Trial Duration (Days)"
                                            value={pricingConfig.default_trial_days}
                                            onChange={(e) => setPricingConfig({ ...pricingConfig, default_trial_days: parseInt(e.target.value) || 60 })}
                                        />
                                    </Stack>
                                </Paper>
                            </Box>
                        </Card>

                        <Card elevation={2} sx={{ borderRadius: 3.5, p: { xs: 2.5, sm: 3.5 } }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main", mb: 0.5 }}>
                                🏛️ {t("platform_sepa_title", "Platform SEPA Bank Account (For Invoicing Clubs)")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                                These bank details appear on official SEPA invoices sent to Club Treasurers across Finland & Europe.
                            </Typography>
                            <Divider sx={{ mb: 2.5 }} />

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Platform IBAN"
                                    value={pricingConfig.sepa_iban}
                                    onChange={(e) => setPricingConfig({ ...pricingConfig, sepa_iban: e.target.value })}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Bank BIC / SWIFT"
                                    value={pricingConfig.sepa_bic}
                                    onChange={(e) => setPricingConfig({ ...pricingConfig, sepa_bic: e.target.value })}
                                />
                            </Box>
                        </Card>

                        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={savingConfig}
                                sx={{ fontWeight: 900, bgcolor: "#002F6C", borderRadius: 3, px: 4, minHeight: 48 }}
                            >
                                {savingConfig ? <CircularProgress size={24} color="inherit" /> : "Save Platform Settings"}
                            </Button>
                        </Box>
                    </Stack>
                </Box>
            )}

            {/* Club Subscription & Hybrid Billing Modal */}
            {subscriptionClubTarget && (
                <ClubSubscriptionModal
                    open={Boolean(subscriptionClubTarget)}
                    onClose={() => setSubscriptionClubTarget(null)}
                    clubId={subscriptionClubTarget.id}
                    clubName={subscriptionClubTarget.name}
                    memberCount={subscriptionClubTarget.member_count}
                    currentFeatures={subscriptionClubTarget.features}
                    onSuccess={fetchDashboardData}
                />
            )}

            {/* Club Branding Customizer Modal */}
            {brandingClubTarget && (
                <ClubBrandingModal
                    open={Boolean(brandingClubTarget)}
                    onClose={() => setBrandingClubTarget(null)}
                    clubId={brandingClubTarget.id}
                    isAdminMode={true}
                    currentPrimary={brandingClubTarget.theme_config?.primary_color}
                    currentSecondary={brandingClubTarget.theme_config?.secondary_color}
                    currentLogo={brandingClubTarget.theme_config?.logo_url}
                    onSuccess={fetchDashboardData}
                />
            )}

            {/* Appoint District Governor Modal */}
            <Dialog open={openGovDialog} onClose={() => !submitting && setOpenGovDialog(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    🏛️ {t("appoint_district_governor", "Appoint District Governor (Piirikuvernööri)")}
                </DialogTitle>
                <Box component="form" onSubmit={handleAppointGovernor}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <TextField
                            fullWidth
                            required
                            label={t("governor_full_name", "Governor Full Name")}
                            value={govName}
                            onChange={(e) => setGovName(e.target.value)}
                            margin="normal"
                            placeholder="Tapani Rahko"
                        />

                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("official_email_address", "Official Email Address")}
                            value={govEmail}
                            onChange={(e) => setGovEmail(e.target.value)}
                            margin="normal"
                            placeholder="governor@lionsdistrict107.fi"
                        />

                        <TextField
                            fullWidth
                            label={t("phone_number", "Phone Number")}
                            value={govPhone}
                            onChange={(e) => setGovPhone(e.target.value)}
                            margin="normal"
                            placeholder="+358 40 9876543"
                        />

                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>{t("assigned_district_jurisdiction", "Assigned District Jurisdiction")}</InputLabel>
                            <Select
                                value={govDistrict}
                                label={t("assigned_district_jurisdiction", "Assigned District Jurisdiction")}
                                onChange={(e) => setGovDistrict(e.target.value)}
                            >
                                {NORDIC_DISTRICTS.map((dist) => (
                                    <MenuItem key={dist} value={dist}>
                                        {dist}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenGovDialog(false)} disabled={submitting}>{t("cancel", "Cancel")}</Button>
                        <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {submitting ? <CircularProgress size={24} color="inherit" /> : t("commission_governor", "Commission Governor")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Edit District Governor Modal */}
            <Dialog open={Boolean(editGovTarget)} onClose={() => !submitting && setEditGovTarget(null)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    ✏️ Edit Governor Details
                </DialogTitle>
                <Box component="form" onSubmit={handleEditGovernorSubmit}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <TextField
                            fullWidth
                            required
                            label={t("governor_full_name", "Governor Full Name")}
                            value={editGovName}
                            onChange={(e) => setEditGovName(e.target.value)}
                            margin="normal"
                        />

                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("official_email_address", "Official Email Address")}
                            value={editGovEmail}
                            onChange={(e) => setEditGovEmail(e.target.value)}
                            margin="normal"
                        />

                        <TextField
                            fullWidth
                            label={t("phone_number", "Phone Number")}
                            value={editGovPhone}
                            onChange={(e) => setEditGovPhone(e.target.value)}
                            margin="normal"
                        />

                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>{t("assigned_district_jurisdiction", "Assigned District Jurisdiction")}</InputLabel>
                            <Select
                                value={editGovDistrict}
                                label={t("assigned_district_jurisdiction", "Assigned District Jurisdiction")}
                                onChange={(e) => setEditGovDistrict(e.target.value)}
                            >
                                {NORDIC_DISTRICTS.map((dist) => (
                                    <MenuItem key={dist} value={dist}>
                                        {dist}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditGovTarget(null)} disabled={submitting}>{t("cancel", "Cancel")}</Button>
                        <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {submitting ? <CircularProgress size={24} color="inherit" /> : t("save_changes", "Save Changes")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Credentials Generated Modal */}
            <Dialog open={Boolean(credentials)} onClose={() => setCredentials(null)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "#2e7d32", color: "white", fontWeight: 800 }}>
                    <CheckCircleIcon /> {t("credentials_generated", "Credentials Generated")}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                        {t("share_these_temporary_login_credentials_securely_with_the_officer", "Share these temporary login credentials securely with the officer")}:
                    </Typography>

                    <Card variant="outlined" sx={{ p: 2, bgcolor: "action.hover", mb: 2, borderRadius: 2.5 }}>
                        <Typography variant="caption" color="text.secondary">{t("workspace_district", "Workspace / District")}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.club_name}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("officer_name", "Officer Name")}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.president_name}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("login_email", "Login Email")}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>{credentials?.email}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("temporary_password", "Temporary Password")}</Typography>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", color: "#002F6C", fontWeight: 900 }}>
                            {credentials?.temp_password}
                        </Typography>
                    </Card>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
                    <Button
                        startIcon={copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                        onClick={() => copyToClipboard(`ChatUp Portal: https://chatup-frontend-steel.vercel.app\nEmail: ${credentials?.email}\nPassword: ${credentials?.temp_password}`)}
                        sx={{ fontWeight: 800 }}
                    >
                        {copied ? t("copied", "Copied!") : t("copy_credentials", "Copy Credentials")}
                    </Button>
                    <Button variant="contained" onClick={() => setCredentials(null)} sx={{ fontWeight: 800 }}>
                        {t("done", "Done")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit President Contact Dialog */}
            <Dialog open={Boolean(editPresidentClub)} onClose={() => !submitting && setEditPresidentClub(null)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    ✏️ {t("edit_president", "Edit President Information")} ({editPresidentClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleSavePresidentDetails}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField fullWidth required label="Full Name" value={editName} onChange={(e) => setEditName(e.target.value)} margin="normal" />
                        <TextField fullWidth required type="email" label="Email Address" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} margin="normal" />
                        <TextField fullWidth label="Phone Number" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} margin="normal" />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditPresidentClub(null)} disabled={submitting}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting} sx={{ fontWeight: 800 }}>
                            {submitting ? <CircularProgress size={24} /> : "Save Changes"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Reset President Password Dialog */}
            <Dialog open={Boolean(resetClubTarget)} onClose={() => !submitting && setResetClubTarget(null)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800, color: "warning.main", display: "flex", alignItems: "center", gap: 1 }}>
                    <LockResetIcon /> {t("reset_president_credentials", "Reset President Credentials?")}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {t("regenerate_a_new_temporary_password_for_president", "Regenerate a new temporary password for President")} <b>{resetClubTarget?.president?.full_name}</b>?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setResetClubTarget(null)} disabled={submitting}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={handleResetPresidentPassword} disabled={submitting} sx={{ fontWeight: 800 }}>
                        {submitting ? <CircularProgress size={24} /> : t("reset_password", "Reset Password")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Club Dialog */}
            <Dialog open={Boolean(deleteClubTarget)} onClose={() => !submitting && setDeleteClubTarget(null)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800, color: "error.main", display: "flex", alignItems: "center", gap: 1 }}>
                    <DeleteIcon /> {t("delete_club_workspace", "Delete Club Workspace?")}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {t("permanently_delete", "Permanently delete")} <b>{deleteClubTarget?.name}</b> {t("and_all_associated_records", "and all associated records?")}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteClubTarget(null)} disabled={submitting}>{t("cancel", "Cancel")}</Button>
                    <Button variant="contained" color="error" onClick={handleDeleteClub} disabled={submitting} sx={{ fontWeight: 800 }}>
                        {submitting ? <CircularProgress size={24} /> : t("confirm_delete", "Confirm Delete")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Assign President Dialog */}
            <Dialog open={Boolean(assignPresidentClub)} onClose={() => !submitting && setAssignPresidentClub(null)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    👤 {t("appoint_club_president", "Appoint Club President")} ({assignPresidentClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleAssignPresident}>
                    <DialogContent dividers>
                        <TextField fullWidth required label={t("full_name", "Full Name")} value={assignName} onChange={(e) => setAssignName(e.target.value)} margin="normal" />
                        <TextField fullWidth required type="email" label={t("email_address", "Email Address")} value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} margin="normal" />
                        <TextField fullWidth label={t("phone_number", "Phone Number")} value={assignPhone} onChange={(e) => setAssignPhone(e.target.value)} margin="normal" />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setAssignPresidentClub(null)} disabled={submitting}>{t("cancel", "Cancel")}</Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting} sx={{ fontWeight: 800 }}>
                            {submitting ? <CircularProgress size={24} /> : t("appoint_president", "Appoint President")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Feature Flags Modal */}
            <Dialog open={Boolean(selectedClub)} onClose={() => setSelectedClub(null)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800, bgcolor: "primary.main", color: "white" }}>
                    ⚙️ {t("feature_entitlements", "Feature Entitlements")} {selectedClub?.name}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={1}>
                        <FormControlLabel
                            control={<Switch checked={Boolean(selectedClub?.features?.video_calls)} onChange={(e) => selectedClub && setSelectedClub({ ...selectedClub, features: { ...selectedClub.features, video_calls: e.target.checked } })} color="primary" />}
                            label={t("live_video_calling_module", "Live Video Calling Module")}
                        />
                        <FormControlLabel
                            control={<Switch checked={Boolean(selectedClub?.features?.mom_editor)} onChange={(e) => selectedClub && setSelectedClub({ ...selectedClub, features: { ...selectedClub.features, mom_editor: e.target.checked } })} color="primary" />}
                            label={t("word_mom_editor_archives", "Word MOM Editor & Archives")}
                        />
                        <FormControlLabel
                            control={<Switch checked={Boolean(selectedClub?.features?.social_feed)} onChange={(e) => selectedClub && setSelectedClub({ ...selectedClub, features: { ...selectedClub.features, social_feed: e.target.checked } })} color="primary" />}
                            label={t("community_social_wall_photos", "Community Social Wall & Photos")}
                        />
                        <FormControlLabel
                            control={<Switch checked={Boolean(selectedClub?.features?.dues_module)} onChange={(e) => selectedClub && setSelectedClub({ ...selectedClub, features: { ...selectedClub.features, dues_module: e.target.checked } })} color="primary" />}
                            label={t("treasury_membership_dues", "Treasury & Membership Dues")}
                        />
                    </Stack>
                    <TextField
                        fullWidth
                        type="number"
                        label={t("maximum_member_quota", "Maximum Member Quota")}
                        value={selectedClub?.features?.max_members || 50}
                        onChange={(e) => selectedClub && setSelectedClub({ ...selectedClub, features: { ...selectedClub.features, max_members: parseInt(e.target.value) || 50 } })}
                        margin="normal"
                        sx={{ mt: 3 }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setSelectedClub(null)}>{t("cancel", "Cancel")}</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveFeatures} sx={{ fontWeight: 800 }}>
                        {t("save_entitlements", "Save Entitlements")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};