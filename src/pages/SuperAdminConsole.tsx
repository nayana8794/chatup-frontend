// chatup/frontend/src/pages/SuperAdminConsole.tsx
import React, { useState, useEffect } from "react";
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

export const SuperAdminConsole: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();

    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);

    // New Club Form State
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [clubName, setClubName] = useState("");
    const [clubSlug, setClubSlug] = useState("");
    const [district, setDistrict] = useState("");

    // Initial President Details State
    const [presidentName, setPresidentName] = useState("");
    const [presidentEmail, setPresidentEmail] = useState("");
    const [presidentPhone, setPresidentPhone] = useState("");

    // Standalone "Assign President" for existing clubs without one
    const [assignPresidentClub, setAssignPresidentClub] = useState<Club | null>(null);
    const [assignName, setAssignName] = useState("");
    const [assignEmail, setAssignEmail] = useState("");
    const [assignPhone, setAssignPhone] = useState("");

    // Edit President State
    const [editPresidentClub, setEditPresidentClub] = useState<Club | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");

    // Reset Password Confirm State
    const [resetClubTarget, setResetClubTarget] = useState<Club | null>(null);

    // Credentials Success Dialog
    const [credentials, setCredentials] = useState<ProvisionedCredentials | null>(null);
    const [copied, setCopied] = useState(false);

    // Feature Flags Dialog State
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchClubs = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/admin/clubs");
            setClubs(res.data);
        } catch (err) {
            console.error("Failed to load clubs:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClubs();
    }, []);

    // Create Club + Initial President
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
            });

            if (res.data.credentials) {
                setCredentials(res.data.credentials);
            }

            setOpenAddDialog(false);
            setClubName("");
            setClubSlug("");
            setDistrict("");
            setPresidentName("");
            setPresidentEmail("");
            setPresidentPhone("");
            fetchClubs();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to create club & initial president");
        } finally {
            setSubmitting(false);
        }
    };

    // Assign President to an Existing Club
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
            fetchClubs();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to assign club president");
        } finally {
            setSubmitting(false);
        }
    };

    // Reset President Password
    const handleResetPresidentPassword = async () => {
        if (!resetClubTarget) return;
        setError(null);
        setSubmitting(true);
        try {
            const res = await apiClient.post(`/admin/clubs/${resetClubTarget.id}/reset-president-password`);
            setCredentials(res.data.credentials);
            setResetClubTarget(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to reset password");
        } finally {
            setSubmitting(false);
        }
    };

    // Edit President Details
    const handleOpenEditPresident = (club: Club) => {
        if (!club.president) return;
        setError(null);
        setEditPresidentClub(club);
        setEditName(club.president.full_name);
        setEditEmail(club.president.email);
        setEditPhone(club.president.phone_number || "");
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
            fetchClubs();
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
            fetchClubs();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveFeatures = async () => {
        if (!selectedClub) return;
        try {
            await apiClient.patch(`/admin/clubs/${selectedClub.id}/features`, selectedClub.features);
            setSelectedClub(null);
            fetchClubs();
        } catch (err) {
            console.error(err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
            {/* Header Bar */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 4,
                }}
            >
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                    variant="outlined"
                    sx={{ fontWeight: "bold", minHeight: 48 }}
                >
                    {t("back_to_dashboard")}
                </Button>
                <Typography variant="h5" sx={{ fontWeight: 800, textAlign: { xs: "center", sm: "left" } }}>
                    🛠️ {t("super_admin_console_heading")}
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddBusinessIcon />}
                    onClick={() => {
                        setError(null);
                        setOpenAddDialog(true);
                    }}
                    sx={{ fontWeight: "bold", minHeight: 48 }}
                >
                    {t("add_new_club")}
                </Button>
            </Stack>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : (
                /* ================= CLUBS LIST ================= */
                <Stack spacing={3}>
                    {clubs.map((club) => (
                        <Card
                            key={club.id}
                            elevation={3}
                            sx={{
                                borderRadius: 3,
                                borderLeft: "6px solid",
                                borderLeftColor: club.is_active ? "success.main" : "error.main",
                            }}
                        >
                            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: { xs: "column", sm: "row" },
                                        justifyContent: "space-between",
                                        alignItems: { xs: "flex-start", sm: "center" },
                                        gap: 1.5,
                                        mb: 1.5,
                                    }}
                                >
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                            🦁 {club.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Slug: <b>{club.slug}</b> {club.district && `• ${t("district")}: ${club.district}`}
                                        </Typography>
                                    </Box>

                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                        <Chip
                                            label={club.is_active ? t("active_status") : t("suspended_status")}
                                            color={club.is_active ? "success" : "error"}
                                            sx={{ fontWeight: "bold" }}
                                        />
                                        <Chip
                                            label={`${club.member_count} / ${club.features?.max_members || 50} Members`}
                                            color={club.member_count === 0 ? "warning" : "default"}
                                            variant={club.member_count === 0 ? "filled" : "outlined"}
                                            sx={{ fontWeight: 600 }}
                                        />
                                    </Stack>
                                </Box>

                                {/* ================= PRESIDENT DETAILS BAR ================= */}
                                {club.president ? (
                                    <Card
                                        variant="outlined"
                                        sx={{
                                            p: 1.5,
                                            mb: 2,
                                            bgcolor: "action.hover",
                                            borderRadius: 2,
                                            display: "flex",
                                            flexDirection: { xs: "column", sm: "row" },
                                            justifyContent: "space-between",
                                            alignItems: { xs: "flex-start", sm: "center" },
                                            gap: 1,
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                                                👑 {t("president_label")}: {club.president.full_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t("email_label")}: <b>{club.president.email}</b> {club.president.phone_number && `• ${t("member_phone")}: ${club.president.phone_number}`}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                                startIcon={<EditIcon />}
                                                onClick={() => handleOpenEditPresident(club)}
                                                sx={{ textTransform: "none", fontWeight: 600 }}
                                            >
                                                {t("edit_minute").split(" ")[0]}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                                startIcon={<LockResetIcon />}
                                                onClick={() => {
                                                    setError(null);
                                                    setResetClubTarget(club);
                                                }}
                                                sx={{ textTransform: "none", fontWeight: 600 }}
                                            >
                                                {t("reset_password")}
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
                                                onClick={() => {
                                                    setError(null);
                                                    setAssignPresidentClub(club);
                                                }}
                                                sx={{ fontWeight: "bold" }}
                                            >
                                                {t("assign_president")}
                                            </Button>
                                        }
                                        sx={{ mb: 2, borderRadius: 2 }}
                                    >
                                        {t("club_no_president_warning")}
                                    </Alert>
                                )}

                                <Divider sx={{ my: 1.5 }} />

                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: "bold" }}>
                                    {t("feature_modules_control")}:
                                </Typography>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                                    <Chip
                                        icon={<VideoCallIcon />}
                                        label={t("feat_calls")}
                                        color={club.features?.video_calls ? "primary" : "default"}
                                        variant={club.features?.video_calls ? "filled" : "outlined"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={<DescriptionIcon />}
                                        label={t("feat_word_mom")}
                                        color={club.features?.mom_editor ? "primary" : "default"}
                                        variant={club.features?.mom_editor ? "filled" : "outlined"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={<DynamicFeedIcon />}
                                        label={t("feat_social_feed")}
                                        color={club.features?.social_feed ? "primary" : "default"}
                                        variant={club.features?.social_feed ? "filled" : "outlined"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={<PaymentsIcon />}
                                        label={t("feat_dues")}
                                        color={club.features?.dues_module ? "primary" : "default"}
                                        variant={club.features?.dues_module ? "filled" : "outlined"}
                                        size="small"
                                    />
                                </Box>

                                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", flexWrap: "wrap", gap: 1 }}>
                                    {!club.president && (
                                        <Button
                                            variant="outlined"
                                            color="secondary"
                                            size="small"
                                            startIcon={<PersonAddAlt1Icon />}
                                            onClick={() => {
                                                setError(null);
                                                setAssignPresidentClub(club);
                                            }}
                                            sx={{ fontWeight: "bold", minHeight: 38 }}
                                        >
                                            {t("assign_president")}
                                        </Button>
                                    )}

                                    <Button
                                        variant="outlined"
                                        color={club.is_active ? "error" : "success"}
                                        size="small"
                                        onClick={() => handleToggleStatus(club)}
                                        sx={{ fontWeight: "bold", minHeight: 38 }}
                                    >
                                        {club.is_active ? t("suspend_club") : t("activate_club")}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<TuneIcon />}
                                        size="small"
                                        onClick={() => setSelectedClub(club)}
                                        sx={{ fontWeight: "bold", minHeight: 38 }}
                                    >
                                        {t("configure")}
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}

            {/* ================= REGISTER NEW CLUB DIALOG ================= */}
            <Dialog
                open={openAddDialog}
                onClose={() => !submitting && setOpenAddDialog(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold" }}>➕ {t("add_new_club")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateClub}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "primary.main", mb: 1 }}>
                            1. {t("club_name").toUpperCase()}
                        </Typography>
                        <TextField
                            fullWidth
                            required
                            label={t("club_name")}
                            value={clubName}
                            onChange={(e) => {
                                setClubName(e.target.value);
                                if (!clubSlug) {
                                    setClubSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                                }
                            }}
                            margin="dense"
                            placeholder="Lions Club Helsinki"
                        />
                        <TextField
                            fullWidth
                            required
                            label={t("club_slug")}
                            value={clubSlug}
                            onChange={(e) => setClubSlug(e.target.value)}
                            margin="dense"
                            placeholder="lions-helsinki"
                        />
                        <TextField
                            fullWidth
                            label={t("district")}
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            margin="dense"
                            placeholder="District 107-N"
                        />

                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "primary.main", mb: 1 }}>
                            2. {t("president_label").toUpperCase()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                            {t("temp_password_desc")}
                        </Typography>

                        <TextField
                            fullWidth
                            required
                            label={t("member_name")}
                            value={presidentName}
                            onChange={(e) => setPresidentName(e.target.value)}
                            margin="dense"
                            placeholder="Matti Meikäläinen"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("email_label")}
                            value={presidentEmail}
                            onChange={(e) => setPresidentEmail(e.target.value)}
                            margin="dense"
                            placeholder="president@lionshelsinki.fi"
                        />
                        <TextField
                            fullWidth
                            label={t("member_phone")}
                            value={presidentPhone}
                            onChange={(e) => setPresidentPhone(e.target.value)}
                            margin="dense"
                            placeholder="+358 40 1234567"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenAddDialog(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting}>
                            {submitting ? <CircularProgress size={24} /> : t("add_new_club")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* ================= EDIT PRESIDENT DETAILS DIALOG ================= */}
            <Dialog
                open={Boolean(editPresidentClub)}
                onClose={() => !submitting && setEditPresidentClub(null)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold" }}>
                    ✏️ {t("edit_president")} ({editPresidentClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleSavePresidentDetails}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField
                            fullWidth
                            required
                            label={t("member_name")}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            margin="dense"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("email_label")}
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            margin="dense"
                        />
                        <TextField
                            fullWidth
                            label={t("member_phone")}
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            margin="dense"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditPresidentClub(null)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting}>
                            {submitting ? <CircularProgress size={24} /> : t("update_password_btn")}
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
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold", color: "warning.main", display: "flex", alignItems: "center", gap: 1 }}>
                    <LockResetIcon /> {t("reset_password")}?
                </DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <Typography variant="body2">
                        {t("confirm_delete").replace("remove this member", "reset password for " + resetClubTarget?.president?.full_name)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        {t("temp_password_desc")}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setResetClubTarget(null)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={handleResetPresidentPassword}
                        disabled={submitting}
                    >
                        {submitting ? <CircularProgress size={24} /> : t("reset_password")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================= ASSIGN PRESIDENT TO EXISTING CLUB DIALOG ================= */}
            <Dialog
                open={Boolean(assignPresidentClub)}
                onClose={() => !submitting && setAssignPresidentClub(null)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold" }}>
                    👤 {t("assign_president")} ({assignPresidentClub?.name})
                </DialogTitle>
                <Box component="form" onSubmit={handleAssignPresident}>
                    <DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t("club_no_president_warning")}
                        </Typography>

                        <TextField
                            fullWidth
                            required
                            label={t("member_name")}
                            value={assignName}
                            onChange={(e) => setAssignName(e.target.value)}
                            margin="dense"
                            placeholder="Juho Virtanen"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("email_label")}
                            value={assignEmail}
                            onChange={(e) => setAssignEmail(e.target.value)}
                            margin="dense"
                            placeholder="president@lionsclub.fi"
                        />
                        <TextField
                            fullWidth
                            label={t("member_phone")}
                            value={assignPhone}
                            onChange={(e) => setAssignPhone(e.target.value)}
                            margin="dense"
                            placeholder="+358 50 9876543"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setAssignPresidentClub(null)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={submitting}>
                            {submitting ? <CircularProgress size={24} /> : t("assign_president")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* ================= CREDENTIALS GENERATED / RESET MODAL ================= */}
            <Dialog
                open={Boolean(credentials)}
                onClose={() => setCredentials(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "success.main", color: "white" }}>
                    <CheckCircleIcon /> {t("temp_password_title")}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {t("temp_password_desc")}
                    </Typography>

                    <Card variant="outlined" sx={{ p: 2, bgcolor: "action.hover", mb: 2 }}>
                        <Typography variant="caption" color="text.secondary">{t("member_name")}</Typography>
                        <Typography variant="body1" sx={{ fontWeight: "bold", mb: 1 }}>{credentials?.president_name}</Typography>

                        <Typography variant="caption" color="text.secondary">{t("email_label")}</Typography>
                        <Typography variant="body1" sx={{ fontWeight: "bold", mb: 1 }}>{credentials?.email}</Typography>

                        <Typography variant="caption" color="text.secondary">Temporary Password</Typography>
                        <Typography variant="h6" sx={{ fontFamily: "monospace", color: "primary.main", fontWeight: "bold" }}>
                            {credentials?.temp_password}
                        </Typography>
                    </Card>

                    <Alert severity="info" sx={{ fontSize: "0.85rem" }}>
                        The user will be required to change this password immediately after their initial login.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
                    <Button
                        startIcon={copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                        onClick={() =>
                            copyToClipboard(
                                `ChatUp Club: ${credentials?.club_name}\nEmail: ${credentials?.email}\nTemporary Password: ${credentials?.temp_password}`
                            )
                        }
                    >
                        {copied ? t("password_copied") : t("copy_password")}
                    </Button>
                    <Button variant="contained" onClick={() => setCredentials(null)}>
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ================= FEATURE FLAGS MODAL ================= */}
            <Dialog
                open={Boolean(selectedClub)}
                onClose={() => setSelectedClub(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold", bgcolor: "primary.main", color: "white" }}>
                    ⚙️ {selectedClub?.name}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t("feature_modules_control")}
                    </Typography>

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
                            label={t("feat_video_calls")}
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
                            label={t("feat_mom_editor")}
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
                            label={t("feat_social_feed")}
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
                            label={t("feat_dues_module")}
                        />
                    </Stack>

                    <TextField
                        fullWidth
                        type="number"
                        label={t("max_members_label")}
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
                    <Button onClick={() => setSelectedClub(null)}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveFeatures}>
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};