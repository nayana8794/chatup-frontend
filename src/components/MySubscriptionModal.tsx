// chatup/frontend/src/components/MySubscriptionModal.tsx
import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Button,
    Chip,
    Stack,
    CircularProgress,
    Paper,
    Divider,
    Alert,
} from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface SubscriptionInfo {
    has_club: boolean;
    club_name?: string;
    plan_type?: string;
    billing_cycle?: string;
    subscription_status?: string;
    member_count?: number;
    max_members?: number;
    calculated_price_eur?: number;
    setup_fee_eur?: number;
    total_amount_eur?: number;
    trial_ends_at?: string;
    next_billing_date?: string;
    sepa_iban?: string;
    sepa_bic?: string;
    viitenumero?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

export const MySubscriptionModal: React.FC<Props> = ({ open, onClose }) => {
    const { t } = useTranslation();
    const [info, setInfo] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) {
            setLoading(true);
            apiClient
                .get<SubscriptionInfo>("/members/my-club/subscription")
                .then((res) => setInfo(res.data))
                .catch(() => setInfo(null))
                .finally(() => setLoading(false));
        }
    }, [open]);

    const formatUtcDate = (str?: string) => {
        if (!str) return "—";
        const safe = str.endsWith("Z") ? str : `${str}Z`;
        return new Date(safe).toLocaleDateString();
    };

    const getPlanDisplayName = (plan?: string) => {
        switch (plan) {
            case "FLEX_PER_PERSON":
                return t("plan_flex_name", "Flex Per-Member Plan");
            case "ASSOCIATION_PRO":
                return t("plan_pro_name", "Association Pro Plan");
            case "DISTRICT_BUNDLE":
                return t("plan_district_name", "District Wholesale License");
            default:
                return t("plan_exec_name", "Club Executive Plan");
        }
    };

    const handleCopyBank = () => {
        if (!info) return;
        const text = `IBAN: ${info.sepa_iban}\nBIC: ${info.sepa_bic}\nReference (Viitenumero): ${info.viitenumero}\nTotal Amount: EUR ${(info.total_amount_eur || info.calculated_price_eur || 0).toFixed(2)}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: { xs: 1.5, sm: 2 }, borderRadius: 4 } }}>
            <DialogTitle sx={{ fontWeight: 900, color: "primary.main", display: "flex", alignItems: "center", gap: 1 }}>
                <WorkspacePremiumIcon sx={{ color: "#F2A900" }} />
                {t("my_club_license_title", "Club SaaS License & Billing")}
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ p: 5, display: "flex", justifyContent: "center" }}>
                        <CircularProgress />
                    </Box>
                ) : !info || !info.has_club ? (
                    <Alert severity="info">{t("no_club_license", "No active club subscription found.")}</Alert>
                ) : (
                    <Stack spacing={2.5}>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "action.hover", borderLeft: "5px solid #F2A900" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                                <Box>
                                    <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary" }}>
                                        {info.club_name}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                                        {getPlanDisplayName(info.plan_type)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {t("active_seats_label", "Member Quota Usage")}: <b>{info.member_count} / {info.max_members}</b>
                                    </Typography>
                                </Box>

                                <Chip
                                    label={info.subscription_status}
                                    color={info.subscription_status === "ACTIVE" ? "success" : info.subscription_status === "TRIAL" ? "warning" : "error"}
                                    sx={{ fontWeight: 900 }}
                                />
                            </Box>

                            <Divider sx={{ my: 1.5 }} />

                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {info.subscription_status === "TRIAL"
                                        ? `${t("trial_ends_label", "Free Pilot Ends")}: ${formatUtcDate(info.trial_ends_at)}`
                                        : `${t("next_renewal_label", "Next Renewal")}: ${formatUtcDate(info.next_billing_date)}`}
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                                    €{(info.total_amount_eur || info.calculated_price_eur || 0).toFixed(2)} / {info.billing_cycle === "YEARLY" ? t("per_year", "Year") : t("per_month", "Month")}
                                </Typography>
                            </Box>
                        </Paper>

                        {/* Official SEPA Invoice Payment Box for Finnish/EU Treasurers */}
                        <Paper elevation={1} sx={{ p: 2.5, borderRadius: 3, border: "1.5px solid", borderColor: "primary.main" }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                                <AccountBalanceIcon color="primary" />
                                <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main" }}>
                                    {t("sepa_license_invoice_title", "SEPA Bank Transfer Invoice (Zero Fee)")}
                                </Typography>
                            </Box>

                            <Stack spacing={1} sx={{ bgcolor: "background.default", p: 2, borderRadius: 2 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>IBAN:</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 800 }}>{info.sepa_iban}</Typography>
                                </Box>
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>BIC:</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 800 }}>{info.sepa_bic}</Typography>
                                </Box>
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Viitenumero (Ref):</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 900, color: "primary.main" }}>{info.viitenumero}</Typography>
                                </Box>
                                <Divider sx={{ my: 0.5 }} />
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t("sub_license_base", "Subscription License")}:</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>EUR {info.calculated_price_eur?.toFixed(2)}</Typography>
                                </Box>
                                {Boolean(info.setup_fee_eur && info.setup_fee_eur > 0) && (
                                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t("setup_onboarding_fee", "One-Time Setup Fee")}:</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>EUR {info.setup_fee_eur?.toFixed(2)}</Typography>
                                    </Box>
                                )}
                                <Box sx={{ display: "flex", justifyContent: "space-between", pt: 0.5, borderTop: "1px dashed #ccc" }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "primary.main" }}>{t("total_payable_amount", "Total Payable")}:</Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900, color: "primary.main" }}>
                                        EUR {(info.total_amount_eur || info.calculated_price_eur || 0).toFixed(2)} (VAT 0%)
                                    </Typography>
                                </Box>
                            </Stack>

                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={copied ? <CheckCircleIcon color="success" /> : <ContentCopyIcon />}
                                onClick={handleCopyBank}
                                sx={{ mt: 2, fontWeight: 800, borderRadius: 2.5 }}
                            >
                                {copied ? t("copied_btn", "Copied!") : t("copy_sepa_btn", "Copy SEPA Payment Details")}
                            </Button>
                        </Paper>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button variant="contained" onClick={onClose} sx={{ fontWeight: 800, borderRadius: 2.5 }}>
                    {t("close_btn", "Close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};