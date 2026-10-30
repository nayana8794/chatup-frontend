// chatup/frontend/src/pages/MembershipDues.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Card,
    CardContent,
    Chip,
    IconButton,
    TextField,
    Tabs,
    Tab,
    Stack,
    Divider,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Tooltip,
    Alert,
    LinearProgress,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AddCardIcon from "@mui/icons-material/AddCard";
import CreditScoreIcon from "@mui/icons-material/CreditScore";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import EditIcon from "@mui/icons-material/Edit";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import DeleteIcon from "@mui/icons-material/Delete";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { playNotificationChime } from "../utils/sound";
import apiClient from "../api/client";

interface DuesInvoice {
    id: string;
    user_id: string;
    member_name: string;
    member_role: string;
    member_email: string;
    title: string;
    billing_cycle: "YEARLY" | "MONTHLY" | "QUARTERLY" | "ONE_TIME";
    amount: number;
    currency: string;
    due_date: string;
    status: "PENDING" | "AWAITING_VERIFICATION" | "PAID" | "OVERDUE" | "WAIVED";
    is_approved: boolean;
    reported_at?: string;
    reported_method?: string;
    paid_at?: string;
    payment_method?: string;
    verified_by?: string;
    verifier_name?: string;
    reference_number: string;
    notes?: string;
    created_at: string;
}

interface FinancialStats {
    total_collected: number;
    total_pending: number;
    total_awaiting_verification: number;
    paid_members_count: number;
    pending_members_count: number;
    awaiting_verification_count: number;
    pending_approval_count: number;
    recipient_name: string;
    club_iban: string;
    club_bic: string;
    mobilepay_number?: string;
}

interface BatchSummary {
    title: string;
    billing_cycle: string;
    amount: number;
    due_date: string;
    is_approved: boolean;
    created_at: string;
    total_invoices: number;
    paid_count: number;
    total_expected: number;
    total_collected: number;
}

export const MembershipDues: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const isTreasurer = ["SUPER_ADMIN", "TREASURER", "VICE_TREASURER"].includes(user?.role || "");
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");
    const hasManagementAccess = isTreasurer || isPresident;

    const [invoices, setInvoices] = useState<DuesInvoice[]>([]);
    const [stats, setStats] = useState<FinancialStats | null>(null);
    const [batches, setBatches] = useState<BatchSummary[]>([]);
    const [loading, setLoading] = useState(true);

    // Tabs
    const [tab, setTab] = useState<"MY_INVOICES" | "ALL_INVOICES" | "AWAITING" | "BATCH_AUDIT" | "HISTORY">(
        isPresident ? "ALL_INVOICES" : isTreasurer ? "ALL_INVOICES" : "MY_INVOICES"
    );

    const [auditFilter, setAuditFilter] = useState<"ALL" | "PAID" | "UNPAID" | "AWAITING">("ALL");
    const [historyMemberFilter, setHistoryMemberFilter] = useState("ALL");
    const [historyCycleFilter, setHistoryCycleFilter] = useState("ALL");

    // Batch Generation Modal States (Treasurer only)
    const [openBatchModal, setOpenBatchModal] = useState(false);
    const [batchTitle, setBatchTitle] = useState("Annual Membership Fee 2026/2027");
    const [billingCycle, setBillingCycle] = useState<"YEARLY" | "MONTHLY">("YEARLY");
    const [batchAmount, setBatchAmount] = useState("120");
    const [batchDueDate, setBatchDueDate] = useState("2026-11-30");

    // Batch Amendment Modal States (Treasurer only)
    const [openAmendModal, setOpenAmendModal] = useState(false);
    const [amendCurrentTitle, setAmendCurrentTitle] = useState("");
    const [amendNewTitle, setAmendNewTitle] = useState("");
    const [amendAmount, setAmendAmount] = useState("");
    const [amendDueDate, setAmendDueDate] = useState("");

    // Bank Details Modal
    const [openBankModal, setOpenBankModal] = useState(false);
    const [editRecipient, setEditRecipient] = useState("");
    const [editIban, setEditIban] = useState("");
    const [editBic, setEditBic] = useState("");
    const [editMobilePay, setEditMobilePay] = useState("");

    // Member Report Modal
    const [reportingInvoice, setReportingInvoice] = useState<DuesInvoice | null>(null);
    const [reportMethod, setReportMethod] = useState("MobilePay");
    const [reportReference, setReportReference] = useState("");

    // Confirm Payment Modal
    const [confirmingInvoice, setConfirmingInvoice] = useState<DuesInvoice | null>(null);
    const [confirmNotes, setConfirmNotes] = useState("");

    const [copiedText, setCopiedText] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [invRes, statsRes, batchRes] = await Promise.all([
                apiClient.get("/financial/dues"),
                apiClient.get("/financial/stats"),
                apiClient.get("/financial/batches/history").catch(() => ({ data: [] })),
            ]);
            setInvoices(invRes.data);
            setStats(statsRes.data);
            setBatches(batchRes.data);
        } catch (err) {
            console.error("Failed to load dues telemetry:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleFocus = () => {
            fetchData();
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    useEffect(() => {
        if (!lastEvent) return;

        const evType = String(lastEvent.type);
        if (
            evType === "DUES_BATCH_APPROVED" ||
            evType === "DUES_APPROVAL_NEEDED" ||
            evType === "DUES_BATCH_AMENDED" ||
            evType === "DUES_BATCH_CANCELLED" ||
            evType === "DUES_GENERATED" ||
            evType === "DUES_PAID" ||
            evType === "PAYMENT_REPORTED"
        ) {
            playNotificationChime();
            fetchData();
        }
    }, [lastEvent, fetchData]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedText(label);
        setTimeout(() => setCopiedText(null), 2500);
    };

    const handleOpenBankModal = () => {
        if (stats) {
            setEditRecipient(stats.recipient_name || "");
            setEditIban(stats.club_iban || "");
            setEditBic(stats.club_bic || "");
            setEditMobilePay(stats.mobilepay_number || "");
        }
        setOpenBankModal(true);
    };

    const handleSaveBankDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiClient.put("/financial/bank-details", {
                recipient_name: editRecipient,
                iban: editIban,
                bic: editBic,
                mobilepay_number: editMobilePay,
            });
            setOpenBankModal(false);
            fetchData();
            alert(t("bank_details_saved", "Club bank details and MobilePay number updated successfully!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_saving_bank", "Error saving bank details."));
        }
    };

    const handleBatchGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiClient.post("/financial/dues/batch", {
                title: batchTitle,
                billing_cycle: billingCycle,
                amount: parseFloat(batchAmount) || 120,
                due_date: new Date(batchDueDate).toISOString(),
            });
            setOpenBatchModal(false);
            fetchData();
            alert(t("batch_submitted_msg", "Dues batch submitted! Awaiting President or Vice President approval."));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_generating_dues", "Error generating dues."));
        }
    };

    const handleOpenAmendBatch = (title: string) => {
        const batchInvs = invoices.filter((i) => i.title === title && !i.is_approved);
        if (batchInvs.length > 0) {
            const sample = batchInvs[0];
            setAmendCurrentTitle(title);
            setAmendNewTitle(title);
            setAmendAmount(String(sample.amount));
            setAmendDueDate(new Date(sample.due_date).toISOString().slice(0, 10));
            setOpenAmendModal(true);
        }
    };

    const handleSaveAmendBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiClient.put("/financial/dues/batch", {
                current_title: amendCurrentTitle,
                new_title: amendNewTitle,
                amount: parseFloat(amendAmount),
                due_date: new Date(amendDueDate).toISOString(),
            });
            setOpenAmendModal(false);
            fetchData();
            alert(t("batch_amended_msg", "Batch successfully amended!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_amending_batch", "Error amending batch."));
        }
    };

    const handleCancelBatch = async (title: string) => {
        if (!window.confirm(`${t("confirm_cancel_batch", "Are you sure you want to cancel and delete the proposed batch")} "${title}"?`)) return;
        try {
            await apiClient.delete(`/financial/dues/batch?title=${encodeURIComponent(title)}`);
            fetchData();
            alert(`${t("batch_cancelled_msg", "Batch cancelled successfully:")} "${title}"`);
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_cancelling_batch", "Error cancelling batch."));
        }
    };

    const handleApproveBatch = async (batchTitleToApprove: string) => {
        try {
            await apiClient.post(`/financial/dues/batch/approve?title=${encodeURIComponent(batchTitleToApprove)}`);
            fetchData();
            alert(`${t("batch_approved_msg", "Dues batch approved and issued to all members:")} "${batchTitleToApprove}"`);
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_approving_batch", "Error approving batch."));
        }
    };

    const handleReportPaymentSubmit = async () => {
        if (!reportingInvoice) return;
        try {
            await apiClient.post(`/financial/dues/${reportingInvoice.id}/report-payment`, {
                payment_method: reportMethod,
                transaction_reference: reportReference,
            });
            setReportingInvoice(null);
            fetchData();
            alert(t("payment_reported_msg", "Payment reported successfully! Awaiting Treasurer confirmation."));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_reporting_payment", "Error reporting payment."));
        }
    };

    const handleConfirmPaymentSubmit = async () => {
        if (!confirmingInvoice) return;
        try {
            await apiClient.patch(`/financial/dues/${confirmingInvoice.id}/confirm`, {
                payment_method: confirmingInvoice.reported_method || "SEPA Bank Transfer",
                notes: confirmNotes,
            });
            setConfirmingInvoice(null);
            fetchData();
            alert(t("payment_confirmed_msg", "Payment verified and confirmed successfully!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("error_confirming_payment", "Error confirming payment."));
        }
    };

    const unapprovedBatches = Array.from(
        new Set(invoices.filter((i) => !i.is_approved).map((i) => i.title))
    );

    useEffect(() => {
        if (unapprovedBatches.length > 0) {
            const timer = setInterval(() => {
                fetchData();
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [unapprovedBatches.length, fetchData]);

    const approvedInvoices = invoices.filter((i) => i.is_approved);

    const displayedInvoices = invoices.filter((inv) => {
        if (tab === "MY_INVOICES") return inv.user_id === user?.user_id && inv.is_approved;
        if (tab === "AWAITING") return inv.status === "AWAITING_VERIFICATION";
        if (tab === "HISTORY") {
            if (inv.status !== "PAID") return false;
            if (historyMemberFilter !== "ALL" && inv.user_id !== historyMemberFilter) return false;
            if (historyCycleFilter !== "ALL" && inv.billing_cycle !== historyCycleFilter) return false;
            return true;
        }
        if (tab === "ALL_INVOICES") {
            if (!inv.is_approved) return false;
            if (auditFilter === "PAID") return inv.status === "PAID";
            if (auditFilter === "UNPAID") return inv.status === "PENDING" || inv.status === "OVERDUE";
            if (auditFilter === "AWAITING") return inv.status === "AWAITING_VERIFICATION";
            return true;
        }
        return true;
    });

    const uniqueMembers = Array.from(
        new Map(invoices.map((inv) => [inv.user_id, { id: inv.user_id, name: inv.member_name }])).values()
    );

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 }, px: { xs: 2, sm: 3 } }}>
            {/* Top Header Bar: 100% Center-Aligned on Desktop matching Events & Voting */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 3.5,
                }}
            >
                {/* Left Slot: Back Button with Balanced Sizing */}
                <Box sx={{ minWidth: { sm: 200 } }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={onBack}
                        variant="outlined"
                        sx={{
                            fontWeight: 800,
                            minHeight: 44,
                            borderRadius: 2.5,
                            px: 2.5,
                            textTransform: "none",
                            fontSize: "0.95rem",
                            borderColor: "rgba(0, 47, 108, 0.35)",
                            color: "primary.main",
                            width: { xs: "100%", sm: "auto" },
                        }}
                    >
                        {t("back_to_dashboard", "Back to Dashboard")}
                    </Button>
                </Box>

                {/* Center Slot: 100% Mathematically Centered Title */}
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 900,
                        fontSize: { xs: "1.35rem", sm: "1.65rem" },
                        color: "text.primary",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.2,
                        textAlign: "center",
                        flex: 1,
                    }}
                >
                    💶 {t("dues_title", "Membership Dues & Club Treasury")}
                </Typography>

                {/* Right Slot: Right-Aligned Executive Oversight Chip or Treasurer Action */}
                <Box
                    sx={{
                        minWidth: { sm: 200 },
                        display: "flex",
                        justifyContent: { xs: "center", sm: "flex-end" },
                        alignItems: "center",
                    }}
                >
                    {isTreasurer ? (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddCardIcon />}
                            onClick={() => setOpenBatchModal(true)}
                            sx={{
                                fontWeight: 900,
                                minHeight: 44,
                                borderRadius: 2.5,
                                px: 2.5,
                                bgcolor: "#002F6C",
                                textTransform: "none",
                                fontSize: "0.95rem",
                                width: { xs: "100%", sm: "auto" },
                                "&:hover": { bgcolor: "#001f4d" },
                            }}
                        >
                            {t("batch_generate_btn", "Generate Dues Batch")}
                        </Button>
                    ) : isPresident ? (
                        <Chip
                            label={t("executive_oversight", "Executive Oversight")}
                            color="primary"
                            size="medium"
                            sx={{
                                fontWeight: 800,
                                fontSize: "0.82rem",
                                px: 1,
                                py: 0.5,
                                bgcolor: "#002F6C",
                                color: "white",
                                boxShadow: "0 2px 6px rgba(0, 47, 108, 0.25)",
                            }}
                        />
                    ) : (
                        <Box sx={{ width: 0, display: { xs: "none", sm: "block" } }} />
                    )}
                </Box>
            </Stack>

            {copiedText && (
                <Alert severity="success" sx={{ mb: 2.5, borderRadius: 3, fontWeight: "bold" }}>
                    {copiedText} {t("copied", "copied to clipboard")}
                </Alert>
            )}

            {/* President Actionable Approval Banner */}
            {isPresident && unapprovedBatches.length > 0 && (
                <Alert
                    severity="info"
                    icon={<VerifiedUserIcon sx={{ fontSize: 36, color: "#1976D2" }} />}
                    sx={{
                        mb: 3,
                        p: 2,
                        borderRadius: 3.5,
                        bgcolor: "#EBF3FC",
                        border: "1px solid #C2DCFA",
                        "& .MuiAlert-message": { width: "100%" },
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#002F6C" }}>
                                ⚠️ {t("proposed_batches_approval_title", "Proposed Dues Batches Awaiting Your Approval:")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.primary", mt: 0.5 }}>
                                {t("proposed_batches_approval_desc", "Treasurer proposed")} <b>{unapprovedBatches.join(", ")}</b>. {t("review_and_approve_desc", "Review and approve to issue invoices to members.")}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1.5}>
                            {unapprovedBatches.map((batchTitleItem) => (
                                <Button
                                    key={batchTitleItem}
                                    variant="contained"
                                    size="medium"
                                    startIcon={<CheckCircleIcon />}
                                    onClick={() => handleApproveBatch(batchTitleItem)}
                                    sx={{
                                        fontWeight: 800,
                                        bgcolor: "#002F6C",
                                        "&:hover": { bgcolor: "#001E47" },
                                        borderRadius: 2.5,
                                        px: 2.5,
                                        py: 1,
                                    }}
                                >
                                    {t("approve_batch_btn", "Approve")} "{batchTitleItem}"
                                </Button>
                            ))}
                        </Stack>
                    </Box>
                </Alert>
            )}

            {/* Treasurer Tracking Banner */}
            {!isPresident && isTreasurer && unapprovedBatches.length > 0 && (
                <Alert
                    severity="warning"
                    icon={<PendingActionsIcon sx={{ fontSize: 36, color: "#E65100" }} />}
                    sx={{
                        mb: 3,
                        p: 2,
                        borderRadius: 3.5,
                        bgcolor: "#FFF7ED",
                        border: "1px solid #FFEDD5",
                        "& .MuiAlert-message": { width: "100%" },
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#9A3412" }}>
                                ⏳ {t("submitted_batches_awaiting_title", "Submitted Batches Awaiting President Approval:")}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.primary", mt: 0.5 }}>
                                {t("you_proposed_desc", "You have proposed")} <b>{unapprovedBatches.join(", ")}</b>. {t("can_amend_cancel_desc", "You can amend or cancel before President approves.")}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            {unapprovedBatches.map((batchTitleItem) => (
                                <React.Fragment key={batchTitleItem}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<EditIcon />}
                                        onClick={() => handleOpenAmendBatch(batchTitleItem)}
                                        sx={{ fontWeight: 800, borderRadius: 2 }}
                                    >
                                        {t("amend_btn", "Amend")}
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleCancelBatch(batchTitleItem)}
                                        sx={{ fontWeight: 800, borderRadius: 2 }}
                                    >
                                        {t("cancel_batch_btn", "Cancel Batch")}
                                    </Button>
                                </React.Fragment>
                            ))}
                        </Stack>
                    </Box>
                </Alert>
            )}

            {/* Summary KPI Cards */}
            {stats && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                        gap: 2.5,
                        mb: 4,
                    }}
                >
                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #2E7D32" }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t("total_collected", "Total Collected")}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "success.main" }}>
                                €{stats.total_collected.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {t("members_verified_paid", "{count} Members Verified & Paid").replace("{count}", String(stats.paid_members_count))}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #E65100" }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t("awaiting_verification", "Awaiting Verification")}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#E65100" }}>
                                {stats.awaiting_verification_count}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {t("reported_by_members", "€{amount} Reported by Members").replace("{amount}", stats.total_awaiting_verification.toFixed(2))}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #002F6C" }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t("total_pending", "Total Pending")}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "primary.main" }}>
                                €{stats.total_pending.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {t("invoices_unpaid", "{count} Invoices Unpaid").replace("{count}", String(stats.pending_members_count))}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Official Bank Details Card */}
            {stats && (
                <Paper
                    elevation={3}
                    sx={{
                        p: { xs: 2.5, sm: 3.5 },
                        mb: 4,
                        borderRadius: 3.5,
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "primary.light",
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <AccountBalanceIcon color="primary" sx={{ fontSize: 32 }} />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                {t("bank_transfer_box_title", "Official SEPA Bank Transfer Details")}
                            </Typography>
                        </Box>

                        {isTreasurer && (
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={handleOpenBankModal}
                                sx={{ fontWeight: 800, borderRadius: 2 }}
                            >
                                {t("edit_bank_details", "Edit Bank & MobilePay")}
                            </Button>
                        )}
                    </Box>

                    <Divider sx={{ mb: 2.5 }} />

                    <Stack spacing={2}>
                        {/* Recipient */}
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: { xs: "column", sm: "row" },
                                justifyContent: "space-between",
                                alignItems: { xs: "flex-start", sm: "center" },
                                p: 1.5,
                                bgcolor: "action.hover",
                                borderRadius: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {t("recipient_name", "Recipient")}
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 800 }}>
                                    {stats.recipient_name}
                                </Typography>
                            </Box>
                            <Chip label={t("sepa_mobilepay_badge", "SEPA Core & MobilePay")} color="primary" size="small" sx={{ fontWeight: 700 }} />
                        </Box>

                        {/* IBAN & BIC */}
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: { xs: "column", sm: "row" },
                                justifyContent: "space-between",
                                alignItems: { xs: "flex-start", sm: "center" },
                                p: 1.5,
                                bgcolor: "action.hover",
                                borderRadius: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {t("iban_label", "IBAN Account Number")} (BIC: <b>{stats.club_bic}</b>)
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 800, letterSpacing: 1 }}>
                                    {stats.club_iban}
                                </Typography>
                            </Box>
                            <Tooltip title={t("copy_iban", "Copy IBAN")}>
                                <Button
                                    size="small"
                                    startIcon={<ContentCopyIcon />}
                                    onClick={() => copyToClipboard(stats.club_iban, "IBAN")}
                                    sx={{ fontWeight: 800 }}
                                >
                                    {t("copy_iban", "Copy IBAN")}
                                </Button>
                            </Tooltip>
                        </Box>

                        {/* MobilePay */}
                        {stats.mobilepay_number && (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: { xs: "column", sm: "row" },
                                    justifyContent: "space-between",
                                    alignItems: { xs: "flex-start", sm: "center" },
                                    p: 1.5,
                                    bgcolor: "action.hover",
                                    borderRadius: 2,
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <PhoneAndroidIcon color="primary" />
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                            {t("mobilepay_label", "MobilePay Number / Box ID")}
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 800, color: "primary.main" }}>
                                            {stats.mobilepay_number}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Tooltip title={t("copy_mobilepay", "Copy MobilePay Number")}>
                                    <Button
                                        size="small"
                                        startIcon={<ContentCopyIcon />}
                                        onClick={() => copyToClipboard(stats.mobilepay_number || "", "MobilePay Number")}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        {t("copy_mobilepay", "Copy MobilePay")}
                                    </Button>
                                </Tooltip>
                            </Box>
                        )}
                    </Stack>
                </Paper>
            )}

            {/* Tabs */}
            {hasManagementAccess && (
                <Tabs
                    value={tab}
                    onChange={(_, val) => setTab(val)}
                    sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
                >
                    <Tab label={t("my_dues_tab", "My Membership Invoices")} value="MY_INVOICES" sx={{ fontWeight: 800, fontSize: "1rem" }} />

                    {isTreasurer && (
                        <Tab
                            label={`${t("verification_queue_tab", "Verification Queue")} (${stats?.awaiting_verification_count || 0})`}
                            value="AWAITING"
                            sx={{ fontWeight: 800, fontSize: "1rem", color: "#E65100" }}
                        />
                    )}

                    <Tab
                        label={isPresident && !isTreasurer ? t("member_paid_status_tab", "Member Paid Status (Audit)") : t("all_members_dues_tab", "All Members Dues (Audit)")}
                        value="ALL_INVOICES"
                        sx={{ fontWeight: 800, fontSize: "1rem" }}
                    />

                    <Tab
                        icon={<FactCheckIcon />}
                        iconPosition="start"
                        label={t("dues_batches_audit_tab", "Dues Batches (Audit)")}
                        value="BATCH_AUDIT"
                        sx={{ fontWeight: 800, fontSize: "1rem", color: "primary.main" }}
                    />

                    <Tab
                        icon={<HistoryIcon />}
                        iconPosition="start"
                        label={t("payment_history_tab", "Payment History")}
                        value="HISTORY"
                        sx={{ fontWeight: 800, fontSize: "1rem" }}
                    />
                </Tabs>
            )}

            {/* Audit Filter Chips */}
            {tab === "ALL_INVOICES" && (
                <Box sx={{ mb: 2.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Chip
                        label={`${t("all_members_chip", "All Members")} (${approvedInvoices.length})`}
                        onClick={() => setAuditFilter("ALL")}
                        color={auditFilter === "ALL" ? "primary" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                    <Chip
                        label={`${t("paid_verified_chip", "Paid & Verified")} (${approvedInvoices.filter((i) => i.status === "PAID").length})`}
                        onClick={() => setAuditFilter("PAID")}
                        color={auditFilter === "PAID" ? "success" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                    <Chip
                        label={`${t("unpaid_chip", "Unpaid")} (${approvedInvoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").length})`}
                        onClick={() => setAuditFilter("UNPAID")}
                        color={auditFilter === "UNPAID" ? "error" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                    <Chip
                        label={`${t("awaiting_verification_chip", "Awaiting Verification")} (${approvedInvoices.filter((i) => i.status === "AWAITING_VERIFICATION").length})`}
                        onClick={() => setAuditFilter("AWAITING")}
                        color={auditFilter === "AWAITING" ? "warning" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                </Box>
            )}

            {/* History Filters */}
            {tab === "HISTORY" && (
                <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: "background.paper" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t("filter_by_member", "Filter by Member")}
                            value={historyMemberFilter}
                            onChange={(e) => setHistoryMemberFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">{t("all_club_members", "All Club Members")}</MenuItem>
                            {uniqueMembers.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                    {m.name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={t("billing_cycle_duration", "Billing Cycle Duration")}
                            value={historyCycleFilter}
                            onChange={(e) => setHistoryCycleFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">{t("all_durations", "All Durations (Yearly & Monthly)")}</MenuItem>
                            <MenuItem value="YEARLY">{t("yearly_invoices", "Yearly / Annual Invoices")}</MenuItem>
                            <MenuItem value="MONTHLY">{t("monthly_invoices", "Monthly Invoices")}</MenuItem>
                            <MenuItem value="QUARTERLY">{t("quarterly_invoices", "Quarterly Invoices")}</MenuItem>
                        </TextField>
                    </Stack>
                </Paper>
            )}

            {/* DUES BATCHES (AUDIT) CARDS */}
            {tab === "BATCH_AUDIT" && (
                <Stack spacing={2.5}>
                    {batches.length === 0 ? (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                            <Typography color="text.secondary" variant="h6">
                                {t("no_dues_batches_recorded", "No dues batches recorded yet.")}
                            </Typography>
                        </Paper>
                    ) : (
                        batches.map((b) => {
                            const isApproved = b.is_approved;
                            const dueDateFormatted = new Date(b.due_date).toLocaleDateString();

                            return (
                                <Card
                                    key={b.title}
                                    elevation={2}
                                    sx={{
                                        borderRadius: 3.5,
                                        borderLeft: "6px solid #2E7D32",
                                        bgcolor: "background.paper",
                                    }}
                                >
                                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                                        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary", fontSize: "1.2rem" }}>
                                                {b.title}
                                            </Typography>
                                            <Chip
                                                label={b.billing_cycle}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontWeight: 700, fontSize: "0.75rem", borderRadius: 1.5 }}
                                            />
                                            <Chip
                                                label={isApproved ? t("approved_and_active", "APPROVED & ACTIVE") : t("pending_president_approval", "PENDING PRESIDENT APPROVAL")}
                                                size="small"
                                                sx={{
                                                    fontWeight: 800,
                                                    fontSize: "0.75rem",
                                                    borderRadius: 1.5,
                                                    bgcolor: isApproved ? "#2E7D32" : "#E65100",
                                                    color: "white",
                                                }}
                                            />
                                        </Box>

                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={{ xs: 1, sm: 3 }}
                                            sx={{ color: "text.secondary", mb: 2.5 }}
                                        >
                                            <Typography variant="body2">
                                                {t("amount_per_member", "Amount: €{amount} / Member").replace("{amount}", b.amount.toFixed(2))}
                                            </Typography>
                                            <Typography variant="body2">
                                                {t("due_date_label", "Due Date")}: <b>{dueDateFormatted}</b>
                                            </Typography>
                                            <Typography variant="body2">
                                                {t("issued_to_members", "Issued to: {count} Members").replace("{count}", String(b.total_invoices))}
                                            </Typography>
                                        </Stack>

                                        <Box sx={{ maxWidth: "100%" }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                    {t("collection_progress", "Collection Progress: {paid} / {total} Members Paid")
                                                        .replace("{paid}", String(b.paid_count))
                                                        .replace("{total}", String(b.total_invoices))}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: "#2E7D32" }}>
                                                    €{b.total_collected.toFixed(2)} / €{b.total_expected.toFixed(2)}
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={b.total_expected > 0 ? (b.total_collected / b.total_expected) * 100 : 0}
                                                sx={{
                                                    height: 8,
                                                    borderRadius: 4,
                                                    bgcolor: "#D1E7DD",
                                                    "& .MuiLinearProgress-bar": { bgcolor: "#2E7D32", borderRadius: 4 },
                                                }}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </Stack>
            )}

            {/* INVOICES LIST */}
            {tab !== "BATCH_AUDIT" && (
                <>
                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                            <CircularProgress size={50} />
                        </Box>
                    ) : displayedInvoices.length === 0 ? (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                            <Typography color="text.secondary" variant="h6">
                                {tab === "ALL_INVOICES" && unapprovedBatches.length > 0
                                    ? t("batches_awaiting_desc", "Proposed batches are awaiting President approval. Once approved, active member invoices will appear here.")
                                    : tab === "HISTORY"
                                        ? t("no_history_records", "No historical paid records match the selected filters.")
                                        : t("no_invoices_found", "No dues invoices found.")}
                            </Typography>
                        </Paper>
                    ) : (
                        <Stack spacing={2.5}>
                            {displayedInvoices.map((inv) => {
                                const isPaid = inv.status === "PAID";
                                const isAwaiting = inv.status === "AWAITING_VERIFICATION";
                                const isOwnInvoice = inv.user_id === user?.user_id;
                                const dueDateFormatted = new Date(inv.due_date).toLocaleDateString();

                                return (
                                    <Card
                                        key={inv.id}
                                        elevation={3}
                                        sx={{
                                            borderRadius: 3.5,
                                            borderLeft: "6px solid",
                                            borderLeftColor: !inv.is_approved
                                                ? "secondary.main"
                                                : isPaid
                                                    ? "success.main"
                                                    : isAwaiting
                                                        ? "warning.main"
                                                        : "error.main",
                                        }}
                                    >
                                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: { xs: "column", md: "row" },
                                                    justifyContent: "space-between",
                                                    alignItems: { xs: "flex-start", md: "center" },
                                                    gap: 2,
                                                }}
                                            >
                                                {/* Meta */}
                                                <Box sx={{ flex: 1 }}>
                                                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                        <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                            {inv.title}
                                                        </Typography>
                                                        <Chip
                                                            label={inv.billing_cycle}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ fontWeight: 700, fontSize: "0.75rem" }}
                                                        />

                                                        {!inv.is_approved ? (
                                                            <Chip
                                                                label={t("awaiting_president_approval", "Awaiting President Approval")}
                                                                color="secondary"
                                                                size="small"
                                                                sx={{ fontWeight: 800 }}
                                                            />
                                                        ) : (
                                                            <Chip
                                                                label={isPaid ? t("paid_verified_chip", "PAID & VERIFIED") : isAwaiting ? t("awaiting_confirmation", "AWAITING CONFIRMATION") : t("unpaid_chip", "UNPAID")}
                                                                color={isPaid ? "success" : isAwaiting ? "warning" : "error"}
                                                                size="small"
                                                                sx={{ fontWeight: 800 }}
                                                            />
                                                        )}
                                                    </Box>

                                                    {tab !== "MY_INVOICES" && (
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
                                                            {t("member_label", "Member")}: {inv.member_name} ({inv.member_role})
                                                        </Typography>
                                                    )}

                                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 3 }} sx={{ mt: 1, color: "text.secondary" }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <ScheduleIcon fontSize="small" />
                                                            <Typography variant="body2">
                                                                {isPaid && inv.paid_at ? (
                                                                    <>{t("paid_on_label", "Paid on")}: <b>{new Date(inv.paid_at).toLocaleDateString()}</b></>
                                                                ) : (
                                                                    <>{t("due_date_label", "Due Date")}: <b>{dueDateFormatted}</b></>
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <ReceiptIcon fontSize="small" />
                                                            <Typography variant="body2">
                                                                {t("reference_number_label", "Reference Number")}: <b>{inv.reference_number}</b>
                                                            </Typography>
                                                        </Box>
                                                    </Stack>

                                                    {isPaid && (
                                                        <Typography variant="caption" sx={{ color: "success.dark", fontWeight: 700, mt: 0.5, display: "block" }}>
                                                            ✓ {t("payment_method_label", "Method")}: {inv.payment_method} {inv.verifier_name && `• ${t("verified_by_label", "Verified by")}: ${inv.verifier_name}`}
                                                        </Typography>
                                                    )}

                                                    {isAwaiting && (
                                                        <Typography variant="caption" sx={{ color: "#E65100", fontWeight: 800, mt: 0.5, display: "block" }}>
                                                            {t("reported_via_on", "Reported via {method} on {date}")
                                                                .replace("{method}", inv.reported_method || "")
                                                                .replace("{date}", new Date(inv.reported_at || "").toLocaleDateString())}
                                                        </Typography>
                                                    )}
                                                </Box>

                                                {/* Amount & Actions */}
                                                <Stack
                                                    direction="row"
                                                    spacing={2}
                                                    sx={{ alignItems: "center", justifyContent: "space-between", width: { xs: "100%", md: "auto" } }}
                                                >
                                                    <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                                            {t("amount_label", "Amount")}
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 900, color: isPaid ? "success.main" : "text.primary" }}>
                                                            €{inv.amount.toFixed(2)}
                                                        </Typography>
                                                    </Box>

                                                    {!isPaid && !isAwaiting && isOwnInvoice && (
                                                        <Button
                                                            variant="contained"
                                                            color="warning"
                                                            startIcon={<HourglassTopIcon />}
                                                            onClick={() => setReportingInvoice(inv)}
                                                            sx={{ fontWeight: 800, minHeight: 44, textTransform: "none" }}
                                                        >
                                                            {t("i_have_paid_btn", "I Have Paid")}
                                                        </Button>
                                                    )}

                                                    {isTreasurer && tab === "AWAITING" && !isPaid && (
                                                        <Button
                                                            variant="contained"
                                                            color="success"
                                                            startIcon={<CreditScoreIcon />}
                                                            onClick={() => setConfirmingInvoice(inv)}
                                                            sx={{ fontWeight: 800, minHeight: 44, textTransform: "none" }}
                                                        >
                                                            {t("confirm_received_btn", "Confirm Received")}
                                                        </Button>
                                                    )}

                                                    {!isPaid && (
                                                        <Tooltip title={t("copy_ref", "Copy Reference Number")}>
                                                            <IconButton
                                                                color="primary"
                                                                onClick={() => copyToClipboard(inv.reference_number, "Reference Number")}
                                                                sx={{ border: "1px solid", borderColor: "divider" }}
                                                            >
                                                                <ContentCopyIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Stack>
                    )}
                </>
            )}

            {/* Batch Generate Modal */}
            <Dialog
                open={openBatchModal}
                onClose={() => setOpenBatchModal(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>➕ {t("batch_generate_btn", "Generate Dues Batch")}</DialogTitle>
                <Box component="form" onSubmit={handleBatchGenerate}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label={t("invoice_title", "Invoice Title")}
                                value={batchTitle}
                                onChange={(e) => setBatchTitle(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                select
                                label={t("billing_frequency", "Billing Frequency")}
                                value={billingCycle}
                                onChange={(e) => {
                                    const cycle = e.target.value as "YEARLY" | "MONTHLY";
                                    setBillingCycle(cycle);
                                    if (cycle === "MONTHLY") {
                                        setBatchTitle(`Monthly Dues - ${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}`);
                                        setBatchAmount("10");
                                    } else {
                                        setBatchTitle("Annual Membership Fee 2026/2027");
                                        setBatchAmount("120");
                                    }
                                }}
                            >
                                <MenuItem value="YEARLY">{t("cycle_yearly", "Yearly / Annual (e.g. €120/year)")}</MenuItem>
                                <MenuItem value="MONTHLY">{t("cycle_monthly", "Monthly (e.g. €10/month)")}</MenuItem>
                            </TextField>

                            <TextField
                                fullWidth
                                required
                                type="number"
                                label={t("amount_label", "Amount")}
                                value={batchAmount}
                                onChange={(e) => setBatchAmount(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                required
                                type="date"
                                label={t("due_date_label", "Due Date")}
                                value={batchDueDate}
                                onChange={(e) => setBatchDueDate(e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />

                            <Alert severity="info" sx={{ fontWeight: 700 }}>
                                {t("batch_approval_note", "Note: Invoices generated by Treasurer will be submitted to the President for approval before being issued to members.")}
                            </Alert>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenBatchModal(false)}>{t("cancel_btn", "Cancel")}</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800, minHeight: 44, textTransform: "none" }}>
                            {t("submit_for_approval_btn", "Submit for President Approval")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Amend Batch Modal */}
            <Dialog
                open={openAmendModal}
                onClose={() => setOpenAmendModal(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>✏️ {t("amend_batch_title", "Amend Proposed Batch")}</DialogTitle>
                <Box component="form" onSubmit={handleSaveAmendBatch}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label={t("batch_title_label", "Batch Title")}
                                value={amendNewTitle}
                                onChange={(e) => setAmendNewTitle(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                required
                                type="number"
                                label={t("amount_per_member_label", "Amount per Member (€)")}
                                value={amendAmount}
                                onChange={(e) => setAmendAmount(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                required
                                type="date"
                                label={t("due_date_label", "Due Date")}
                                value={amendDueDate}
                                onChange={(e) => setAmendDueDate(e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenAmendModal(false)}>{t("cancel_btn", "Cancel")}</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800, textTransform: "none" }}>
                            {t("save_amendments_btn", "Save Amendments")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Edit Bank Details Modal */}
            <Dialog
                open={openBankModal}
                onClose={() => setOpenBankModal(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>✏️ {t("configure_bank_title", "Configure Official Bank & MobilePay")}</DialogTitle>
                <Box component="form" onSubmit={handleSaveBankDetails}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label={t("recipient_holder_label", "Recipient / Account Holder Name")}
                                value={editRecipient}
                                onChange={(e) => setEditRecipient(e.target.value)}
                                placeholder="e.g. Lions Club Helsinki Ry"
                            />

                            <TextField
                                fullWidth
                                required
                                label={t("iban_label", "IBAN Account Number")}
                                value={editIban}
                                onChange={(e) => setEditIban(e.target.value)}
                                placeholder="e.g. FI42 1234 5678 9012 34"
                            />

                            <TextField
                                fullWidth
                                required
                                label={t("bic_swift_label", "BIC / SWIFT Code")}
                                value={editBic}
                                onChange={(e) => setEditBic(e.target.value)}
                                placeholder="e.g. DABAFIHH"
                            />

                            <TextField
                                fullWidth
                                label={t("mobilepay_input_label", "MobilePay Number or Box ID")}
                                value={editMobilePay}
                                onChange={(e) => setEditMobilePay(e.target.value)}
                                placeholder="e.g. 12345 or +358 40 1234567"
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenBankModal(false)}>{t("cancel_btn", "Cancel")}</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800, minHeight: 44, textTransform: "none" }}>
                            {t("save_bank_details_btn", "Save Bank Details")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Member Report Payment Modal */}
            <Dialog
                open={Boolean(reportingInvoice)}
                onClose={() => setReportingInvoice(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>📢 {t("report_payment_title", "Report Payment Made")}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t("report_payment_desc", "Let the Club Treasurer know that you have transferred the funds so they can verify and issue your receipt.")}
                    </Typography>

                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            select
                            label={t("how_did_you_pay", "How did you pay?")}
                            value={reportMethod}
                            onChange={(e) => setReportMethod(e.target.value)}
                        >
                            <MenuItem value="MobilePay">MobilePay</MenuItem>
                            <MenuItem value="SEPA Bank Transfer">SEPA Bank Transfer</MenuItem>
                            <MenuItem value="Cash to Treasurer">Cash in hand</MenuItem>
                        </TextField>

                        <TextField
                            fullWidth
                            label={t("bank_ref_notes_optional", "Bank Reference / Notes (Optional)")}
                            value={reportReference}
                            onChange={(e) => setReportReference(e.target.value)}
                            placeholder="e.g. Paid via Nordea on Monday"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setReportingInvoice(null)}>{t("cancel_btn", "Cancel")}</Button>
                    <Button variant="contained" color="warning" onClick={handleReportPaymentSubmit} sx={{ fontWeight: 800, textTransform: "none" }}>
                        {t("submit_report_btn", "Submit Payment Report")}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Payment Modal (Treasurer only) */}
            <Dialog
                open={Boolean(confirmingInvoice)}
                onClose={() => setConfirmingInvoice(null)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, bgcolor: "success.main", color: "white" }}>
                    ✅ {t("confirm_receipt_title", "Confirm Bank Receipt")}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, mb: 1 }}>
                        {confirmingInvoice?.member_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {t("amount_label", "Amount")}: <b>€{confirmingInvoice?.amount.toFixed(2)}</b> | {t("reference_number_label", "Ref")}: <b>{confirmingInvoice?.reference_number}</b>
                    </Typography>

                    {confirmingInvoice?.reported_method && (
                        <Alert severity="info" sx={{ mb: 2, fontWeight: 700 }}>
                            {t("member_reported_method", "Member reported payment via:")} {confirmingInvoice.reported_method}
                        </Alert>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label={t("verification_note_optional", "Verification Note / Bank Statement ID (Optional)")}
                        value={confirmNotes}
                        onChange={(e) => setConfirmNotes(e.target.value)}
                        placeholder="Verified on Nordea bank statement on 13.10..."
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setConfirmingInvoice(null)}>{t("cancel_btn", "Cancel")}</Button>
                    <Button variant="contained" color="success" onClick={handleConfirmPaymentSubmit} sx={{ fontWeight: 800, textTransform: "none" }}>
                        {t("confirm_and_issue_receipt", "Confirm & Issue Receipt")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};