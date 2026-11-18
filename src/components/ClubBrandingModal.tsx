// chatup/frontend/src/components/ClubBrandingModal.tsx
import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Button,
    TextField,
    Alert,
    CircularProgress,
    Divider,
} from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeContext";
import apiClient from "../api/client";

interface Props {
    open: boolean;
    onClose: () => void;
    clubId?: string;
    isAdminMode?: boolean;
    currentPrimary?: string;
    currentSecondary?: string;
    currentLogo?: string;
    onSuccess: () => void;
}

export const ClubBrandingModal: React.FC<Props> = ({
    open,
    onClose,
    clubId,
    isAdminMode = false,
    currentPrimary,
    currentSecondary,
    currentLogo,
    onSuccess,
}) => {
    const { t } = useTranslation();
    const { brandPrimary, brandSecondary, clubLogo, applyClubBranding } = useAppTheme();

    const [primaryColor, setPrimaryColor] = useState("#002F6C");
    const [secondaryColor, setSecondaryColor] = useState("#F2A900");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(undefined);
    const [loadingBrand, setLoadingBrand] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const PRESET_PALETTES = [
        { name: t("preset_lions_classic", "Lions Classic (Navy & Gold)"), primary: "#002F6C", secondary: "#F2A900" },
        { name: t("preset_rotary_royal", "Rotary Royal & Gold"), primary: "#17458F", secondary: "#F7A81B" },
        { name: t("preset_nordic_pine", "Nordic Pine & Gold"), primary: "#1E4620", secondary: "#D4AF37" },
        { name: t("preset_baltic_blue", "Baltic Deep Blue"), primary: "#0B2545", secondary: "#134074" },
        { name: t("preset_bordeaux_wine", "Bordeaux Wine & Gold"), primary: "#581845", secondary: "#FFC300" },
    ];

    useEffect(() => {
        if (!open) return;

        setSelectedFile(null);
        setSuccessMsg("");
        setErrorMsg("");

        if (isAdminMode) {
            setPrimaryColor(currentPrimary || "#002F6C");
            setSecondaryColor(currentSecondary || "#F2A900");
            setLogoPreview(currentLogo);
        } else {
            // Prefill from ThemeContext immediately
            setPrimaryColor(brandPrimary || "#002F6C");
            setSecondaryColor(brandSecondary || "#F2A900");
            setLogoPreview(clubLogo || undefined);

            // Fetch freshest branding from backend in case Governor/Admin updated it
            setLoadingBrand(true);
            apiClient
                .get("/members/my-club/branding")
                .then((res) => {
                    const tc = res.data?.theme_config || {};
                    if (tc.primary_color) setPrimaryColor(tc.primary_color);
                    if (tc.secondary_color) setSecondaryColor(tc.secondary_color);
                    if (tc.logo_url) setLogoPreview(tc.logo_url);
                })
                .catch(() => { })
                .finally(() => setLoadingBrand(false));
        }
    }, [open, isAdminMode, clubId, currentPrimary, currentSecondary, currentLogo, brandPrimary, brandSecondary, clubLogo]);

    const handleSaveColors = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const endpoint =
                isAdminMode && clubId ? `/admin/clubs/${clubId}/branding` : `/members/my-club/branding`;
            await apiClient.patch(endpoint, {
                primary_color: primaryColor,
                secondary_color: secondaryColor,
            });

            let latestLogoUrl = logoPreview;
            if (selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                const uploadEndpoint =
                    isAdminMode && clubId ? `/admin/clubs/${clubId}/upload-crest` : `/members/my-club/upload-crest`;
                const uploadRes = await apiClient.post(uploadEndpoint, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                if (uploadRes.data?.logo_url) {
                    latestLogoUrl = uploadRes.data.logo_url;
                }
            }

            if (!isAdminMode) {
                applyClubBranding(primaryColor, secondaryColor, latestLogoUrl || null);
            }

            setSuccessMsg(t("branding_saved", "Club branding updated successfully!"));
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.detail || t("branding_error", "Failed to update club branding"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={() => !submitting && onClose()}
            maxWidth="sm"
            fullWidth
            sx={{ "& .MuiDialog-paper": { m: { xs: 1.5, sm: 2 }, borderRadius: 4, maxHeight: "92vh" } }}
        >
            <DialogTitle sx={{ fontWeight: 900, color: "primary.main", display: "flex", alignItems: "center", gap: 1 }}>
                <PaletteIcon /> {t("club_branding_title", "Customize Club Branding & Crest")}
            </DialogTitle>
            <Box component="form" onSubmit={handleSaveColors} sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <DialogContent dividers sx={{ overflowY: "auto" }}>
                    {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }}>{errorMsg}</Alert>}
                    {successMsg && (
                        <Alert severity="success" sx={{ mb: 2, borderRadius: 2.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <CheckCircleIcon fontSize="small" />
                                <span>{successMsg}</span>
                            </Box>
                        </Alert>
                    )}

                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5, color: "primary.main" }}>
                        {t("branding_step_1", "1. Official Club Crest / Logo Upload")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                        {t("branding_crest_desc", "Upload your high-resolution PNG or SVG club crest. Hosted securely on Cloudinary CDN.")}
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, mb: 3, flexWrap: "wrap" }}>
                        <Box
                            sx={{
                                width: 76,
                                height: 76,
                                borderRadius: "50%",
                                border: "2px dashed",
                                borderColor: "primary.main",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: "action.hover",
                                overflow: "hidden",
                                flexShrink: 0,
                            }}
                        >
                            {loadingBrand ? (
                                <CircularProgress size={26} />
                            ) : logoPreview ? (
                                <img src={logoPreview} alt="Crest" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                                <PaletteIcon color="disabled" />
                            )}
                        </Box>

                        <Box>
                            <input
                                type="file"
                                id="crest-upload-input"
                                style={{ display: "none" }}
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedFile(e.target.files[0]);
                                        setLogoPreview(URL.createObjectURL(e.target.files[0]));
                                    }
                                }}
                            />
                            <label htmlFor="crest-upload-input">
                                <Button variant="outlined" component="span" startIcon={<UploadFileIcon />} sx={{ fontWeight: 800, borderRadius: 2.5 }}>
                                    {t("choose_crest_btn", "Choose Crest Image")}
                                </Button>
                            </label>
                            {selectedFile && (
                                <Typography variant="caption" sx={{ display: "block", mt: 1, fontWeight: 700, color: "success.main" }}>
                                    ✓ {selectedFile.name}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: "primary.main" }}>
                        {t("branding_step_2", "2. Brand Color Palette Presets")}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
                        {PRESET_PALETTES.map((p, idx) => (
                            <Button
                                key={idx}
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    setPrimaryColor(p.primary);
                                    setSecondaryColor(p.secondary);
                                }}
                                sx={{
                                    borderColor: primaryColor === p.primary ? "primary.main" : "divider",
                                    bgcolor: primaryColor === p.primary ? "action.selected" : "transparent",
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    textTransform: "none",
                                    py: 0.8,
                                    px: 1.5,
                                }}
                            >
                                <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: p.primary, mr: 1, flexShrink: 0 }} />
                                {p.name}
                            </Button>
                        ))}
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                        <TextField
                            fullWidth
                            label={t("primary_color_label", "Primary Brand Color (HEX)")}
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            margin="dense"
                            slotProps={{
                                input: {
                                    endAdornment: <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: primaryColor, border: "1px solid #ccc", flexShrink: 0 }} />,
                                },
                            }}
                        />

                        <TextField
                            fullWidth
                            label={t("secondary_color_label", "Secondary Accent Color (HEX)")}
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            margin="dense"
                            slotProps={{
                                input: {
                                    endAdornment: <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: secondaryColor, border: "1px solid #ccc", flexShrink: 0 }} />,
                                },
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} disabled={submitting}>
                        {t("cancel_btn", "Cancel")}
                    </Button>
                    <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 900, borderRadius: 2.5 }}>
                        {submitting ? <CircularProgress size={24} color="inherit" /> : t("save_branding_btn", "Save Branding")}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};