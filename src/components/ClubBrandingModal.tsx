// chatup/frontend/src/components/ClubBrandingModal.tsx
import React, { useState } from "react";
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
import apiClient from "../api/client";

interface Props {
    open: boolean;
    onClose: () => void;
    clubId?: string; // If SuperAdmin/Governor, pass clubId. If President, uses /my-club/branding
    isAdminMode?: boolean;
    currentPrimary?: string;
    currentSecondary?: string;
    currentLogo?: string;
    onSuccess: () => void;
}

const PRESET_PALETTES = [
    { name: "Lions Classic (Navy & Gold)", primary: "#002F6C", secondary: "#F2A900" },
    { name: "Rotary Royal & Gold", primary: "#17458F", secondary: "#F7A81B" },
    { name: "Nordic Pine & Gold", primary: "#1E4620", secondary: "#D4AF37" },
    { name: "Baltic Deep Blue", primary: "#0B2545", secondary: "#134074" },
    { name: "Bordeaux Wine & Gold", primary: "#581845", secondary: "#FFC300" },
];

export const ClubBrandingModal: React.FC<Props> = ({
    open,
    onClose,
    clubId,
    isAdminMode = false,
    currentPrimary = "#002F6C",
    currentSecondary = "#F2A900",
    currentLogo,
    onSuccess,
}) => {
    const { t } = useTranslation();
    const [primaryColor, setPrimaryColor] = useState(currentPrimary);
    const [secondaryColor, setSecondaryColor] = useState(currentSecondary);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | undefined>(currentLogo);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSaveColors = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const endpoint = isAdminMode && clubId ? `/admin/clubs/${clubId}/branding` : `/members/my-club/branding`;
            await apiClient.patch(endpoint, {
                primary_color: primaryColor,
                secondary_color: secondaryColor,
            });

            // If a new crest file was also attached, upload it
            if (selectedFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                const uploadEndpoint =
                    isAdminMode && clubId ? `/admin/clubs/${clubId}/upload-crest` : `/members/my-club/upload-crest`;
                await apiClient.post(uploadEndpoint, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            }

            setSuccessMsg(t("branding_saved", "Club branding updated successfully!"));
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.detail || "Failed to update club branding");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 4 } }}>
            <DialogTitle sx={{ fontWeight: 900, color: "#002F6C", display: "flex", alignItems: "center", gap: 1 }}>
                <PaletteIcon /> {t("club_branding_title", "Customize Club Branding & Crest")}
            </DialogTitle>
            <Box component="form" onSubmit={handleSaveColors}>
                <DialogContent dividers>
                    {errorMsg && <Alert severity="error" sx={{ mb: 2, borderRadius: 2.5 }}>{errorMsg}</Alert>}
                    {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2.5, alignItems: "center" }}><CheckCircleIcon fontSize="small" sx={{ mr: 1 }} />{successMsg}</Alert>}

                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "primary.main" }}>
                        1. Official Club Crest / Logo Upload
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                        Upload your high-resolution PNG or SVG club crest. It will be hosted securely on Cloudinary CDN.
                    </Typography>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
                        <Box
                            sx={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                border: "2px dashed #002F6C",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: "action.hover",
                                overflow: "hidden",
                            }}
                        >
                            {logoPreview ? (
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
                                    Choose Crest Image
                                </Button>
                            </label>
                            {selectedFile && (
                                <Typography variant="caption" sx={{ display: "block", mt: 1, fontWeight: 700, color: "success.main" }}>
                                    ✓ {selectedFile.name}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    <Divider sx={{ my: 2.5 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "primary.main" }}>
                        2. Brand Color Palette Presets
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
                                    borderColor: primaryColor === p.primary ? "#002F6C" : "divider",
                                    bgcolor: primaryColor === p.primary ? "rgba(0,47,108,0.04)" : "transparent",
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    textTransform: "none",
                                    py: 0.8,
                                }}
                            >
                                <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: p.primary, mr: 1 }} />
                                {p.name}
                            </Button>
                        ))}
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Primary Brand Color (HEX)"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            margin="normal"
                            slotProps={{
                                input: {
                                    endAdornment: <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: primaryColor, border: "1px solid #ccc" }} />,
                                },
                            }}
                        />

                        <TextField
                            fullWidth
                            label="Secondary Accent Color (HEX)"
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            margin="normal"
                            slotProps={{
                                input: {
                                    endAdornment: <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: secondaryColor, border: "1px solid #ccc" }} />,
                                },
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 900, bgcolor: "#002F6C", borderRadius: 2.5 }}>
                        {submitting ? <CircularProgress size={24} color="inherit" /> : "Save Branding"}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};