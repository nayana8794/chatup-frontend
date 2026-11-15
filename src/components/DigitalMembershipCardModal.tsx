// chatup/frontend/src/components/DigitalMembershipCardModal.tsx
import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    Chip,
    Stack,
    IconButton,
    CircularProgress,
    Divider,
    Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VerifiedIcon from "@mui/icons-material/Verified";
import FlipCameraAndroidIcon from "@mui/icons-material/FlipCameraAndroid";
import ShareIcon from "@mui/icons-material/Share";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface DigitalCardData {
    member_id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    role: string;
    club_name: string;
    club_slug: string;
    district: string;
    joined_date: string;
    dues_standing: "PAID" | "PENDING" | "OVERDUE";
    qr_payload: string;
    card_serial: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

export const DigitalMembershipCardModal: React.FC<Props> = ({ open, onClose }) => {
    const { t, i18n } = useTranslation();
    const [cardData, setCardData] = useState<DigitalCardData | null>(null);
    const [cardError, setCardError] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            setIsFlipped(false);
            setCardError("");
            apiClient
                .get<DigitalCardData>("/members/me/digital-card")
                .then((res) => setCardData(res.data))
                .catch((err) => {
                    const detailMsg = err.response?.data?.detail || err.message || "Failed to load card";
                    setCardError(detailMsg);
                    console.error("Failed to load membership card:", err);
                })
                .finally(() => setLoading(false));
        }
    }, [open]);

    const handleShare = () => {
        if (!cardData) return;
        if (navigator.share) {
            navigator
                .share({
                    title: `${cardData.full_name} - ${t("lions_digital_id", "Official Lions Membership Card")}`,
                    text: `${t("member_of", "Official Member of")} ${cardData.club_name} (${cardData.district})`,
                    url: cardData.qr_payload,
                })
                .catch(() => { });
        } else {
            navigator.clipboard.writeText(cardData.qr_payload);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    // Format joined date with UTC safety and active language
    const formatMemberDate = (dateStr?: string) => {
        if (!dateStr) return "—";
        const safeStr = dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
        const dateObj = new Date(safeStr);
        return dateObj.toLocaleDateString(i18n.language === "fi" ? "fi-FI" : i18n.language === "sv" ? "sv-SE" : "en-US", {
            month: "long",
            year: "numeric",
        });
    };

    const getDuesStatusLabel = (status: "PAID" | "PENDING" | "OVERDUE") => {
        switch (status) {
            case "PAID":
                return t("status_paid", "PAID");
            case "PENDING":
                return t("status_pending", "PENDING");
            case "OVERDUE":
                return t("status_overdue", "OVERDUE");
            default:
                return status;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            sx={{
                "& .MuiDialog-paper": {
                    borderRadius: 5,
                    bgcolor: "transparent",
                    boxShadow: "none",
                    overflow: "visible",
                    m: 2,
                },
            }}
        >
            <DialogContent sx={{ p: 0, position: "relative" }}>
                {/* Floating Close Button */}
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        top: -16,
                        right: -16,
                        bgcolor: "rgba(0,0,0,0.6)",
                        color: "white",
                        zIndex: 10,
                        "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>

                {loading ? (
                    <Box sx={{ p: 6, display: "flex", justifyContent: "center", bgcolor: "background.paper", borderRadius: 5 }}>
                        <CircularProgress size={50} sx={{ color: "#F2A900" }} />
                    </Box>
                ) : cardError ? (
                    <Alert severity="error" sx={{ borderRadius: 4, m: 2 }}>
                        {cardError}
                    </Alert>
                ) : !cardData ? (
                    <Alert severity="error" sx={{ borderRadius: 4 }}>
                        {t("card_load_error", "Could not retrieve digital membership card.")}
                    </Alert>
                ) : (
                    <Box sx={{ perspective: "1000px" }}>
                        {/* Apple Wallet Luxury Card Container */}
                        <Box
                            sx={{
                                width: "100%",
                                minHeight: 460,
                                borderRadius: 4.5,
                                background: "linear-gradient(145deg, #002F6C 0%, #001738 70%, #000c1e 100%)",
                                border: "2px solid rgba(242, 169, 0, 0.45)",
                                boxShadow: "0 20px 40px rgba(0, 47, 108, 0.4), 0 0 20px rgba(242, 169, 0, 0.2)",
                                color: "white",
                                p: 3,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {/* Watermark Crest Background Accent */}
                            <Box
                                sx={{
                                    position: "absolute",
                                    right: -30,
                                    bottom: -30,
                                    width: 180,
                                    height: 180,
                                    borderRadius: "50%",
                                    bgcolor: "rgba(242, 169, 0, 0.04)",
                                    pointerEvents: "none",
                                }}
                            />

                            {!isFlipped ? (
                                /* ================= CARD FACE (FRONT) ================= */
                                <Box sx={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                    {/* Card Header */}
                                    <Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                            <Typography variant="overline" sx={{ color: "#F2A900", fontWeight: 900, letterSpacing: 2 }}>
                                                {t("lions_org_title", "LIONS CLUBS INTERNATIONAL")}
                                            </Typography>
                                            <Chip
                                                icon={<VerifiedIcon sx={{ color: "#002F6C !important", fontSize: 16 }} />}
                                                label={t("official_badge", "OFFICIAL")}
                                                size="small"
                                                sx={{
                                                    bgcolor: "#F2A900",
                                                    color: "#002F6C",
                                                    fontWeight: 900,
                                                    height: 22,
                                                    fontSize: "0.7rem",
                                                }}
                                            />
                                        </Box>
                                        <Typography variant="h5" sx={{ fontWeight: 900, color: "white", lineHeight: 1.2 }}>
                                            {cardData.club_name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                                            {cardData.district}
                                        </Typography>
                                    </Box>

                                    {/* Center Dynamic QR Code Box */}
                                    <Box sx={{ my: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <Box
                                            sx={{
                                                p: 1.8,
                                                bgcolor: "white",
                                                borderRadius: 3.5,
                                                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                                                display: "inline-block",
                                            }}
                                        >
                                            <QRCodeSVG
                                                value={cardData.qr_payload}
                                                size={150}
                                                level="M"
                                                bgColor="#FFFFFF"
                                                fgColor="#002F6C"
                                            />
                                        </Box>
                                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", mt: 1, letterSpacing: 1.2, fontFamily: "monospace" }}>
                                            {cardData.card_serial}
                                        </Typography>
                                    </Box>

                                    {/* Card Footer: Member Name, Role & Dues Standing */}
                                    <Box>
                                        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", mb: 1.5 }} />
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontWeight: 700 }}>
                                                    {t("member_name_label", "Member Name")}
                                                </Typography>
                                                <Typography variant="h6" sx={{ fontWeight: 900, color: "white", lineHeight: 1.1 }}>
                                                    {cardData.full_name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: "#F2A900", fontWeight: 800 }}>
                                                    {cardData.role.replace("_", " ")}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ textAlign: "right" }}>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                                                    {t("dues_status_label", "Dues Status")}
                                                </Typography>
                                                <Chip
                                                    icon={cardData.dues_standing === "PAID" ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <WarningAmberIcon sx={{ fontSize: 16 }} />}
                                                    label={getDuesStatusLabel(cardData.dues_standing)}
                                                    size="small"
                                                    color={cardData.dues_standing === "PAID" ? "success" : "warning"}
                                                    sx={{ fontWeight: 800, height: 24 }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            ) : (
                                /* ================= CARD DETAILS (BACK) ================= */
                                <Box sx={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                    <Box>
                                        <Typography variant="overline" sx={{ color: "#F2A900", fontWeight: 900, letterSpacing: 1.5 }}>
                                            {t("membership_details_heading", "MEMBERSHIP DETAILS & STANDING")}
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontWeight: 900, color: "white" }}>
                                            {t("executive_credentials_heading", "Executive Credentials")}
                                        </Typography>
                                        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", my: 1.5 }} />

                                        <Stack spacing={1.5}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                                                    {t("email_label", "Official Email")}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                    {cardData.email}
                                                </Typography>
                                            </Box>

                                            {cardData.phone_number && (
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                                                        {t("phone_label", "Phone Number")}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                        {cardData.phone_number}
                                                    </Typography>
                                                </Box>
                                            )}

                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                                                    {t("member_since_label", "Member Since")}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                    {formatMemberDate(cardData.joined_date)}
                                                </Typography>
                                            </Box>

                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                                                    {t("fiscal_year_label", "Nordic Fiscal Year")}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: "success.light" }}>
                                                    {t("good_standing_period", "2025–2026 In Good Standing")}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Box>

                                    <Box sx={{ textAlign: "center", pt: 2 }}>
                                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", display: "block" }}>
                                            {t("card_disclaimer", "This cryptographic credential certifies authorized standing across European and Nordic Lions Districts.")}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>

                        {/* Action Bar Beneath Card */}
                        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, justifyContent: "center" }}>
                            <Button
                                variant="contained"
                                startIcon={<FlipCameraAndroidIcon />}
                                onClick={() => setIsFlipped(!isFlipped)}
                                sx={{
                                    bgcolor: "#F2A900",
                                    color: "#002F6C",
                                    fontWeight: 800,
                                    borderRadius: 3,
                                    px: 2.5,
                                    "&:hover": { bgcolor: "#d99800" },
                                }}
                            >
                                {isFlipped ? t("view_qr_card", "View QR Card") : t("card_details_btn", "Card Details")}
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={copied ? <CheckCircleIcon color="success" /> : <ShareIcon />}
                                onClick={handleShare}
                                sx={{
                                    borderColor: "rgba(255,255,255,0.4)",
                                    color: "white",
                                    fontWeight: 800,
                                    borderRadius: 3,
                                    px: 2,
                                    "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
                                }}
                            >
                                {copied ? t("copied_btn", "Copied!") : t("share_link_btn", "Share / Link")}
                            </Button>
                        </Stack>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};