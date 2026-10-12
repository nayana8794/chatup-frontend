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
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface Club {
    id: string;
    name: string;
    slug: string;
    district?: string;
    is_active: boolean;
    member_count: number;
    features: {
        video_calls: boolean;
        mom_editor: boolean;
        social_feed: boolean;
        dues_module: boolean;
        max_members: number;
    };
}

export const SuperAdminConsole: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();

    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);

    // New Club Dialog
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [clubName, setClubName] = useState("");
    const [clubSlug, setClubSlug] = useState("");
    const [district, setDistrict] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Feature Flag Manage Dialog
    const [selectedClub, setSelectedClub] = useState<Club | null>(null);

    const fetchClubs = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/admin/clubs");
            setClubs(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClubs();
    }, []);

    const handleCreateClub = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await apiClient.post("/admin/clubs", {
                name: clubName,
                slug: clubSlug.toLowerCase().trim(),
                district,
            });

            setOpenAddDialog(false);
            setClubName("");
            setClubSlug("");
            setDistrict("");
            fetchClubs();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Error creating club");
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
                    🛠️ {t("super_admin_title")}
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddBusinessIcon />}
                    onClick={() => setOpenAddDialog(true)}
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
                                        mb: 2,
                                    }}
                                >
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                                            🦁 {club.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Slug: <b>{club.slug}</b> {club.district && `• District: ${club.district}`}
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
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Box>

                                <Divider sx={{ my: 1.5 }} />

                                {/* Active Feature Badges Display */}
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: "bold" }}>
                                    {t("granular_features")}:
                                </Typography>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                                    <Chip
                                        icon={<VideoCallIcon />}
                                        label="Calls"
                                        color={club.features?.video_calls ? "primary" : "default"}
                                        variant={club.features?.video_calls ? "filled" : "outlined"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={<DescriptionIcon />}
                                        label="Word MOM"
                                        color={club.features?.mom_editor ? "primary" : "default"}
                                        variant={club.features?.mom_editor ? "filled" : "outlined"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={<DynamicFeedIcon />}
                                        label="Social Feed"
                                        color={club.features?.social_feed ? "primary" : "default"}
                                        variant={club.features?.social_feed ? "filled" : "outlined"}
                                        size="small"
                                    />
                                    <Chip
                                        icon={<PaymentsIcon />}
                                        label="Dues"
                                        color={club.features?.dues_module ? "primary" : "default"}
                                        variant={club.features?.dues_module ? "filled" : "outlined"}
                                        size="small"
                                    />
                                </Box>

                                {/* Action Buttons */}
                                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                                    <Button
                                        variant="outlined"
                                        color={club.is_active ? "error" : "success"}
                                        size="small"
                                        onClick={() => handleToggleStatus(club)}
                                        sx={{ fontWeight: "bold", minHeight: 38 }}
                                    >
                                        {club.is_active ? "Suspend Club" : "Activate Club"}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<TuneIcon />}
                                        size="small"
                                        onClick={() => setSelectedClub(club)}
                                        sx={{ fontWeight: "bold", minHeight: 38 }}
                                    >
                                        Configure Features
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
                onClose={() => setOpenAddDialog(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold" }}>➕ {t("add_new_club")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateClub}>
                    <DialogContent>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField
                            fullWidth
                            required
                            label={t("club_name")}
                            value={clubName}
                            onChange={(e) => setClubName(e.target.value)}
                            margin="normal"
                            placeholder="Lions Club Espoo"
                        />
                        <TextField
                            fullWidth
                            required
                            label={t("club_slug")}
                            value={clubSlug}
                            onChange={(e) => setClubSlug(e.target.value)}
                            margin="normal"
                            placeholder="lions-espoo"
                        />
                        <TextField
                            fullWidth
                            label={t("district")}
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            margin="normal"
                            placeholder="District 107-B"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary">
                            {t("add_new_club")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* ================= GRANULAR FEATURE FLAGS CONFIG MODAL ================= */}
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
                        {t("granular_features")}
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