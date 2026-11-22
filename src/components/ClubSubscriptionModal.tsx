// chatup/frontend/src/components/ClubSubscriptionModal.tsx
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Chip,
    Stack,
} from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface Props {
    open: boolean;
    onClose: () => void;
    clubId: string;
    clubName: string;
    memberCount: number;
    currentFeatures: any;
    onSuccess: () => void;
}

export const ClubSubscriptionModal: React.FC<Props> = ({
    open,
    onClose,
    clubId,
    clubName,
    memberCount,
    currentFeatures,
    onSuccess,
}) => {
    const { t } = useTranslation();

    const [planType, setPlanType] = useState("CLUB_EXECUTIVE");
    const [billingCycle, setBillingCycle] = useState("YEARLY");
    const [subStatus, setSubStatus] = useState("TRIAL");
    const [maxMembers, setMaxMembers] = useState(75);
    const [trialDays, setTrialDays] = useState(60);
    const [customPrice, setCustomPrice] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    useEffect(() => {
        if (open && currentFeatures) {
            setPlanType(currentFeatures.plan_type || "CLUB_EXECUTIVE");
            setBillingCycle(currentFeatures.billing_cycle || "YEARLY");
            setSubStatus(currentFeatures.subscription_status || "TRIAL");
            setMaxMembers(currentFeatures.max_members || 75);
            setCustomPrice(
                currentFeatures.custom_price_eur !== undefined && currentFeatures.custom_price_eur !== null
                    ? String(currentFeatures.custom_price_eur)
                    : ""
            );
            setErrorMsg("");
            setSuccessMsg("");
        }
    }, [open, currentFeatures]);

    const handlePlanChange = (newPlan: string) => {
        setPlanType(newPlan);
        if (newPlan === "FLEX_PER_PERSON") setMaxMembers(35);
        else if (newPlan === "CLUB_EXECUTIVE") setMaxMembers(75);
        else if (newPlan === "ASSOCIATION_PRO") setMaxMembers(200);
        else if (newPlan === "DISTRICT_BUNDLE") {
            setMaxMembers(100);
            setBillingCycle("YEARLY");
        }
    };

    const getEstimatedPrice = () => {
        if (customPrice && !isNaN(Number(customPrice))) return Number(customPrice).toFixed(2);
        const seats = Math.max(5, memberCount);
        if (planType === "FLEX_PER_PERSON") {
            return (seats * (billingCycle === "YEARLY" ? 19.0 : 1.9)).toFixed(2);
        }
        if (planType === "ASSOCIATION_PRO") {
            return (billingCycle === "YEARLY" ? 790.0 : 79.0).toFixed(2);
        }
        if (planType === "DISTRICT_BUNDLE") return "320.00";
        return (billingCycle === "YEARLY" ? 490.0 : 49.0).toFixed(2);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            await apiClient.patch(`/admin/clubs/${clubId}/subscription`, {
                plan_type: planType,
                billing_cycle: billingCycle,
                subscription_status: subStatus,
                max_members: maxMembers,
                trial_days: trialDays,
                custom_price_eur: customPrice.trim() ? parseFloat(customPrice) : null,
            });
            setSuccessMsg(t("sub_saved_msg", "Subscription license updated successfully!"));
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 900);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.detail || "Failed to update subscription plan");
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
            <DialogTitle sx={{ fontWeight: 900, color: "#002F6C", display: "flex", alignItems: "center", gap: 1 }}>
                <WorkspacePremiumIcon sx={{ color: "#F2A900" }} />
                {t("manage_subscription_title", "SaaS License & Billing")}: {clubName}
            </DialogTitle>
            <Box component="form" onSubmit={handleSave} sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

                    {/* Live Price Estimator Banner */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            mb: 2.5,
                            borderRadius: 3,
                            bgcolor: "rgba(0, 47, 108, 0.05)",
                            border: "1.5px solid rgba(0, 47, 108, 0.2)",
                        }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("calculated_billing", "Calculated License Fee")} ({memberCount} Active Members)
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                    €{getEstimatedPrice()}
                                    <Typography component="span" variant="body2" sx={{ color: "text.secondary", fontWeight: 700, ml: 0.5 }}>
                                        / {billingCycle === "YEARLY" ? t("per_year", "Year") : t("per_month", "Month")}
                                    </Typography>
                                </Typography>
                            </Box>
                            <Chip
                                label={subStatus}
                                color={subStatus === "ACTIVE" ? "success" : subStatus === "TRIAL" ? "warning" : "error"}
                                sx={{ fontWeight: 900 }}
                            />
                        </Box>
                    </Paper>

                    <Stack spacing={2}>
                        <FormControl fullWidth>
                            <InputLabel>{t("select_plan_label", "Subscription Package")}</InputLabel>
                            <Select
                                value={planType}
                                label={t("select_plan_label", "Subscription Package")}
                                onChange={(e) => handlePlanChange(e.target.value)}
                            >
                                <MenuItem value="FLEX_PER_PERSON">
                                    Flex Per-Person (€1.90/member/mo or €19/member/yr)
                                </MenuItem>
                                <MenuItem value="CLUB_EXECUTIVE">
                                    Club Executive Flat (€49/mo or €490/yr • Up to 75 Members)
                                </MenuItem>
                                <MenuItem value="ASSOCIATION_PRO">
                                    Association Pro Flat (€79/mo or €790/yr • Up to 200 Members)
                                </MenuItem>
                                <MenuItem value="DISTRICT_BUNDLE">
                                    District Governor Wholesale (€320/club/yr • Multi-Club)
                                </MenuItem>
                            </Select>
                        </FormControl>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            <FormControl fullWidth>
                                <InputLabel>{t("billing_cycle_label", "Billing Cycle")}</InputLabel>
                                <Select
                                    value={billingCycle}
                                    label={t("billing_cycle_label", "Billing Cycle")}
                                    onChange={(e) => setBillingCycle(e.target.value)}
                                    disabled={planType === "DISTRICT_BUNDLE"}
                                >
                                    <MenuItem value="YEARLY">Yearly (Save ~17% • SEPA Invoice)</MenuItem>
                                    <MenuItem value="MONTHLY">Monthly (Flexible Cancel)</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControl fullWidth>
                                <InputLabel>{t("sub_status_label", "License Status")}</InputLabel>
                                <Select
                                    value={subStatus}
                                    label={t("sub_status_label", "License Status")}
                                    onChange={(e) => setSubStatus(e.target.value)}
                                >
                                    <MenuItem value="TRIAL">Free Pilot Trial</MenuItem>
                                    <MenuItem value="ACTIVE">Active (Paid)</MenuItem>
                                    <MenuItem value="PAST_DUE">Past Due (Reminder)</MenuItem>
                                    <MenuItem value="SUSPENDED">Suspended</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>

                        <Divider />

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            <TextField
                                fullWidth
                                type="number"
                                label={t("max_members", "Maximum Member Quota")}
                                value={maxMembers}
                                onChange={(e) => setMaxMembers(parseInt(e.target.value) || 50)}
                            />

                            {subStatus === "TRIAL" ? (
                                <TextField
                                    fullWidth
                                    type="number"
                                    label={t("trial_days_label", "Trial Duration (Days)")}
                                    value={trialDays}
                                    onChange={(e) => setTrialDays(parseInt(e.target.value) || 60)}
                                />
                            ) : (
                                <TextField
                                    fullWidth
                                    type="number"
                                    label={t("custom_price_override", "Custom Negotiated Price (€ Optional)")}
                                    value={customPrice}
                                    onChange={(e) => setCustomPrice(e.target.value)}
                                    placeholder="Leave blank for standard rate"
                                />
                            )}
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} disabled={submitting}>
                        {t("cancel_btn", "Cancel")}
                    </Button>
                    <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 900, bgcolor: "#002F6C", borderRadius: 2.5 }}>
                        {submitting ? <CircularProgress size={24} color="inherit" /> : t("save_license_btn", "Update License")}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};