// chatup/frontend/src/pages/VerifyMember.tsx
import React, { useState, useEffect } from "react";
import {
    Container,
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Stack,
    Divider,
    Paper,
    Select,
    MenuItem,
    Alert,
} from "@mui/material";
import { ChatUpLogo, ChatUpTitle } from "../components/ChatUpLogo";
import VerifiedIcon from "@mui/icons-material/Verified";
import GppBadIcon from "@mui/icons-material/GppBad";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SecurityIcon from "@mui/icons-material/Security";
import DomainIcon from "@mui/icons-material/Domain";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import PaymentsIcon from "@mui/icons-material/Payments";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface VerificationData {
    is_valid: boolean;
    full_name: string;
    role: string;
    club_name: string;
    district: string;
    organization_header?: string;
    club_logo?: string;
    member_since: string;
    dues_standing: string;
    verified_at: string;
}

export const VerifyMember: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<VerificationData | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get("uid");
        const tid = params.get("tid");
        const sig = params.get("sig");

        if (!uid || !tid || !sig) {
            setErrorMsg(
                t(
                    "missing_qr_params",
                    "Invalid QR Code: Required cryptographic verification parameters are missing."
                )
            );
            setLoading(false);
            return;
        }

        apiClient
            .get<VerificationData>("/members/public-verify", {
                params: { uid, tid, sig },
            })
            .then((res) => {
                setResult(res.data);
            })
            .catch((err) => {
                const detail =
                    err.response?.data?.detail ||
                    t(
                        "verification_failed_desc",
                        "The cryptographic signature is invalid, expired, or has been tampered with."
                    );
                setErrorMsg(detail);
            })
            .finally(() => setLoading(false));
    }, [t]);

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        localStorage.setItem("chatup_lang", lang);
    };

    return (
        <Box
            sx={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #001738 0%, #002F6C 50%, #00122e 100%)",
                py: { xs: 3, sm: 6 },
                px: { xs: 2, sm: 3 },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {/* Top Bar with Language Selector */}
            <Box
                sx={{
                    width: "100%",
                    maxWidth: 520,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 3,
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 900,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        fontSize: { xs: "1rem", sm: "1.2rem" },
                    }}
                >
                    <ChatUpLogo size={32} /> <ChatUpTitle color="white" />
                </Typography>

                <Select
                    size="small"
                    value={i18n.language.startsWith("fi") ? "fi" : i18n.language.startsWith("sv") ? "sv" : "en"}
                    onChange={(e) => changeLanguage(e.target.value)}
                    sx={{
                        bgcolor: "rgba(255, 255, 255, 0.15)",
                        color: "white",
                        borderRadius: 2.5,
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(242, 169, 0, 0.4)",
                        "& .MuiSelect-select": { py: 0.5, px: 1.5 },
                        "& .MuiSvgIcon-root": { color: "white" },
                    }}
                >
                    <MenuItem value="en">🇬🇧 English</MenuItem>
                    <MenuItem value="fi">🇫🇮 Suomi</MenuItem>
                    <MenuItem value="sv">🇸🇪 Svenska</MenuItem>
                </Select>
            </Box>

            {/* Main Certificate Card */}
            <Container maxWidth="xs" sx={{ p: 0 }}>
                {loading ? (
                    <Paper
                        elevation={6}
                        sx={{
                            p: 6,
                            textAlign: "center",
                            borderRadius: 4.5,
                            bgcolor: "rgba(255, 255, 255, 0.95)",
                        }}
                    >
                        <CircularProgress size={56} sx={{ color: "#002F6C", mb: 2 }} />
                        <Typography variant="body1" sx={{ fontWeight: 800, color: "#002F6C" }}>
                            {t("verifying_credentials", "Cryptographically verifying membership credentials...")}
                        </Typography>
                    </Paper>
                ) : errorMsg ? (
                    <Card
                        elevation={10}
                        sx={{
                            borderRadius: 4.5,
                            overflow: "hidden",
                            border: "2px solid #d32f2f",
                            boxShadow: "0 20px 40px rgba(211, 47, 47, 0.35)",
                        }}
                    >
                        <Box sx={{ bgcolor: "#d32f2f", p: 3, textAlign: "center", color: "white" }}>
                            <GppBadIcon sx={{ fontSize: 64, mb: 1 }} />
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>
                                {t("invalid_credential_title", "Verification Failed")}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.9, letterSpacing: 1 }}>
                                {t("status_unverified_member", "UNVERIFIED OR TAMPERED CREDENTIAL")}
                            </Typography>
                        </Box>
                        <CardContent sx={{ p: 3.5, bgcolor: "background.paper" }}>
                            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2.5 }}>
                                {errorMsg}
                            </Alert>
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                                {t(
                                    "invalid_security_warning_universal",
                                    "This digital pass could not be authenticated against the official European registry."
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                ) : result ? (
                    <Card
                        elevation={12}
                        sx={{
                            borderRadius: 5,
                            overflow: "hidden",
                            border: "2px solid #F2A900",
                            boxShadow: "0 24px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(242, 169, 0, 0.25)",
                        }}
                    >
                        {/* Certificate Header Banner */}
                        <Box
                            sx={{
                                background: "linear-gradient(135deg, #002F6C 0%, #001738 100%)",
                                p: 3,
                                textAlign: "center",
                                color: "white",
                                borderBottom: "3px solid #F2A900",
                                position: "relative",
                            }}
                        >
                            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1.5, mb: 1 }}>
                                {result.club_logo && (
                                    <Box
                                        component="img"
                                        src={result.club_logo}
                                        alt="Club Crest"
                                        sx={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: "50%",
                                            objectFit: "cover",
                                            border: "2px solid #F2A900",
                                        }}
                                    />
                                )}
                                <Box
                                    sx={{
                                        display: "inline-flex",
                                        p: 1.2,
                                        borderRadius: "50%",
                                        bgcolor: "#2E7D32",
                                        boxShadow: "0 4px 16px rgba(46, 125, 50, 0.5)",
                                    }}
                                >
                                    <VerifiedIcon sx={{ fontSize: 36, color: "white" }} />
                                </Box>
                            </Box>
                            <Typography variant="overline" sx={{ color: "#F2A900", fontWeight: 900, letterSpacing: 2, display: "block" }}>
                                {result.organization_header || t("default_org_header", "OFFICIAL ASSOCIATION CREDENTIAL")}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 900, color: "white", mt: 0.2 }}>
                                {t("verified_standing_title", "Official Membership Verified")}
                            </Typography>
                            <Chip
                                label={t("status_verified_member", "VERIFIED ACTIVE MEMBER")}
                                size="small"
                                sx={{
                                    bgcolor: "#2E7D32",
                                    color: "white",
                                    fontWeight: 900,
                                    mt: 1,
                                    fontSize: "0.72rem",
                                    height: 24,
                                }}
                            />
                        </Box>

                        {/* Certificate Body Profile */}
                        <CardContent sx={{ p: 3, bgcolor: "background.paper" }}>
                            <Stack spacing={2.2}>
                                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                                    <AccountCircleIcon sx={{ color: "#002F6C", fontSize: 26, mt: 0.3 }} />
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                                            {t("member_name_label", "Member Name")}
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C", lineHeight: 1.2 }}>
                                            {result.full_name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: "#b78103", fontWeight: 800 }}>
                                            {result.role.replace("_", " ")}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Divider />

                                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                                    <DomainIcon sx={{ color: "#002F6C", fontSize: 26, mt: 0.3 }} />
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                                            {t("chartered_club", "Club & Jurisdiction")}
                                        </Typography>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary" }}>
                                            {result.club_name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                            {result.district}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Divider />

                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                                        <CalendarMonthIcon sx={{ color: "text.secondary", fontSize: 22, mt: 0.2 }} />
                                        <Box>
                                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                                                {t("member_since_label", "Member Since")}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                {result.member_since}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                                        <PaymentsIcon sx={{ color: "text.secondary", fontSize: 22, mt: 0.2 }} />
                                        <Box>
                                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
                                                {t("fiscal_dues_status", "Dues Status")}
                                            </Typography>
                                            <Box sx={{ mt: 0.2 }}>
                                                <Chip
                                                    icon={result.dues_standing === "PAID" ? <CheckCircleIcon sx={{ fontSize: "14px !important" }} /> : <WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
                                                    label={result.dues_standing}
                                                    color={result.dues_standing === "PAID" ? "success" : "warning"}
                                                    size="small"
                                                    sx={{ fontWeight: 800, height: 22, fontSize: "0.7rem" }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>

                                <Divider />

                                <Paper elevation={0} sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 2.5, textAlign: "center" }}>
                                    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.5, mb: 0.3 }}>
                                        <SecurityIcon sx={{ color: "#2E7D32", fontSize: 16 }} />
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: "#2E7D32" }}>
                                            {t("tamper_proof_security", "HMAC-SHA256 Cryptographic Authentication")}
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.7rem" }}>
                                        Verified at: <b>{result.verified_at}</b> • AWS Europe Central
                                    </Typography>
                                </Paper>
                            </Stack>
                        </CardContent>
                    </Card>
                ) : null}
            </Container>
        </Box>
    );
};