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
    useMediaQuery,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VerifiedIcon from "@mui/icons-material/Verified";
import FlipCameraAndroidIcon from "@mui/icons-material/FlipCameraAndroid";
import ShareIcon from "@mui/icons-material/Share";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import NfcIcon from "@mui/icons-material/Nfc";
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
    const theme = useTheme();
    const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [cardData, setCardData] = useState<DigitalCardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [cardError, setCardError] = useState("");
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
                    const msg = err.response?.data?.detail || err.message || "Failed to load card";
                    setCardError(msg);
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

    const formatMemberDate = (dateStr?: string) => {
        if (!dateStr) return "—";
        const safeStr = dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
        const dateObj = new Date(safeStr);
        return dateObj.toLocaleDateString(
            i18n.language === "fi" ? "fi-FI" : i18n.language === "sv" ? "sv-SE" : "en-US",
            { month: "long", year: "numeric" }
        );
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

    // Calculate dynamic QR Code size to guarantee zero vertical overflow on 360px viewports
    const qrCodePixelSize = isSmallMobile ? 140 : 160;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            sx={{
                "& .MuiDialog-paper": {
                    borderRadius: { xs: 4, sm: 5 },
                    bgcolor: "transparent",
                    boxShadow: "none",
                    m: { xs: 1.5, sm: 2 },
                    maxHeight: "96vh",
                    overflowY: "auto",
                    overflowX: "hidden",
                    "&::-webkit-scrollbar": { display: "none" },
                    msOverflowStyle: "none",
                    scrollbarWidth: "none",
                },
            }}
        >
            <DialogContent sx={{ p: 0, position: "relative", overflow: "visible" }}>
                {loading ? (
                    <Box
                        sx={{
                            p: 6,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            bgcolor: "background.paper",
                            borderRadius: 4.5,
                            minHeight: 300,
                        }}
                    >
                        <CircularProgress size={50} sx={{ color: "#F2A900" }} />
                    </Box>
                ) : cardError ? (
                    <Alert
                        severity="error"
                        action={
                            <IconButton color="inherit" size="small" onClick={onClose}>
                                <CloseIcon fontSize="inherit" />
                            </IconButton>
                        }
                        sx={{ borderRadius: 3.5, p: 2 }}
                    >
                        {cardError}
                    </Alert>
                ) : !cardData ? (
                    <Alert severity="error" sx={{ borderRadius: 3.5 }}>
                        {t("card_load_error", "Could not retrieve digital membership card.")}
                    </Alert>
                ) : (
                    <Box sx={{ width: "100%", maxWidth: 390, mx: "auto", position: "relative" }}>
                        {/* Apple Wallet Luxury Pass Card */}
                        <Box
                            sx={{
                                width: "100%",
                                minHeight: { xs: 460, sm: 490 },
                                borderRadius: 5,
                                background:
                                    "linear-gradient(150deg, #002352 0%, #001738 55%, #000c1e 100%)",
                                border: "2px solid rgba(242, 169, 0, 0.55)",
                                boxShadow:
                                    "0 24px 48px -12px rgba(0, 16, 43, 0.8), 0 0 24px rgba(242, 169, 0, 0.25)",
                                color: "white",
                                p: { xs: 2.5, sm: 3 },
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {/* Watermark Crest Shimmer Pattern */}
                            <Box
                                sx={{
                                    position: "absolute",
                                    right: -40,
                                    bottom: -40,
                                    width: 220,
                                    height: 220,
                                    borderRadius: "50%",
                                    bgcolor: "rgba(242, 169, 0, 0.045)",
                                    pointerEvents: "none",
                                }}
                            />

                            {/* Integrated Luxury Close Button */}
                            <IconButton
                                onClick={onClose}
                                size="small"
                                sx={{
                                    position: "absolute",
                                    top: 14,
                                    right: 14,
                                    bgcolor: "rgba(255, 255, 255, 0.12)",
                                    color: "white",
                                    zIndex: 5,
                                    backdropFilter: "blur(6px)",
                                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.25)" },
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>

                            {!isFlipped ? (
                                /* ================= CARD FACE (FRONT) ================= */
                                <Box sx={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                    {/* Header Section */}
                                    <Box sx={{ pr: 5 }}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                                            <NfcIcon sx={{ color: "#F2A900", fontSize: 20 }} />
                                            <Typography
                                                variant="overline"
                                                sx={{
                                                    color: "#F2A900",
                                                    fontWeight: 900,
                                                    letterSpacing: { xs: 1.2, sm: 2 },
                                                    fontSize: { xs: "0.68rem", sm: "0.75rem" },
                                                    lineHeight: 1,
                                                }}
                                            >
                                                {t("lions_org_title", "LIONS CLUBS INTERNATIONAL")}
                                            </Typography>
                                        </Stack>

                                        <Typography
                                            variant="h5"
                                            sx={{
                                                fontWeight: 900,
                                                color: "white",
                                                lineHeight: 1.2,
                                                fontSize: { xs: "1.25rem", sm: "1.45rem" },
                                                mt: 0.5,
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {cardData.club_name}
                                        </Typography>

                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: "rgba(255,255,255,0.75)",
                                                fontWeight: 700,
                                                display: "block",
                                                fontSize: "0.8rem",
                                                mt: 0.3,
                                            }}
                                        >
                                            {cardData.district}
                                        </Typography>
                                    </Box>

                                    {/* Center Dynamic QR Code Plate */}
                                    <Box sx={{ my: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                bgcolor: "#FFFFFF",
                                                borderRadius: 3.5,
                                                boxShadow: "0 10px 28px rgba(0, 0, 0, 0.45)",
                                                display: "inline-block",
                                                lineHeight: 0,
                                            }}
                                        >
                                            <QRCodeSVG
                                                value={cardData.qr_payload}
                                                size={qrCodePixelSize}
                                                level="M"
                                                bgColor="#FFFFFF"
                                                fgColor="#002F6C"
                                            />
                                        </Box>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: "rgba(255, 255, 255, 0.75)",
                                                mt: 1.2,
                                                letterSpacing: 2,
                                                fontFamily: "monospace",
                                                fontWeight: 800,
                                                fontSize: "0.85rem",
                                            }}
                                        >
                                            {cardData.card_serial}
                                        </Typography>
                                    </Box>

                                    {/* Card Footer: Member Name & Status Badge */}
                                    <Box>
                                        <Divider sx={{ borderColor: "rgba(242, 169, 0, 0.25)", mb: 1.5 }} />
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 1 }}>
                                            <Box sx={{ overflow: "hidden" }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: "rgba(255, 255, 255, 0.6)",
                                                        textTransform: "uppercase",
                                                        fontWeight: 800,
                                                        fontSize: "0.68rem",
                                                        letterSpacing: 1,
                                                        display: "block",
                                                    }}
                                                >
                                                    {t("member_name_label", "Member Name")}
                                                </Typography>
                                                <Typography
                                                    variant="h6"
                                                    sx={{
                                                        fontWeight: 900,
                                                        color: "white",
                                                        lineHeight: 1.15,
                                                        fontSize: { xs: "1.05rem", sm: "1.2rem" },
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {cardData.full_name}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: "#F2A900",
                                                        fontWeight: 900,
                                                        letterSpacing: 0.5,
                                                        fontSize: "0.78rem",
                                                        display: "block",
                                                        mt: 0.2,
                                                    }}
                                                >
                                                    {cardData.role.replace("_", " ")}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: "rgba(255, 255, 255, 0.6)",
                                                        textTransform: "uppercase",
                                                        fontWeight: 800,
                                                        fontSize: "0.65rem",
                                                        letterSpacing: 0.8,
                                                        display: "block",
                                                        mb: 0.3,
                                                    }}
                                                >
                                                    {t("dues_status_label", "Dues Status")}
                                                </Typography>
                                                <Chip
                                                    icon={
                                                        cardData.dues_standing === "PAID" ? (
                                                            <CheckCircleIcon sx={{ fontSize: "16px !important", color: "white !important" }} />
                                                        ) : (
                                                            <WarningAmberIcon sx={{ fontSize: "16px !important", color: "white !important" }} />
                                                        )
                                                    }
                                                    label={getDuesStatusLabel(cardData.dues_standing)}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: cardData.dues_standing === "PAID" ? "#2E7D32" : "#ED6C02",
                                                        color: "white",
                                                        fontWeight: 900,
                                                        fontSize: "0.72rem",
                                                        height: 26,
                                                        px: 0.5,
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            ) : (
                                /* ================= CARD DETAILS (BACK) ================= */
                                <Box sx={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
                                    <Box>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pr: 5 }}>
                                            <Typography
                                                variant="overline"
                                                sx={{ color: "#F2A900", fontWeight: 900, letterSpacing: 1.5, fontSize: "0.72rem" }}
                                            >
                                                {t("membership_details_heading", "MEMBERSHIP DETAILS & STANDING")}
                                            </Typography>
                                            <VerifiedIcon sx={{ color: "#F2A900", fontSize: 20 }} />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 900, color: "white", mt: 0.2 }}>
                                            {t("executive_credentials_heading", "Executive Credentials")}
                                        </Typography>
                                        <Divider sx={{ borderColor: "rgba(242, 169, 0, 0.25)", my: 1.5 }} />

                                        <Stack spacing={1.5}>
                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                                                    {t("email_label", "Official Email")}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 800, wordBreak: "break-all" }}>
                                                    {cardData.email}
                                                </Typography>
                                            </Box>

                                            {cardData.phone_number && (
                                                <Box>
                                                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                                                        {t("phone_label", "Phone Number")}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                        {cardData.phone_number}
                                                    </Typography>
                                                </Box>
                                            )}

                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                                                    {t("member_since_label", "Member Since")}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                    {formatMemberDate(cardData.joined_date)}
                                                </Typography>
                                            </Box>

                                            <Box>
                                                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 700 }}>
                                                    {t("fiscal_year_label", "Nordic Fiscal Year")}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 900, color: "#81C784" }}>
                                                    {t("good_standing_period", "2025–2026 In Good Standing")}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Box>

                                    <Box sx={{ textAlign: "center", pt: 2, borderTop: "1px dashed rgba(255,255,255,0.2)" }}>
                                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.68rem", lineHeight: 1.3, display: "block" }}>
                                            {t("card_disclaimer", "This cryptographic credential certifies authorized standing across European and Nordic Lions Districts.")}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>

                        {/* Luxury Floating Actions Bar Below Card */}
                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                                mt: 2,
                                px: 0.5,
                                justifyContent: "center",
                                width: "100%",
                            }}
                        >
                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={<FlipCameraAndroidIcon />}
                                onClick={() => setIsFlipped(!isFlipped)}
                                sx={{
                                    bgcolor: "#F2A900",
                                    color: "#002F6C",
                                    fontWeight: 900,
                                    borderRadius: 3,
                                    minHeight: 46,
                                    fontSize: "0.9rem",
                                    textTransform: "none",
                                    boxShadow: "0 6px 16px rgba(242, 169, 0, 0.4)",
                                    "&:hover": { bgcolor: "#d99800" },
                                }}
                            >
                                {isFlipped ? t("view_qr_card", "View QR Card") : t("card_details_btn", "Card Details")}
                            </Button>

                            <Button
                                fullWidth
                                variant="contained"
                                startIcon={copied ? <CheckCircleIcon sx={{ color: "#81C784" }} /> : <ShareIcon />}
                                onClick={handleShare}
                                sx={{
                                    bgcolor: "rgba(30, 41, 59, 0.85)",
                                    color: "white",
                                    fontWeight: 800,
                                    borderRadius: 3,
                                    minHeight: 46,
                                    fontSize: "0.9rem",
                                    textTransform: "none",
                                    border: "1px solid rgba(255, 255, 255, 0.25)",
                                    backdropFilter: "blur(8px)",
                                    "&:hover": { bgcolor: "rgba(51, 65, 85, 0.95)", borderColor: "white" },
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