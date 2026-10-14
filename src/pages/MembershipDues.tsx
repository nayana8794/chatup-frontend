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
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Window Focus Sync: පරිශීලකයා Treasury tab එකට ආ සැණින් දත්ත ස්වයංක්‍රීයව sync වීම
    useEffect(() => {
        const handleFocus = () => {
            fetchData();
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [fetchData]);

    // Real-Time Live Sync with Audio Chime upon President Approval
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
            alert("Club bank details and MobilePay number updated successfully!");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error saving bank details.");
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
            alert("Dues batch submitted! Awaiting President or Vice President approval.");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error generating dues.");
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
            alert("Batch successfully amended!");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error amending batch.");
        }
    };

    const handleCancelBatch = async (title: string) => {
        if (!window.confirm(`Are you sure you want to cancel and delete the proposed batch "${title}"?`)) return;
        try {
            await apiClient.delete(`/financial/dues/batch?title=${encodeURIComponent(title)}`);
            fetchData();
            alert(`Batch "${title}" cancelled successfully.`);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error cancelling batch.");
        }
    };

    const handleApproveBatch = async (batchTitleToApprove: string) => {
        try {
            await apiClient.post(`/financial/dues/batch/approve?title=${encodeURIComponent(batchTitleToApprove)}`);
            fetchData();
            alert(`Dues batch "${batchTitleToApprove}" approved and issued to all members!`);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error approving batch.");
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
            alert("Payment reported successfully! Awaiting Treasurer confirmation.");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error reporting payment.");
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
            alert("Payment verified and confirmed successfully!");
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error confirming payment.");
        }
    };

    // Batches awaiting President approval
    const unapprovedBatches = Array.from(
        new Set(invoices.filter((i) => !i.is_approved).map((i) => i.title))
    );

    // Short polling fallback while awaiting approval to guarantee instant sync
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
        // ALL_INVOICES (Audit Tab)
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
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            {/* Top Header Bar */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 3,
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
                    💶 {t("dues_title")}{" "}
                    {isPresident && !isTreasurer && (
                        <Chip label="Executive Oversight" color="primary" size="small" sx={{ ml: 1, fontWeight: 800 }} />
                    )}
                </Typography>

                {isTreasurer && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddCardIcon />}
                        onClick={() => setOpenBatchModal(true)}
                        sx={{ fontWeight: "bold", minHeight: 48 }}
                    >
                        {t("batch_generate_btn")}
                    </Button>
                )}
            </Stack>

            {copiedText && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 3, fontWeight: "bold" }}>
                    {copiedText} {t("copied")}
                </Alert>
            )}

            {/* ================= IMAGE 2: PRESIDENT ACTIONABLE APPROVAL BANNER ================= */}
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
                                ⚠️ Proposed Dues Batches Awaiting Your Approval:
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.primary", mt: 0.5 }}>
                                Treasurer proposed <b>{unapprovedBatches.join(", ")}</b>. Review and approve to issue invoices to members.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1.5}>
                            {unapprovedBatches.map((title) => (
                                <Button
                                    key={title}
                                    variant="contained"
                                    size="medium"
                                    startIcon={<CheckCircleIcon />}
                                    onClick={() => handleApproveBatch(title)}
                                    sx={{
                                        fontWeight: 800,
                                        bgcolor: "#002F6C",
                                        "&:hover": { bgcolor: "#001E47" },
                                        borderRadius: 2.5,
                                        px: 2.5,
                                        py: 1,
                                    }}
                                >
                                    Approve "{title}"
                                </Button>
                            ))}
                        </Stack>
                    </Box>
                </Alert>
            )}

            {/* ================= IMAGE 1: TREASURER TRACKING BANNER ================= */}
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
                                ⏳ Submitted Batches Awaiting President Approval:
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.primary", mt: 0.5 }}>
                                You have proposed <b>{unapprovedBatches.join(", ")}</b>. You can amend or cancel before President approves.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            {unapprovedBatches.map((title) => (
                                <React.Fragment key={title}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<EditIcon />}
                                        onClick={() => handleOpenAmendBatch(title)}
                                        sx={{ fontWeight: 800, borderRadius: 2 }}
                                    >
                                        Amend
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleCancelBatch(title)}
                                        sx={{ fontWeight: 800, borderRadius: 2 }}
                                    >
                                        Cancel Batch
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
                                {t("total_collected")}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "success.main" }}>
                                €{stats.total_collected.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {stats.paid_members_count} Members Verified & Paid
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #E65100" }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Awaiting Verification
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#E65100" }}>
                                {stats.awaiting_verification_count}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                €{stats.total_awaiting_verification.toFixed(2)} Reported by Members
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #002F6C" }}>
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {t("total_pending")}
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "primary.main" }}>
                                €{stats.total_pending.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {stats.pending_members_count} Invoices Unpaid
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
                                {t("bank_transfer_box_title")}
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
                                Edit Bank & MobilePay
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
                                bgcolor: "grey.100",
                                borderRadius: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {t("recipient_name")}
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 800 }}>
                                    {stats.recipient_name}
                                </Typography>
                            </Box>
                            <Chip label="SEPA Core & MobilePay" color="primary" size="small" sx={{ fontWeight: 700 }} />
                        </Box>

                        {/* IBAN & BIC */}
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: { xs: "column", sm: "row" },
                                justifyContent: "space-between",
                                alignItems: { xs: "flex-start", sm: "center" },
                                p: 1.5,
                                bgcolor: "grey.100",
                                borderRadius: 2,
                            }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    {t("iban_label")} (BIC: <b>{stats.club_bic}</b>)
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 800, letterSpacing: 1 }}>
                                    {stats.club_iban}
                                </Typography>
                            </Box>
                            <Tooltip title={t("copy_iban")}>
                                <Button
                                    size="small"
                                    startIcon={<ContentCopyIcon />}
                                    onClick={() => copyToClipboard(stats.club_iban, "IBAN")}
                                    sx={{ fontWeight: 800 }}
                                >
                                    {t("copy_iban")}
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
                                    bgcolor: "grey.100",
                                    borderRadius: 2,
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <PhoneAndroidIcon color="primary" />
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                            MobilePay Number / Box ID
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 800, color: "primary.main" }}>
                                            {stats.mobilepay_number}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Tooltip title="Copy MobilePay Number">
                                    <Button
                                        size="small"
                                        startIcon={<ContentCopyIcon />}
                                        onClick={() => copyToClipboard(stats.mobilepay_number || "", "MobilePay Number")}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        Copy MobilePay
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
                    <Tab label={t("my_dues_tab")} value="MY_INVOICES" sx={{ fontWeight: 800, fontSize: "1rem" }} />

                    {isTreasurer && (
                        <Tab
                            label={`Verification Queue (${stats?.awaiting_verification_count || 0})`}
                            value="AWAITING"
                            sx={{ fontWeight: 800, fontSize: "1rem", color: "#E65100" }}
                        />
                    )}

                    <Tab
                        label={isPresident && !isTreasurer ? "Member Paid Status (Audit)" : t("all_members_dues_tab")}
                        value="ALL_INVOICES"
                        sx={{ fontWeight: 800, fontSize: "1rem" }}
                    />

                    {/* Dues Batches (Audit) Tab: Exact match for Image 1 */}
                    <Tab
                        icon={<FactCheckIcon />}
                        iconPosition="start"
                        label="Dues Batches (Audit)"
                        value="BATCH_AUDIT"
                        sx={{ fontWeight: 800, fontSize: "1rem", color: "primary.main" }}
                    />

                    <Tab
                        icon={<HistoryIcon />}
                        iconPosition="start"
                        label="Payment History"
                        value="HISTORY"
                        sx={{ fontWeight: 800, fontSize: "1rem" }}
                    />
                </Tabs>
            )}

            {/* Audit Filter Chips */}
            {tab === "ALL_INVOICES" && (
                <Box sx={{ mb: 2.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Chip
                        label={`All Members (${approvedInvoices.length})`}
                        onClick={() => setAuditFilter("ALL")}
                        color={auditFilter === "ALL" ? "primary" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                    <Chip
                        label={`Paid & Verified (${approvedInvoices.filter((i) => i.status === "PAID").length})`}
                        onClick={() => setAuditFilter("PAID")}
                        color={auditFilter === "PAID" ? "success" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                    <Chip
                        label={`Unpaid (${approvedInvoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").length})`}
                        onClick={() => setAuditFilter("UNPAID")}
                        color={auditFilter === "UNPAID" ? "error" : "default"}
                        sx={{ fontWeight: 800 }}
                    />
                    <Chip
                        label={`Awaiting Verification (${approvedInvoices.filter((i) => i.status === "AWAITING_VERIFICATION").length})`}
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
                            label="Filter by Member"
                            value={historyMemberFilter}
                            onChange={(e) => setHistoryMemberFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Club Members</MenuItem>
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
                            label="Billing Cycle Duration"
                            value={historyCycleFilter}
                            onChange={(e) => setHistoryCycleFilter(e.target.value)}
                        >
                            <MenuItem value="ALL">All Durations (Yearly & Monthly)</MenuItem>
                            <MenuItem value="YEARLY">Yearly / Annual Invoices</MenuItem>
                            <MenuItem value="MONTHLY">Monthly Invoices</MenuItem>
                            <MenuItem value="QUARTERLY">Quarterly Invoices</MenuItem>
                        </TextField>
                    </Stack>
                </Paper>
            )}

            {/* ================= EXACT MATCH FOR IMAGE 01: DUES BATCHES (AUDIT) CARDS ================= */}
            {tab === "BATCH_AUDIT" && (
                <Stack spacing={2.5}>
                    {batches.length === 0 ? (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                            <Typography color="text.secondary" variant="h6">
                                No dues batches recorded yet.
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
                                        borderLeft: "6px solid #2E7D32", // Green accent border like Image 1
                                        bgcolor: "background.paper",
                                    }}
                                >
                                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                                        {/* Header Line: Title + Chips */}
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
                                                label={isApproved ? "APPROVED & ACTIVE" : "PENDING PRESIDENT APPROVAL"}
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

                                        {/* Metadata Line */}
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={{ xs: 1, sm: 3 }}
                                            sx={{ color: "text.secondary", mb: 2.5 }}
                                        >
                                            <Typography variant="body2">
                                                Amount: <b>€{b.amount.toFixed(2)} / Member</b>
                                            </Typography>
                                            <Typography variant="body2">
                                                Due Date: <b>{dueDateFormatted}</b>
                                            </Typography>
                                            <Typography variant="body2">
                                                Issued to: <b>{b.total_invoices} Members</b>
                                            </Typography>
                                        </Stack>

                                        {/* Collection Progress Bar & Totals Line (Exact match for Image 1) */}
                                        <Box sx={{ maxWidth: "100%" }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                    Collection Progress: {b.paid_count} / {b.total_invoices} Members Paid
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

            {/* ================= INVOICES LIST (FOR ALL OTHER TABS) ================= */}
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
                                    ? "Proposed batches are awaiting President approval. Once approved, active member invoices will appear here."
                                    : tab === "HISTORY"
                                        ? "No historical paid records match the selected filters."
                                        : t("no_invoices_found")}
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
                                                                label="Awaiting President Approval"
                                                                color="secondary"
                                                                size="small"
                                                                sx={{ fontWeight: 800 }}
                                                            />
                                                        ) : (
                                                            <Chip
                                                                label={isPaid ? "PAID & VERIFIED" : isAwaiting ? "AWAITING CONFIRMATION" : "UNPAID"}
                                                                color={isPaid ? "success" : isAwaiting ? "warning" : "error"}
                                                                size="small"
                                                                sx={{ fontWeight: 800 }}
                                                            />
                                                        )}
                                                    </Box>

                                                    {tab !== "MY_INVOICES" && (
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
                                                            Member: {inv.member_name} ({inv.member_role})
                                                        </Typography>
                                                    )}

                                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 3 }} sx={{ mt: 1, color: "text.secondary" }}>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <ScheduleIcon fontSize="small" />
                                                            <Typography variant="body2">
                                                                {isPaid && inv.paid_at ? (
                                                                    <>Paid on: <b>{new Date(inv.paid_at).toLocaleDateString()}</b></>
                                                                ) : (
                                                                    <>{t("due_date_label")}: <b>{dueDateFormatted}</b></>
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                            <ReceiptIcon fontSize="small" />
                                                            <Typography variant="body2">
                                                                {t("reference_number_label")}: <b>{inv.reference_number}</b>
                                                            </Typography>
                                                        </Box>
                                                    </Stack>

                                                    {isPaid && (
                                                        <Typography variant="caption" sx={{ color: "success.dark", fontWeight: 700, mt: 0.5, display: "block" }}>
                                                            ✓ Method: {inv.payment_method} {inv.verifier_name && `• Verified by: ${inv.verifier_name}`}
                                                        </Typography>
                                                    )}

                                                    {isAwaiting && (
                                                        <Typography variant="caption" sx={{ color: "#E65100", fontWeight: 800, mt: 0.5, display: "block" }}>
                                                            Reported via {inv.reported_method} on {new Date(inv.reported_at || "").toLocaleDateString()}
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
                                                            {t("amount_label")}
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 900, color: isPaid ? "success.main" : "text.primary" }}>
                                                            €{inv.amount.toFixed(2)}
                                                        </Typography>
                                                    </Box>

                                                    {/* Member Action: "I Have Paid" */}
                                                    {!isPaid && !isAwaiting && isOwnInvoice && (
                                                        <Button
                                                            variant="contained"
                                                            color="warning"
                                                            startIcon={<HourglassTopIcon />}
                                                            onClick={() => setReportingInvoice(inv)}
                                                            sx={{ fontWeight: 800, minHeight: 44 }}
                                                        >
                                                            I Have Paid
                                                        </Button>
                                                    )}

                                                    {/* Operational Button: Confirm Received ONLY for Treasurer in the Verification Queue */}
                                                    {isTreasurer && tab === "AWAITING" && !isPaid && (
                                                        <Button
                                                            variant="contained"
                                                            color="success"
                                                            startIcon={<CreditScoreIcon />}
                                                            onClick={() => setConfirmingInvoice(inv)}
                                                            sx={{ fontWeight: 800, minHeight: 44 }}
                                                        >
                                                            Confirm Received
                                                        </Button>
                                                    )}

                                                    {!isPaid && (
                                                        <Tooltip title={t("copy_ref")}>
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
                <DialogTitle sx={{ fontWeight: 800 }}>➕ {t("batch_generate_btn")}</DialogTitle>
                <Box component="form" onSubmit={handleBatchGenerate}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label="Invoice Title"
                                value={batchTitle}
                                onChange={(e) => setBatchTitle(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                select
                                label="Billing Frequency"
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
                                <MenuItem value="YEARLY">Yearly / Annual (e.g. €120/year)</MenuItem>
                                <MenuItem value="MONTHLY">Monthly (e.g. €10/month)</MenuItem>
                            </TextField>

                            <TextField
                                fullWidth
                                required
                                type="number"
                                label={t("amount_label")}
                                value={batchAmount}
                                onChange={(e) => setBatchAmount(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                required
                                type="date"
                                label={t("due_date_label")}
                                value={batchDueDate}
                                onChange={(e) => setBatchDueDate(e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />

                            <Alert severity="info" sx={{ fontWeight: 700 }}>
                                Note: Invoices generated by Treasurer will be submitted to the President for approval before being issued to members.
                            </Alert>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenBatchModal(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800, minHeight: 44 }}>
                            Submit for President Approval
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
                <DialogTitle sx={{ fontWeight: 800 }}>✏️ Amend Proposed Batch</DialogTitle>
                <Box component="form" onSubmit={handleSaveAmendBatch}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label="Batch Title"
                                value={amendNewTitle}
                                onChange={(e) => setAmendNewTitle(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                required
                                type="number"
                                label="Amount per Member (€)"
                                value={amendAmount}
                                onChange={(e) => setAmendAmount(e.target.value)}
                            />

                            <TextField
                                fullWidth
                                required
                                type="date"
                                label="Due Date"
                                value={amendDueDate}
                                onChange={(e) => setAmendDueDate(e.target.value)}
                                slotProps={{ inputLabel: { shrink: true } }}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenAmendModal(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800 }}>
                            Save Amendments
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
                <DialogTitle sx={{ fontWeight: 800 }}>✏️ Configure Official Bank & MobilePay</DialogTitle>
                <Box component="form" onSubmit={handleSaveBankDetails}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label="Recipient / Account Holder Name"
                                value={editRecipient}
                                onChange={(e) => setEditRecipient(e.target.value)}
                                placeholder="e.g. Lions Club Helsinki Ry"
                            />

                            <TextField
                                fullWidth
                                required
                                label="IBAN Account Number"
                                value={editIban}
                                onChange={(e) => setEditIban(e.target.value)}
                                placeholder="e.g. FI42 1234 5678 9012 34"
                            />

                            <TextField
                                fullWidth
                                required
                                label="BIC / SWIFT Code"
                                value={editBic}
                                onChange={(e) => setEditBic(e.target.value)}
                                placeholder="e.g. DABAFIHH"
                            />

                            <TextField
                                fullWidth
                                label="MobilePay Number or Box ID"
                                value={editMobilePay}
                                onChange={(e) => setEditMobilePay(e.target.value)}
                                placeholder="e.g. 12345 or +358 40 1234567"
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenBankModal(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800, minHeight: 44 }}>
                            Save Bank Details
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
                <DialogTitle sx={{ fontWeight: 800 }}>📢 Report Payment Made</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Let the Club Treasurer know that you have transferred the funds so they can verify and issue your receipt.
                    </Typography>

                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            select
                            label="How did you pay?"
                            value={reportMethod}
                            onChange={(e) => setReportMethod(e.target.value)}
                        >
                            <MenuItem value="MobilePay">MobilePay</MenuItem>
                            <MenuItem value="SEPA Bank Transfer">SEPA Bank Transfer</MenuItem>
                            <MenuItem value="Cash to Treasurer">Cash in hand</MenuItem>
                        </TextField>

                        <TextField
                            fullWidth
                            label="Bank Reference / Notes (Optional)"
                            value={reportReference}
                            onChange={(e) => setReportReference(e.target.value)}
                            placeholder="e.g. Paid via Nordea on Monday"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setReportingInvoice(null)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={handleReportPaymentSubmit} sx={{ fontWeight: 800 }}>
                        Submit Payment Report
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
                    ✅ Confirm Bank Receipt
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, mb: 1 }}>
                        {confirmingInvoice?.member_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Amount: <b>€{confirmingInvoice?.amount.toFixed(2)}</b> | Ref: <b>{confirmingInvoice?.reference_number}</b>
                    </Typography>

                    {confirmingInvoice?.reported_method && (
                        <Alert severity="info" sx={{ mb: 2, fontWeight: 700 }}>
                            Member reported payment via: {confirmingInvoice.reported_method}
                        </Alert>
                    )}

                    <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Verification Note / Bank Statement ID (Optional)"
                        value={confirmNotes}
                        onChange={(e) => setConfirmNotes(e.target.value)}
                        placeholder="Verified on Nordea bank statement on 13.10..."
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setConfirmingInvoice(null)}>Cancel</Button>
                    <Button variant="contained" color="success" onClick={handleConfirmPaymentSubmit} sx={{ fontWeight: 800 }}>
                        Confirm & Issue Receipt
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};