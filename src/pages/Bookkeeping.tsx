// chatup/frontend/src/pages/Bookkeeping.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    CardActionArea,
    Stack,
    Chip,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Alert,
    CircularProgress,
    InputAdornment,
    IconButton,
    Tooltip,
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tabs,
    Tab,
    Badge,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AddIcon from "@mui/icons-material/Add";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PercentIcon from "@mui/icons-material/Percent";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import VerifiedIcon from "@mui/icons-material/Verified";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TableChartIcon from "@mui/icons-material/TableChart";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FunctionsIcon from "@mui/icons-material/Functions";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { playNotificationChime } from "../utils/sound";
import apiClient from "../api/client";

interface BookkeepingSummary {
    total_dues_income: number;
    total_other_income: number;
    total_expenses: number;
    net_treasury_balance: number;
    dues_collection_rate: number;
    total_transactions_count: number;
    category_breakdown: Array<{ category: string; amount: number; count: number }>;
}

interface TransactionItem {
    id: string;
    transaction_type: "INCOME" | "EXPENSE";
    category: string;
    description: string;
    amount: number;
    currency: string;
    reference_number?: string;
    transaction_date: string;
    recorder_name: string;
}

interface GridRow {
    category: string;
    description: string;
    type: "INCOME" | "EXPENSE";
    amount: number | string;
}

interface FinancialSheet {
    id: string;
    title: string;
    fiscal_year: string;
    sheet_type: "BUDGET" | "ANNUAL_ACCOUNTS" | "PROJECT_LEDGER" | "GENERAL_SPREADSHEET";
    status: "DRAFT" | "SUBMITTED" | "PUBLISHED" | "VOIDED";
    grid_data: { rows: GridRow[] };
    total_income: number;
    total_expense: number;
    net_balance: number;
    is_deleted: boolean;
    deletion_reason?: string;
    creator_name: string;
    approver_name?: string;
    created_at: string;
}

const EXPENSE_CATEGORIES = [
    "Club Administration & Office",
    "Meeting Dinners & Catering",
    "Lions / Rotary District Dues",
    "Charity Project Expenditure",
    "Youth & Sports Sponsorship",
    "International Youth Camp",
    "Awards & Member Trophies",
    "Banking & Service Fees",
];

const INCOME_CATEGORIES = [
    "Charity Event Ticket Sales",
    "Flea Market & Fundraising",
    "Corporate & Private Donations",
    "Government / Municipal Grants",
    "Merchandise & Pin Sales",
    "Other Miscellaneous Inflow",
];

export const Bookkeeping: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const isTreasurer = ["SUPER_ADMIN", "TREASURER", "VICE_TREASURER"].includes(user?.role || "");
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");
    const canManageLedger = isTreasurer || isPresident;

    // Main Tabs (0: General Ledger, 1: Excel Studio Sheets, 2: Fiscal Analytics)
    const [suiteTab, setSuiteTab] = useState(0);

    // Sub-view for Financial Sheets (matching MOM architecture: "list" | "editor" | "reader")
    const [sheetSubView, setSheetSubView] = useState<"list" | "editor" | "reader">("list");

    // Ledger Data
    const [summary, setSummary] = useState<BookkeepingSummary | null>(null);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Financial Sheets Data
    const [sheets, setSheets] = useState<FinancialSheet[]>([]);
    const [activeSheet, setActiveSheet] = useState<FinancialSheet | null>(null);
    const [editRows, setEditRows] = useState<GridRow[]>([]);
    const [savingGrid, setSavingGrid] = useState(false);

    // Modals
    const [openTxModal, setOpenTxModal] = useState(false);
    const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [reference, setReference] = useState("");
    const [txError, setTxError] = useState("");

    const [openSheetCreate, setOpenSheetCreate] = useState(false);
    const [sheetTitle, setSheetTitle] = useState("");
    const [sheetYear, setSheetYear] = useState("2026/2027");
    const [sheetType, setSheetType] = useState<"BUDGET" | "ANNUAL_ACCOUNTS">("BUDGET");

    const [openVoidModal, setOpenVoidModal] = useState(false);
    const [voidReason, setVoidReason] = useState("");
    const [voiding, setVoiding] = useState(false);

    const [exportingExcel, setExportingExcel] = useState(false);
    const isFetchingRef = useRef(false);

    const fetchAllFinancialData = useCallback(async (isInitial = false) => {
        if (isFetchingRef.current && !isInitial) return;
        isFetchingRef.current = true;

        try {
            if (isInitial) setLoading(true);
            const [sumRes, txRes, sheetRes] = await Promise.all([
                apiClient.get<BookkeepingSummary>("/bookkeeping/summary"),
                apiClient.get<TransactionItem[]>("/bookkeeping/transactions", {
                    params: {
                        tx_type: typeFilter !== "ALL" ? typeFilter : undefined,
                        search: searchQuery || undefined,
                    },
                }),
                apiClient.get<FinancialSheet[]>("/financial-sheets").catch(() => ({ data: [] })),
            ]);
            setSummary(sumRes.data);
            setTransactions(txRes.data);
            setSheets(sheetRes.data);

            setActiveSheet((prevActive) => {
                if (prevActive) {
                    const refreshed = sheetRes.data.find((s) => s.id === prevActive.id);
                    if (refreshed) {
                        return refreshed;
                    }
                }
                return sheetRes.data.length > 0 ? sheetRes.data[0] : null;
            });
        } catch (err) {
            console.error("Failed to load financial records:", err);
        } finally {
            if (isInitial) setLoading(false);
            isFetchingRef.current = false;
        }
    }, [typeFilter, searchQuery]);

    useEffect(() => {
        void fetchAllFinancialData(true);
    }, [fetchAllFinancialData]);

    useEffect(() => {
        if (activeSheet) {
            setEditRows(activeSheet.grid_data?.rows || []);
        }
    }, [activeSheet]);

    // Live WebSockets Synchronization
    useEffect(() => {
        if (!lastEvent) return;
        const ev = String(lastEvent.type);
        if (
            ev === "FINANCIAL_SHEET_SUBMITTED" ||
            ev === "FINANCIAL_SHEET_APPROVED" ||
            ev === "FINANCIAL_SHEET_VOIDED" ||
            ev === "DUES_PAID"
        ) {
            playNotificationChime();
            void fetchAllFinancialData(false);
        }
    }, [lastEvent, fetchAllFinancialData]);

    const handleCreateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        setTxError("");
        try {
            await apiClient.post("/bookkeeping/transactions", {
                transaction_type: txType,
                category: category.trim(),
                description: description.trim(),
                amount: parseFloat(amount),
                reference_number: reference.trim() || undefined,
            });
            setOpenTxModal(false);
            setDescription("");
            setAmount("");
            setReference("");
            void fetchAllFinancialData(false);
        } catch (err: any) {
            setTxError(err.response?.data?.detail || "Failed to record transaction entry");
        }
    };

    const handleDeleteTransaction = async (txId: string) => {
        if (!window.confirm(t("confirm_delete_tx", "Void and delete this ledger transaction?"))) return;
        try {
            await apiClient.delete(`/bookkeeping/transactions/${txId}`);
            void fetchAllFinancialData(false);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete transaction");
        }
    };

    const handleExportAuditExcel = async () => {
        setExportingExcel(true);
        try {
            const response = await apiClient.get("/bookkeeping/export/excel", {
                responseType: "blob",
            });
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Financial_Audit_Package_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            alert(t("excel_export_failed", "Failed to export Excel audit workbook"));
        } finally {
            setExportingExcel(false);
        }
    };

    // MOM-Style Handlers: Open Editor or Open Reader
    const handleOpenSheetCard = (sheet: FinancialSheet) => {
        setActiveSheet(sheet);
        setEditRows(sheet.grid_data?.rows || []);
        if (sheet.status === "PUBLISHED" || sheet.status === "VOIDED" || !canManageLedger) {
            setSheetSubView("reader");
        } else {
            setSheetSubView("editor");
        }
    };

    const handleAddGridRow = () => {
        setEditRows([
            ...editRows,
            { category: t("general_category", "General"), description: "", type: "EXPENSE", amount: "" },
        ]);
    };

    const handleRemoveGridRow = (idx: number) => {
        setEditRows(editRows.filter((_, i) => i !== idx));
    };

    const handleSaveSheetGrid = async () => {
        if (!activeSheet) return;
        setSavingGrid(true);
        try {
            const cleanRows = editRows.map((r) => ({
                ...r,
                amount: parseFloat(String(r.amount)) || 0.0,
            }));
            const res = await apiClient.put(`/financial-sheets/${activeSheet.id}`, {
                grid_data: { rows: cleanRows },
            });
            setActiveSheet(res.data);
            void fetchAllFinancialData(false);
            alert(t("sheet_saved_success", "Spreadsheet updated successfully!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_save_failed", "Failed to save spreadsheet"));
        } finally {
            setSavingGrid(false);
        }
    };

    const handleSubmitSheetForApproval = async () => {
        if (!activeSheet) return;
        if (!window.confirm(t("confirm_submit_approval", "Submit this financial sheet to President for official approval?"))) return;
        try {
            await apiClient.post(`/financial-sheets/${activeSheet.id}/submit`);
            void fetchAllFinancialData(false);
            setSheetSubView("list");
            alert(t("sheet_submitted_msg", "Sheet submitted for President approval!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_submit_failed", "Failed to submit sheet"));
        }
    };

    const handleApproveSheet = async () => {
        if (!activeSheet) return;
        try {
            await apiClient.post(`/financial-sheets/${activeSheet.id}/approve`);
            void fetchAllFinancialData(false);
            setSheetSubView("reader");
            alert(t("sheet_approved_msg", "Financial sheet approved and published! Tamper-proof audit active."));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_approve_failed", "Failed to approve sheet"));
        }
    };

    const handleVoidSheetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSheet) return;
        setVoiding(true);
        try {
            await apiClient.post(`/financial-sheets/${activeSheet.id}/void`, {
                deletion_reason: voidReason,
            });
            setOpenVoidModal(false);
            setVoidReason("");
            void fetchAllFinancialData(false);
            setSheetSubView("list");
            alert(t("sheet_voided_msg", "Record voided. Audited entry preserved for statutory inspectors."));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_void_failed", "Failed to void sheet"));
        } finally {
            setVoiding(false);
        }
    };

    const handleExportSingleSheet = async (sheetId: string, title: string) => {
        try {
            const response = await apiClient.get(`/financial-sheets/${sheetId}/export-excel`, {
                responseType: "blob",
            });
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${title.replace(" ", "_")}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            alert(t("excel_export_failed", "Failed to export Excel file"));
        }
    };

    const handleCreateSheetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const initialRows: GridRow[] = [
                { category: t("menu_dues", "Membership Dues"), description: "Annual member dues collection", type: "INCOME", amount: summary?.total_dues_income || 0 },
                { category: "Administration", description: "Auditing & bank fees", type: "EXPENSE", amount: 450 },
            ];
            const res = await apiClient.post("/financial-sheets", {
                title: sheetTitle.trim(),
                fiscal_year: sheetYear.trim(),
                sheet_type: sheetType,
                grid_data: { rows: initialRows },
            });
            setOpenSheetCreate(false);
            setSheetTitle("");
            void fetchAllFinancialData(false);
            setActiveSheet(res.data);
            setEditRows(initialRows);
            setSuiteTab(1);
            setSheetSubView("editor"); // Opens into dedicated Editor page immediately
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_create_failed", "Failed to create spreadsheet"));
        }
    };

    const liveIncome = editRows.filter((r) => r.type === "INCOME").reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
    const liveExpense = editRows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
    const liveNet = liveIncome - liveExpense;

    const isSheetLocked = activeSheet?.status === "PUBLISHED" || activeSheet?.status === "VOIDED" || (activeSheet?.status === "SUBMITTED" && isTreasurer && !isPresident);
    const pendingSheetsCount = sheets.filter((s) => s.status === "SUBMITTED").length;

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 }, px: { xs: 2, sm: 3 } }}>
            {/* Top Header Bar: 100% Mathematically Centered */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 3,
                }}
            >
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
                        {t("back_to_dashboard")}
                    </Button>
                </Box>

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
                    📊 {t("bookkeeping_title")}
                </Typography>

                <Box
                    sx={{
                        minWidth: { sm: 200 },
                        display: "flex",
                        justifyContent: { xs: "center", sm: "flex-end" },
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    {isPresident && !isTreasurer && (
                        <Chip
                            icon={<VerifiedIcon sx={{ fontSize: 16, color: "white !important" }} />}
                            label={t("executive_oversight")}
                            size="small"
                            sx={{
                                fontWeight: 800,
                                bgcolor: "#002F6C",
                                color: "white",
                                boxShadow: "0 2px 6px rgba(0, 47, 108, 0.25)",
                            }}
                        />
                    )}

                    <Button
                        variant="contained"
                        color="success"
                        startIcon={exportingExcel ? <CircularProgress size={18} color="inherit" /> : <FileDownloadIcon />}
                        disabled={exportingExcel}
                        onClick={handleExportAuditExcel}
                        sx={{
                            fontWeight: 900,
                            minHeight: 44,
                            borderRadius: 2.5,
                            px: 2,
                            textTransform: "none",
                            bgcolor: "#2e7d32",
                            "&:hover": { bgcolor: "#1b5e20" },
                        }}
                    >
                        {exportingExcel ? t("saving_status") : t("btn_export_xlsx")}
                    </Button>
                </Box>
            </Stack>

            {/* Financial Summary KPI Cards */}
            {summary && sheetSubView === "list" && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                        gap: 2,
                        mb: 3.5,
                    }}
                >
                    <Card elevation={2} sx={{ borderRadius: 3, borderLeft: "5px solid #002F6C" }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <AccountBalanceWalletIcon sx={{ color: "#002F6C", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("net_balance_kpi")}
                                </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, my: 0.5, color: "#002F6C" }}>
                                €{summary.net_treasury_balance.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {t("liquid_reserves")}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3, borderLeft: "5px solid #2e7d32" }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <TrendingUpIcon sx={{ color: "#2e7d32", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("total_inflows_kpi")}
                                </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, my: 0.5, color: "#2e7d32" }}>
                                €{(summary.total_dues_income + summary.total_other_income).toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                {t("dues_and_donations")}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3, borderLeft: "5px solid #d32f2f" }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <TrendingDownIcon sx={{ color: "#d32f2f", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("expenses_kpi")}
                                </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, my: 0.5, color: "#d32f2f" }}>
                                €{summary.total_expenses.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {t("outflow_vouchers")}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={2} sx={{ borderRadius: 3, borderLeft: "5px solid #F2A900" }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <PercentIcon sx={{ color: "#b78103", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    {t("collection_rate_kpi")}
                                </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 900, my: 0.5, color: "#b78103" }}>
                                {summary.dues_collection_rate}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                {t("viitenumero_reconciled")}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Main Navigation Tabs */}
            {sheetSubView === "list" && (
                <Box sx={{ borderBottom: 2, borderColor: "divider", mb: 3 }}>
                    <Tabs
                        value={suiteTab}
                        onChange={(_, val) => setSuiteTab(val)}
                        variant="fullWidth"
                        sx={{
                            "& .MuiTab-root": {
                                fontWeight: 800,
                                fontSize: { xs: "0.85rem", sm: "1rem" },
                                textTransform: "none",
                                pb: 1.5,
                            },
                        }}
                    >
                        <Tab icon={<ReceiptLongIcon />} iconPosition="start" label={t("tab_general_ledger")} />
                        <Tab
                            icon={<TableChartIcon />}
                            iconPosition="start"
                            label={
                                <Badge badgeContent={pendingSheetsCount} color="warning" sx={{ "& .MuiBadge-badge": { right: -18, top: 4 } }}>
                                    {t("tab_excel_studio")}
                                </Badge>
                            }
                        />
                        <Tab icon={<AssessmentIcon />} iconPosition="start" label={t("tab_fiscal_analytics")} />
                    </Tabs>
                </Box>
            )}

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : suiteTab === 0 ? (
                /* ================= TAB 0: GENERAL LEDGER ================= */
                <Box>
                    <Card elevation={1} sx={{ p: 2, borderRadius: 3.5, mb: 3 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                                <Chip
                                    label={t("filter_all_entries")}
                                    onClick={() => setTypeFilter("ALL")}
                                    color={typeFilter === "ALL" ? "primary" : "default"}
                                    sx={{ fontWeight: 800, borderRadius: 2 }}
                                />
                                <Chip
                                    label={t("filter_income")}
                                    onClick={() => setTypeFilter("INCOME")}
                                    color={typeFilter === "INCOME" ? "success" : "default"}
                                    sx={{ fontWeight: 800, borderRadius: 2 }}
                                />
                                <Chip
                                    label={t("filter_expense")}
                                    onClick={() => setTypeFilter("EXPENSE")}
                                    color={typeFilter === "EXPENSE" ? "error" : "default"}
                                    sx={{ fontWeight: 800, borderRadius: 2 }}
                                />
                            </Stack>

                            <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
                                <TextField
                                    size="small"
                                    placeholder={t("search_ledger_placeholder")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" color="action" />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />

                                {isTreasurer && (
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() => setOpenTxModal(true)}
                                        sx={{
                                            fontWeight: 800,
                                            borderRadius: 2.5,
                                            bgcolor: "#002F6C",
                                            whiteSpace: "nowrap",
                                            textTransform: "none",
                                            "&:hover": { bgcolor: "#001f4d" },
                                        }}
                                    >
                                        {t("btn_record_entry")}
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Card>

                    {transactions.length === 0 ? (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                            <Typography color="text.secondary" variant="h6">
                                {t("no_ledger_entries")}
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 3.5, overflowX: "auto" }}>
                            <Table sx={{ minWidth: 650 }}>
                                <TableHead sx={{ bgcolor: "#002F6C" }}>
                                    <TableRow>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_date")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_type")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_category")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_description")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_reference")}</TableCell>
                                        <TableCell align="right" sx={{ color: "white", fontWeight: 800 }}>{t("col_amount")}</TableCell>
                                        {isTreasurer && <TableCell align="center" sx={{ color: "white", fontWeight: 800 }}>{t("col_actions")}</TableCell>}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {transactions.map((tx) => {
                                        const isIncome = tx.transaction_type === "INCOME";
                                        return (
                                            <TableRow key={tx.id} hover>
                                                <TableCell sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                                                    {new Date(tx.transaction_date).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={t(`type_${tx.transaction_type.toLowerCase()}`)}
                                                        size="small"
                                                        color={isIncome ? "success" : "error"}
                                                        sx={{ fontWeight: 800, fontSize: "0.72rem" }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 700, fontSize: "0.9rem" }}>{tx.category}</TableCell>
                                                <TableCell sx={{ color: "text.primary", fontSize: "0.9rem" }}>{tx.description}</TableCell>
                                                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem", color: "text.secondary" }}>
                                                    {tx.reference_number || "—"}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900, color: isIncome ? "success.main" : "error.main", fontSize: "1rem" }}>
                                                    {isIncome ? "+" : "-"}€{tx.amount.toFixed(2)}
                                                </TableCell>
                                                {isTreasurer && (
                                                    <TableCell align="center">
                                                        <Tooltip title={t("delete_btn")}>
                                                            <IconButton size="small" color="error" onClick={() => handleDeleteTransaction(tx.id)}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            ) : suiteTab === 1 ? (
                /* ================= TAB 1: FINANCIAL SHEETS (MOM-STYLE ARCHITECTURE) ================= */
                <Box>
                    {/* VIEW 1: SPREADSHEETS LIST VIEW (MOM CARDS) */}
                    {sheetSubView === "list" && (
                        <Box>
                            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, gap: 1.5 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    📑 {t("tab_excel_studio")}
                                </Typography>

                                {canManageLedger && (
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={() => setOpenSheetCreate(true)}
                                        sx={{ bgcolor: "#002F6C", fontWeight: 800, borderRadius: 2.5, textTransform: "none" }}
                                    >
                                        {t("create_sheet_btn")}
                                    </Button>
                                )}
                            </Stack>

                            {sheets.length === 0 ? (
                                <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                                    <Typography color="text.secondary" variant="h6">
                                        {t("no_sheets_created")}
                                    </Typography>
                                </Paper>
                            ) : (
                                <Stack spacing={2}>
                                    {sheets.map((sheet) => (
                                        <Card
                                            key={sheet.id}
                                            elevation={2}
                                            sx={{
                                                borderRadius: 3,
                                                borderLeft: "6px solid",
                                                borderLeftColor:
                                                    sheet.status === "PUBLISHED"
                                                        ? "success.main"
                                                        : sheet.status === "SUBMITTED"
                                                            ? "warning.main"
                                                            : sheet.status === "VOIDED"
                                                                ? "error.main"
                                                                : "#002F6C",
                                                transition: "transform 0.15s, box-shadow 0.15s",
                                                "&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
                                            }}
                                        >
                                            <CardActionArea
                                                onClick={() => handleOpenSheetCard(sheet)}
                                                sx={{ p: { xs: 2, sm: 2.5 } }}
                                            >
                                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                        📊 {sheet.title}
                                                    </Typography>
                                                    <Chip
                                                        label={t(`status_${sheet.status.toLowerCase()}`)}
                                                        color={
                                                            sheet.status === "PUBLISHED"
                                                                ? "success"
                                                                : sheet.status === "SUBMITTED"
                                                                    ? "warning"
                                                                    : sheet.status === "VOIDED"
                                                                        ? "error"
                                                                        : "default"
                                                        }
                                                        size="small"
                                                        sx={{ fontWeight: "bold" }}
                                                    />
                                                </Box>

                                                <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 3 }} sx={{ color: "text.secondary", mt: 1 }}>
                                                    <Typography variant="body2">
                                                        {t("fiscal_period_label")} <b>{sheet.fiscal_year}</b>
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {t("net_balance_kpi")}:{" "}
                                                        <b style={{ color: sheet.net_balance >= 0 ? "#2e7d32" : "#d32f2f" }}>
                                                            €{sheet.net_balance.toFixed(2)}
                                                        </b>
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {t("created_by_label")} {sheet.creator_name}
                                                    </Typography>
                                                </Stack>
                                            </CardActionArea>
                                        </Card>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                    )}

                    {/* VIEW 2: DEDICATED MS EXCEL EDITOR VIEW (MOM EDITOR STYLE) */}
                    {sheetSubView === "editor" && activeSheet && (
                        <Box>
                            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, gap: 1.5 }}>
                                <Button
                                    startIcon={<ArrowBackIcon />}
                                    onClick={() => setSheetSubView("list")}
                                    variant="outlined"
                                    sx={{ fontWeight: 800, borderRadius: 2.5 }}
                                >
                                    {t("back_to_archive")}
                                </Button>

                                <Typography variant="h6" sx={{ fontWeight: 900, textAlign: "center", color: "#002F6C" }}>
                                    📊 {activeSheet.title} ({activeSheet.fiscal_year})
                                </Typography>

                                <Stack direction="row" spacing={1}>
                                    {!isSheetLocked && canManageLedger && (
                                        <Button
                                            variant="contained"
                                            color="success"
                                            onClick={handleSaveSheetGrid}
                                            disabled={savingGrid}
                                            sx={{ fontWeight: 800, textTransform: "none" }}
                                        >
                                            {savingGrid ? t("saving_status") : t("save_changes_btn")}
                                        </Button>
                                    )}

                                    {activeSheet.status === "DRAFT" && isTreasurer && (
                                        <Button
                                            variant="contained"
                                            color="warning"
                                            startIcon={<SendIcon />}
                                            onClick={handleSubmitSheetForApproval}
                                            sx={{ fontWeight: 800, textTransform: "none" }}
                                        >
                                            {t("btn_submit_for_approval")}
                                        </Button>
                                    )}

                                    {isPresident && activeSheet.status === "SUBMITTED" && (
                                        <Button
                                            variant="contained"
                                            color="warning"
                                            startIcon={<CheckCircleIcon />}
                                            onClick={handleApproveSheet}
                                            sx={{ fontWeight: 800, textTransform: "none" }}
                                        >
                                            {t("btn_approve_publish_ledger")}
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>

                            <Card elevation={3} sx={{ borderRadius: 3.5, p: { xs: 2, sm: 3 } }}>
                                {/* Excel Ribbon Bar */}
                                {!isSheetLocked && canManageLedger && (
                                    <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: "rgba(0, 47, 108, 0.05)", borderRadius: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            onClick={handleAddGridRow}
                                            sx={{ bgcolor: "#002F6C", fontWeight: 800, textTransform: "none" }}
                                        >
                                            {t("btn_add_row")}
                                        </Button>
                                        <Chip icon={<FunctionsIcon />} label={t("autosum_active_chip")} color="primary" variant="outlined" size="small" sx={{ fontWeight: 700 }} />
                                    </Paper>
                                )}

                                <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: "#002F6C" }}>
                                            <TableRow>
                                                <TableCell sx={{ color: "white", fontWeight: 800, width: 50 }}>#</TableCell>
                                                <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_category")}</TableCell>
                                                <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_description")}</TableCell>
                                                <TableCell sx={{ color: "white", fontWeight: 800, width: 150 }}>{t("col_type")}</TableCell>
                                                <TableCell align="right" sx={{ color: "white", fontWeight: 800, width: 160 }}>{t("col_amount")}</TableCell>
                                                {!isSheetLocked && canManageLedger && <TableCell align="center" sx={{ color: "white", width: 60 }}>—</TableCell>}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {editRows.map((row, idx) => (
                                                <TableRow key={idx} hover>
                                                    <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>{idx + 1}</TableCell>
                                                    <TableCell>
                                                        {!isSheetLocked && canManageLedger ? (
                                                            <TextField
                                                                size="small"
                                                                fullWidth
                                                                value={row.category}
                                                                onChange={(e) => {
                                                                    const next = [...editRows];
                                                                    next[idx].category = e.target.value;
                                                                    setEditRows(next);
                                                                }}
                                                            />
                                                        ) : (
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.category}</Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {!isSheetLocked && canManageLedger ? (
                                                            <TextField
                                                                size="small"
                                                                fullWidth
                                                                value={row.description}
                                                                onChange={(e) => {
                                                                    const next = [...editRows];
                                                                    next[idx].description = e.target.value;
                                                                    setEditRows(next);
                                                                }}
                                                            />
                                                        ) : (
                                                            <Typography variant="body2">{row.description}</Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {!isSheetLocked && canManageLedger ? (
                                                            <TextField
                                                                select
                                                                size="small"
                                                                fullWidth
                                                                value={row.type}
                                                                onChange={(e) => {
                                                                    const next = [...editRows];
                                                                    next[idx].type = e.target.value as "INCOME" | "EXPENSE";
                                                                    setEditRows(next);
                                                                }}
                                                            >
                                                                <MenuItem value="INCOME">{t("type_income_label")}</MenuItem>
                                                                <MenuItem value="EXPENSE">{t("type_expense_label")}</MenuItem>
                                                            </TextField>
                                                        ) : (
                                                            <Chip
                                                                label={t(`type_${row.type.toLowerCase()}`)}
                                                                size="small"
                                                                color={row.type === "INCOME" ? "success" : "error"}
                                                                sx={{ fontWeight: 800, fontSize: "0.68rem" }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {!isSheetLocked && canManageLedger ? (
                                                            <TextField
                                                                size="small"
                                                                type="number"
                                                                value={row.amount}
                                                                onChange={(e) => {
                                                                    const next = [...editRows];
                                                                    next[idx].amount = e.target.value;
                                                                    setEditRows(next);
                                                                }}
                                                            />
                                                        ) : (
                                                            <Typography variant="body2" sx={{ fontWeight: 800, color: row.type === "INCOME" ? "success.main" : "error.main" }}>
                                                                {row.type === "INCOME" ? "+" : "-"}€{parseFloat(String(row.amount || 0)).toFixed(2)}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    {!isSheetLocked && canManageLedger && (
                                                        <TableCell align="center">
                                                            <IconButton size="small" color="error" onClick={() => handleRemoveGridRow(idx)}>
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}

                                            {/* Clean Formatted Totals Row */}
                                            <TableRow sx={{ bgcolor: "action.hover" }}>
                                                <TableCell colSpan={3} sx={{ fontWeight: 900, color: "#002F6C", fontSize: "0.95rem" }}>
                                                    {t("net_balance_formula_label")}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.85rem" }}>
                                                    <Box component="span" sx={{ color: "success.main" }}>+€{liveIncome.toFixed(2)}</Box> / <Box component="span" sx={{ color: "error.main" }}>-€{liveExpense.toFixed(2)}</Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900, fontSize: "1.1rem", color: liveNet >= 0 ? "success.main" : "error.main" }}>
                                                    €{liveNet.toFixed(2)}
                                                </TableCell>
                                                {!isSheetLocked && canManageLedger && <TableCell />}
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Card>
                        </Box>
                    )}

                    {/* VIEW 3: DEDICATED OFFICIAL A4 CANVAS READER VIEW (MOM READER STYLE) */}
                    {sheetSubView === "reader" && activeSheet && (
                        <Box>
                            <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: "center", mb: 3, gap: 1.5, "@media print": { display: "none" } }}>
                                <Button
                                    startIcon={<ArrowBackIcon />}
                                    onClick={() => setSheetSubView("list")}
                                    variant="outlined"
                                    sx={{ fontWeight: 800, borderRadius: 2.5 }}
                                >
                                    {t("back_to_archive")}
                                </Button>

                                <Stack direction="row" spacing={1.5}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<FileDownloadIcon />}
                                        onClick={() => handleExportSingleSheet(activeSheet.id, activeSheet.title)}
                                        sx={{ fontWeight: 800, textTransform: "none", borderRadius: 2 }}
                                    >
                                        {t("btn_export_xlsx")}
                                    </Button>

                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<PrintIcon />}
                                        onClick={() => window.print()}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        {t("print_document")}
                                    </Button>

                                    {isPresident && !activeSheet.is_deleted && (
                                        <Tooltip title={t("tooltip_void_record")}>
                                            <IconButton color="error" onClick={() => setOpenVoidModal(true)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Stack>
                            </Stack>

                            {/* Official A4 Canvas Paper */}
                            <Paper
                                elevation={4}
                                sx={{
                                    p: { xs: 3, sm: 6 },
                                    maxWidth: 850,
                                    mx: "auto",
                                    borderRadius: 3,
                                    minHeight: 800,
                                    "@media print": { boxShadow: "none", p: 0, maxWidth: "100%" },
                                }}
                            >
                                <Box sx={{ textAlign: "center", mb: 4, pb: 2, borderBottom: "3px solid #002F6C" }}>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.main" }}>
                                        🦁 LIONS CLUB OFFICIAL FINANCIAL STATEMENT
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                                        {activeSheet.title}
                                    </Typography>
                                </Box>

                                <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.100", borderRadius: 2, mb: 4 }}>
                                    <Stack spacing={1}>
                                        <Typography variant="body1">
                                            <b>{t("fiscal_period_label")}</b> {activeSheet.fiscal_year}
                                        </Typography>
                                        <Typography variant="body1">
                                            <b>{t("certified_by_label")}</b> {activeSheet.approver_name || activeSheet.creator_name}
                                        </Typography>
                                        <Typography variant="body1">
                                            <b>{t("inflows_label")}</b> +€{activeSheet.total_income.toFixed(2)} |{" "}
                                            <b>{t("expenses_label")}</b> -€{activeSheet.total_expense.toFixed(2)} |{" "}
                                            <b>{t("net_balance_label")}</b> €{activeSheet.net_balance.toFixed(2)}
                                        </Typography>
                                    </Stack>
                                </Paper>

                                <Box sx={{ overflowX: "auto", mb: 6 }}>
                                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
                                        <Box component="thead" sx={{ bgcolor: "#002F6C", color: "white" }}>
                                            <Box component="tr">
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>#</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>{t("col_category")}</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>{t("col_description")}</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "center", fontWeight: 800, width: 100 }}>{t("col_type")}</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "right", fontWeight: 800, width: 140 }}>{t("col_amount")}</Box>
                                            </Box>
                                        </Box>
                                        <Box component="tbody">
                                            {activeSheet.grid_data?.rows?.map((row, idx) => (
                                                <Box component="tr" key={idx} sx={{ borderBottom: "1px solid #e0e0e0" }}>
                                                    <Box component="td" sx={{ p: 1.2, fontWeight: 700, color: "text.secondary" }}>{idx + 1}</Box>
                                                    <Box component="td" sx={{ p: 1.2, fontWeight: 700 }}>{row.category}</Box>
                                                    <Box component="td" sx={{ p: 1.2 }}>{row.description}</Box>
                                                    <Box component="td" sx={{ p: 1.2, textAlign: "center" }}>
                                                        <Chip
                                                            label={t(`type_${row.type.toLowerCase()}`)}
                                                            size="small"
                                                            color={row.type === "INCOME" ? "success" : "error"}
                                                            sx={{ fontWeight: 800, fontSize: "0.68rem" }}
                                                        />
                                                    </Box>
                                                    <Box component="td" sx={{ p: 1.2, textAlign: "right", fontWeight: 800, color: row.type === "INCOME" ? "success.main" : "error.main" }}>
                                                        {row.type === "INCOME" ? "+" : "-"}€{parseFloat(String(row.amount || 0)).toFixed(2)}
                                                    </Box>
                                                </Box>
                                            ))}
                                            <Box component="tr" sx={{ bgcolor: "grey.100" }}>
                                                <Box component="td" colSpan={3} sx={{ p: 1.5, fontWeight: 900, color: "#002F6C" }}>
                                                    {t("certified_net_balance_label")}
                                                </Box>
                                                <Box component="td" sx={{ p: 1.5, textAlign: "center", fontWeight: 800, color: "text.secondary", fontSize: "0.85rem" }}>
                                                    +€{activeSheet.total_income.toFixed(2)} / -€{activeSheet.total_expense.toFixed(2)}
                                                </Box>
                                                <Box component="td" sx={{ p: 1.5, textAlign: "right", fontWeight: 900, fontSize: "1.1rem", color: activeSheet.net_balance >= 0 ? "success.main" : "error.main" }}>
                                                    €{activeSheet.net_balance.toFixed(2)}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Statutory Sign-off Blocks */}
                                <Box sx={{ mt: 8, pt: 4, borderTop: "1px dashed #ccc", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 3 }}>
                                    <Box sx={{ textAlign: "center" }}>
                                        <Box sx={{ width: 170, borderBottom: "1px solid black", mb: 1 }} />
                                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>{t("sign_treasurer")}</Typography>
                                        <Typography variant="caption" color="text.secondary">Prepared & Verified</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: "center" }}>
                                        <Box sx={{ width: 170, borderBottom: "1px solid black", mb: 1 }} />
                                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>{t("sign_president")}</Typography>
                                        <Typography variant="caption" color="text.secondary">Certified & Approved</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: "center" }}>
                                        <Box sx={{ width: 170, borderBottom: "1px solid black", mb: 1 }} />
                                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>{t("sign_auditor")}</Typography>
                                        <Typography variant="caption" color="text.secondary">Audited & Inspected</Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    )}
                </Box>
            ) : (
                /* ================= TAB 2: FISCAL ANALYTICS ================= */
                <Box>
                    {summary && summary.category_breakdown.length > 0 ? (
                        <Card elevation={2} sx={{ p: 3, borderRadius: 3.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C", mb: 2 }}>
                                📊 {t("cost_center_allocation")}
                            </Typography>
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2.5 }}>
                                {summary.category_breakdown.map((c) => {
                                    const pct = summary.total_expenses > 0 ? (c.amount / summary.total_expenses) * 100 : 0;
                                    return (
                                        <Box key={c.category} sx={{ p: 2, borderRadius: 2.5, bgcolor: "action.hover", border: "1px solid rgba(0,0,0,0.06)" }}>
                                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                    {c.category}
                                                </Typography>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                    €{c.amount.toFixed(2)} ({pct.toFixed(0)}%)
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate"
                                                value={pct}
                                                sx={{ height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { bgcolor: "#002F6C" } }}
                                            />
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Card>
                    ) : (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                            <Typography color="text.secondary" variant="h6">
                                {t("no_analytics_available")}
                            </Typography>
                        </Paper>
                    )}
                </Box>
            )}

            {/* Record Transaction Modal */}
            <Dialog open={openTxModal} onClose={() => setOpenTxModal(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>📝 {t("record_ledger_entry_title")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateTransaction}>
                    <DialogContent dividers>
                        {txError && <Alert severity="error" sx={{ mb: 2 }}>{txError}</Alert>}

                        <TextField
                            select
                            fullWidth
                            required
                            label={t("transaction_nature_label")}
                            value={txType}
                            onChange={(e) => {
                                const val = e.target.value as "EXPENSE" | "INCOME";
                                setTxType(val);
                                setCategory(val === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
                            }}
                            margin="normal"
                        >
                            <MenuItem value="EXPENSE">🔴 {t("expense_outflow_opt")}</MenuItem>
                            <MenuItem value="INCOME">🟢 {t("income_inflow_opt")}</MenuItem>
                        </TextField>

                        <TextField
                            select
                            fullWidth
                            required
                            label={t("cost_center_label")}
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            margin="normal"
                        >
                            {(txType === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => (
                                <MenuItem key={cat} value={cat}>
                                    {cat}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            required
                            label={t("tx_description_label")}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Catering for Monthly Club Dinner"
                        />

                        <TextField
                            fullWidth
                            required
                            type="number"
                            label={t("amount_label")}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            margin="normal"
                        />

                        <TextField
                            fullWidth
                            label={t("voucher_no_label")}
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            margin="normal"
                            placeholder="e.g. VOUCHER-2026-08"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenTxModal(false)}>{t("cancel_btn")}</Button>
                        <Button type="submit" variant="contained" sx={{ fontWeight: 800, bgcolor: "#002F6C" }}>
                            {t("save_to_ledger_btn")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Create Spreadsheet Modal */}
            <Dialog open={openSheetCreate} onClose={() => setOpenSheetCreate(false)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>➕ {t("modal_create_sheet_title")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateSheetSubmit}>
                    <DialogContent dividers>
                        <TextField
                            fullWidth
                            required
                            label={t("sheet_title_label")}
                            value={sheetTitle}
                            onChange={(e) => setSheetTitle(e.target.value)}
                            margin="normal"
                            placeholder={t("sheet_title_placeholder")}
                        />

                        <TextField
                            fullWidth
                            required
                            label={t("fiscal_year_label")}
                            value={sheetYear}
                            onChange={(e) => setSheetYear(e.target.value)}
                            margin="normal"
                            placeholder="2026/2027"
                        />

                        <TextField
                            select
                            fullWidth
                            label={t("sheet_model_label")}
                            value={sheetType}
                            onChange={(e) => setSheetType(e.target.value as any)}
                            margin="normal"
                        >
                            <MenuItem value="BUDGET">{t("model_budget")}</MenuItem>
                            <MenuItem value="ANNUAL_ACCOUNTS">{t("model_annual_accounts")}</MenuItem>
                            <MenuItem value="PROJECT_LEDGER">{t("model_project_ledger")}</MenuItem>
                        </TextField>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenSheetCreate(false)}>{t("cancel_btn")}</Button>
                        <Button type="submit" variant="contained" sx={{ fontWeight: 800, bgcolor: "#002F6C" }}>
                            {t("btn_create_sheet_submit")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* President-Only Void Modal */}
            <Dialog open={openVoidModal} onClose={() => !voiding && setOpenVoidModal(false)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800, color: "error.main" }}>⚠️ {t("modal_void_title")}</DialogTitle>
                <Box component="form" onSubmit={handleVoidSheetSubmit}>
                    <DialogContent dividers>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t("void_explanation_note")}
                        </Typography>

                        <TextField
                            fullWidth
                            required
                            multiline
                            rows={3}
                            label={t("label_mandatory_void_reason")}
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            placeholder={t("placeholder_void_reason")}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenVoidModal(false)} disabled={voiding}>{t("cancel_btn")}</Button>
                        <Button type="submit" variant="contained" color="error" disabled={voiding} sx={{ fontWeight: 800 }}>
                            {voiding ? t("voiding_status") : t("confirm_void_btn")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Container>
    );
};