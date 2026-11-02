// chatup/frontend/src/pages/Bookkeeping.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PercentIcon from "@mui/icons-material/Percent";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
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

    const isTreasurer = ["SUPER_ADMIN", "TREASURER", "VICE_TREASURER"].includes(user?.role || "");
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");

    const [summary, setSummary] = useState<BookkeepingSummary | null>(null);
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [typeFilter, setTypeFilter] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Record Transaction Modal
    const [openModal, setOpenModal] = useState(false);
    const [txType, setTxType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [reference, setReference] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const [exportingExcel, setExportingExcel] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [sumRes, txRes] = await Promise.all([
                apiClient.get<BookkeepingSummary>("/bookkeeping/summary"),
                apiClient.get<TransactionItem[]>("/bookkeeping/transactions", {
                    params: {
                        tx_type: typeFilter !== "ALL" ? typeFilter : undefined,
                        search: searchQuery || undefined,
                    },
                }),
            ]);
            setSummary(sumRes.data);
            setTransactions(txRes.data);
        } catch (err) {
            console.error("Failed to load bookkeeping records:", err);
        } finally {
            setLoading(false);
        }
    }, [typeFilter, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        setSubmitting(true);

        try {
            await apiClient.post("/bookkeeping/transactions", {
                transaction_type: txType,
                category: category.trim(),
                description: description.trim(),
                amount: parseFloat(amount),
                reference_number: reference.trim() || undefined,
            });
            setOpenModal(false);
            setDescription("");
            setAmount("");
            setReference("");
            fetchData();
        } catch (err: any) {
            setFormError(err.response?.data?.detail || "Failed to record transaction entry");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTransaction = async (txId: string) => {
        if (!window.confirm("Void and delete this ledger transaction?")) return;
        try {
            await apiClient.delete(`/bookkeeping/transactions/${txId}`);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete transaction");
        }
    };

    const handleExportExcel = async () => {
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
            a.download = `Financial_Audit_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            alert("Failed to export Excel audit workbook");
        } finally {
            setExportingExcel(false);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 }, px: { xs: 2, sm: 3 } }}>
            {/* Header: Exact Matching Centered Layout */}
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
                        {t("back_to_dashboard", "Back to Dashboard")}
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
                    📊 {t("bookkeeping_title", "Financial Bookkeeping & General Ledger")}
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
                    {/* Meaningful usage of isPresident and VerifiedIcon */}
                    {isPresident && !isTreasurer && (
                        <Chip
                            icon={<VerifiedIcon sx={{ fontSize: 16, color: "white !important" }} />}
                            label={t("executive_oversight", "Executive Oversight")}
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
                        onClick={handleExportExcel}
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
                        {exportingExcel ? "Exporting…" : "Export Excel (.xlsx)"}
                    </Button>
                </Box>
            </Stack>

            {/* Financial Summary KPI Cards */}
            {summary && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
                        gap: 2.5,
                        mb: 4,
                    }}
                >
                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #002F6C" }}>
                        <CardContent sx={{ p: 2.2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <AccountBalanceWalletIcon sx={{ color: "#002F6C", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    Net Treasury Balance
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#002F6C" }}>
                                €{summary.net_treasury_balance.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                Liquid Reserves
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #2e7d32" }}>
                        <CardContent sx={{ p: 2.2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <TrendingUpIcon sx={{ color: "#2e7d32", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    Total Inflow Revenue
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#2e7d32" }}>
                                €{(summary.total_dues_income + summary.total_other_income).toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                Dues: €{summary.total_dues_income.toFixed(2)} | Inflows: €{summary.total_other_income.toFixed(2)}
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #d32f2f" }}>
                        <CardContent sx={{ p: 2.2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <TrendingDownIcon sx={{ color: "#d32f2f", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    Disbursed Expenses
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#d32f2f" }}>
                                €{summary.total_expenses.toFixed(2)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                Outflow Vouchers Recorded
                            </Typography>
                        </CardContent>
                    </Card>

                    <Card elevation={3} sx={{ borderRadius: 3, borderLeft: "5px solid #F2A900" }}>
                        <CardContent sx={{ p: 2.2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <PercentIcon sx={{ color: "#b78103", fontSize: 20 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800, textTransform: "uppercase" }}>
                                    Dues Collection Rate
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 900, my: 0.5, color: "#b78103" }}>
                                {summary.dues_collection_rate}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700 }}>
                                Finnish Viitenumero Reconciled
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Expense Categories Allocation Bar */}
            {summary && summary.category_breakdown.length > 0 && (
                <Card elevation={1} sx={{ p: 2.5, borderRadius: 3.5, mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "text.primary", mb: 1.5 }}>
                        📊 Cost Center Allocation & Disbursements:
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: 2 }}>
                        {summary.category_breakdown.map((c) => {
                            const pct = summary.total_expenses > 0 ? (c.amount / summary.total_expenses) * 100 : 0;
                            return (
                                <Box key={c.category} sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {c.category}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }}>
                                            €{c.amount.toFixed(2)} ({pct.toFixed(0)}%)
                                        </Typography>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={pct}
                                        sx={{ height: 6, borderRadius: 3, "& .MuiLinearProgress-bar": { bgcolor: "#002F6C" } }}
                                    />
                                </Box>
                            );
                        })}
                    </Box>
                </Card>
            )}

            {/* Ledger Filter & Action Controls */}
            <Card elevation={1} sx={{ p: 2, borderRadius: 3.5, mb: 3 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                        <Chip
                            label="All Entries"
                            onClick={() => setTypeFilter("ALL")}
                            color={typeFilter === "ALL" ? "primary" : "default"}
                            sx={{ fontWeight: 800, borderRadius: 2 }}
                        />
                        <Chip
                            label="Income & Dues"
                            onClick={() => setTypeFilter("INCOME")}
                            color={typeFilter === "INCOME" ? "success" : "default"}
                            sx={{ fontWeight: 800, borderRadius: 2 }}
                        />
                        <Chip
                            label="Expenses & Outflows"
                            onClick={() => setTypeFilter("EXPENSE")}
                            color={typeFilter === "EXPENSE" ? "error" : "default"}
                            sx={{ fontWeight: 800, borderRadius: 2 }}
                        />
                    </Stack>

                    <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
                        <TextField
                            size="small"
                            placeholder="Search description or reference..."
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
                                startIcon={<AddCircleIcon />}
                                onClick={() => setOpenModal(true)}
                                sx={{
                                    fontWeight: 800,
                                    borderRadius: 2.5,
                                    bgcolor: "#002F6C",
                                    whiteSpace: "nowrap",
                                    "&:hover": { bgcolor: "#001f4d" },
                                }}
                            >
                                Record Entry
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Card>

            {/* General Ledger Table */}
            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : transactions.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                    <Typography color="text.secondary" variant="h6">
                        No financial ledger entries found.
                    </Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 3.5, overflowX: "auto" }}>
                    <Table sx={{ minWidth: 650 }}>
                        <TableHead sx={{ bgcolor: "#002F6C" }}>
                            <TableRow>
                                <TableCell sx={{ color: "white", fontWeight: 800 }}>Date</TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800 }}>Type</TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800 }}>Category / Cost Center</TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800 }}>Description</TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800 }}>Reference / Receipt</TableCell>
                                <TableCell align="right" sx={{ color: "white", fontWeight: 800 }}>Amount (€)</TableCell>
                                {isTreasurer && <TableCell align="center" sx={{ color: "white", fontWeight: 800 }}>Actions</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {transactions.map((tx) => {
                                const isIncome = tx.transaction_type === "INCOME";
                                return (
                                    <TableRow key={tx.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                                            {new Date(tx.transaction_date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={tx.transaction_type}
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
                                                <Tooltip title="Delete Ledger Entry">
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

            {/* Record Transaction Modal */}
            <Dialog open={openModal} onClose={() => !submitting && setOpenModal(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>📝 Record Financial Ledger Entry</DialogTitle>
                <Box component="form" onSubmit={handleCreateTransaction}>
                    <DialogContent dividers>
                        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

                        <TextField
                            select
                            fullWidth
                            required
                            label="Transaction Nature"
                            value={txType}
                            onChange={(e) => {
                                const val = e.target.value as "EXPENSE" | "INCOME";
                                setTxType(val);
                                setCategory(val === "EXPENSE" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
                            }}
                            margin="normal"
                        >
                            <MenuItem value="EXPENSE">🔴 Disbursed Expense / Outflow</MenuItem>
                            <MenuItem value="INCOME">🟢 Fundraising / Donation / Other Inflow</MenuItem>
                        </TextField>

                        <TextField
                            select
                            fullWidth
                            required
                            label="Accounting Category / Cost Center"
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
                            label="Transaction Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Catering for Monthly Club Dinner"
                        />

                        <TextField
                            fullWidth
                            required
                            type="number"
                            label="Amount (€)"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            margin="normal"
                        />

                        <TextField
                            fullWidth
                            label="Bank Reference / Voucher No (Optional)"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            margin="normal"
                            placeholder="e.g. VOUCHER-2026-08"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenModal(false)} disabled={submitting}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 800, bgcolor: "#002F6C" }}>
                            {submitting ? <CircularProgress size={24} color="inherit" /> : "Save to Ledger"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Container>
    );
};