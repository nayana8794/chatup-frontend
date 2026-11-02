// chatup/frontend/src/pages/FinancialSheets.tsx
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
    IconButton,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SendIcon from "@mui/icons-material/Send";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FunctionsIcon from "@mui/icons-material/Functions";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { playNotificationChime } from "../utils/sound";
import apiClient from "../api/client";

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

export const FinancialSheets: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const isTreasurer = ["SUPER_ADMIN", "TREASURER", "VICE_TREASURER"].includes(user?.role || "");
    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");

    const [sheets, setSheets] = useState<FinancialSheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSheet, setActiveSheet] = useState<FinancialSheet | null>(null);

    // Interactive Excel Editor State
    const [editRows, setEditRows] = useState<GridRow[]>([]);
    const [saving, setSaving] = useState(false);

    // Create Modal
    const [openCreate, setOpenCreate] = useState(false);
    const [createTitle, setCreateTitle] = useState("");
    const [createYear, setCreateYear] = useState("2026/2027");
    const [createType, setCreateType] = useState<"BUDGET" | "ANNUAL_ACCOUNTS">("BUDGET");

    // Void / Soft Delete Modal
    const [openVoid, setOpenVoid] = useState(false);
    const [voidReason, setVoidReason] = useState("");
    const [voiding, setVoiding] = useState(false);

    const fetchSheets = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get<FinancialSheet[]>("/financial-sheets");
            setSheets(res.data);
            if (activeSheet) {
                const refreshed = res.data.find((s) => s.id === activeSheet.id);
                if (refreshed) {
                    setActiveSheet(refreshed);
                    setEditRows(refreshed.grid_data?.rows || []);
                }
            } else if (res.data.length > 0) {
                setActiveSheet(res.data[0]);
                setEditRows(res.data[0].grid_data?.rows || []);
            }
        } catch (err) {
            console.error("Failed to fetch financial sheets:", err);
        } finally {
            setLoading(false);
        }
    }, [activeSheet]);

    useEffect(() => {
        fetchSheets();
    }, [fetchSheets]);

    useEffect(() => {
        if (
            lastEvent?.type === "FINANCIAL_SHEET_SUBMITTED" ||
            lastEvent?.type === "FINANCIAL_SHEET_APPROVED" ||
            lastEvent?.type === "FINANCIAL_SHEET_VOIDED"
        ) {
            playNotificationChime();
            fetchSheets();
        }
    }, [lastEvent, fetchSheets]);

    const handleSelectSheet = (sheet: FinancialSheet) => {
        setActiveSheet(sheet);
        setEditRows(sheet.grid_data?.rows || []);
    };

    const handleAddRow = () => {
        setEditRows([
            ...editRows,
            { category: t("general_category", "General"), description: "", type: "EXPENSE", amount: "" },
        ]);
    };

    const handleRemoveRow = (idx: number) => {
        setEditRows(editRows.filter((_, i) => i !== idx));
    };

    const handleSaveGrid = async () => {
        if (!activeSheet) return;
        setSaving(true);
        try {
            const cleanRows = editRows.map((r) => ({
                ...r,
                amount: parseFloat(String(r.amount)) || 0.0,
            }));
            const res = await apiClient.put(`/financial-sheets/${activeSheet.id}`, {
                grid_data: { rows: cleanRows },
            });
            setActiveSheet(res.data);
            fetchSheets();
            alert(t("sheet_saved_success", "Spreadsheet updated successfully!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_save_failed", "Failed to save spreadsheet"));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitForApproval = async () => {
        if (!activeSheet) return;
        if (!window.confirm(t("confirm_submit_approval", "Submit this financial ledger sheet to the President for official approval?"))) return;
        try {
            await apiClient.post(`/financial-sheets/${activeSheet.id}/submit`);
            fetchSheets();
            alert(t("sheet_submitted_msg", "Sheet submitted for President approval!"));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_submit_failed", "Failed to submit sheet"));
        }
    };

    const handleApproveSheet = async () => {
        if (!activeSheet) return;
        try {
            await apiClient.post(`/financial-sheets/${activeSheet.id}/approve`);
            fetchSheets();
            alert(t("sheet_approved_msg", "Financial sheet approved and published! Tamper-proof audit active."));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_approve_failed", "Failed to approve sheet"));
        }
    };

    const handleVoidSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSheet) return;
        setVoiding(true);
        try {
            await apiClient.post(`/financial-sheets/${activeSheet.id}/void`, {
                deletion_reason: voidReason,
            });
            setOpenVoid(false);
            setVoidReason("");
            fetchSheets();
            alert(t("sheet_voided_msg", "Record voided. Audited entry preserved for statutory inspectors."));
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_void_failed", "Failed to void sheet"));
        } finally {
            setVoiding(false);
        }
    };

    const handleExportExcel = async (sheetId: string, title: string) => {
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

    const handleCreateSheet = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const initialRows: GridRow[] = [
                { category: "Membership Dues", description: "Annual member fee collection", type: "INCOME", amount: 6000 },
                { category: "Administration", description: "Auditing & bank fees", type: "EXPENSE", amount: 450 },
                { category: "Charity Project", description: "Youth camp activity funding", type: "EXPENSE", amount: 2500 },
            ];
            const res = await apiClient.post("/financial-sheets", {
                title: createTitle.trim(),
                fiscal_year: createYear.trim(),
                sheet_type: createType,
                grid_data: { rows: initialRows },
            });
            setOpenCreate(false);
            setCreateTitle("");
            fetchSheets();
            setActiveSheet(res.data);
            setEditRows(initialRows);
        } catch (err: any) {
            alert(err.response?.data?.detail || t("sheet_create_failed", "Failed to create spreadsheet"));
        }
    };

    const liveIncome = editRows.filter((r) => r.type === "INCOME").reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
    const liveExpense = editRows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
    const liveNet = liveIncome - liveExpense;

    const isLocked = activeSheet?.status === "PUBLISHED" || activeSheet?.status === "SUBMITTED" || activeSheet?.status === "VOIDED";

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3.5 }, px: { xs: 1.5, sm: 3 } }}>
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
                        {t("back_to_dashboard", "Back to Dashboard")}
                    </Button>
                </Box>

                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 900,
                        fontSize: { xs: "1.25rem", sm: "1.65rem" },
                        color: "text.primary",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.2,
                        textAlign: "center",
                        flex: 1,
                    }}
                >
                    📑 {t("financial_sheets_title", "Financial Sheets & MS Excel Studio")}
                </Typography>

                <Box
                    sx={{
                        minWidth: { sm: 200 },
                        display: "flex",
                        justifyContent: { xs: "center", sm: "flex-end" },
                    }}
                >
                    {isTreasurer && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => setOpenCreate(true)}
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
                            {t("create_sheet_btn", "Create Spreadsheet")}
                        </Button>
                    )}
                </Box>
            </Stack>

            {/* Presidential Review & Approval Banner */}
            {isPresident && activeSheet && activeSheet.status === "SUBMITTED" && (
                <Alert
                    severity="warning"
                    icon={<FactCheckIcon sx={{ fontSize: 32, color: "#E65100" }} />}
                    sx={{ mb: 3, p: 2, borderRadius: 3.5, border: "1px solid #FFCC80" }}
                    action={
                        <Button
                            variant="contained"
                            color="warning"
                            startIcon={<CheckCircleIcon />}
                            onClick={handleApproveSheet}
                            sx={{ fontWeight: 800, textTransform: "none" }}
                        >
                            {t("btn_approve_publish_ledger", "Approve & Publish Ledger")}
                        </Button>
                    }
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {t("approval_requested_label", "Executive Approval Requested:")} {activeSheet.title} ({activeSheet.fiscal_year})
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {t("submitted_by_review_desc", "Submitted by {creator}. Review figures below and approve into statutory records.").replace("{creator}", activeSheet.creator_name)}
                    </Typography>
                </Alert>
            )}

            {/* Voided Audit Notice */}
            {activeSheet && activeSheet.is_deleted && (
                <Alert severity="error" icon={<BlockIcon />} sx={{ mb: 3, p: 2, borderRadius: 3.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        ⚠️ {t("voided_audit_title", "VOIDED AUDIT RECORD — Soft-Deleted by President")}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
                        {t("void_reason_prefix", "Reason:")} "{activeSheet.deletion_reason}" | {t("preserved_for_auditors_note", "Preserved for statutory association inspectors (Tilintarkastaja).")}
                    </Typography>
                </Alert>
            )}

            {/* Sheet Selector Chips */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
                {sheets.map((s) => (
                    <Chip
                        key={s.id}
                        label={`${s.title} (${s.fiscal_year})`}
                        onClick={() => handleSelectSheet(s)}
                        color={activeSheet?.id === s.id ? "primary" : "default"}
                        variant={activeSheet?.id === s.id ? "filled" : "outlined"}
                        sx={{ fontWeight: 800, py: 2, px: 1, borderRadius: 2.5 }}
                    />
                ))}
            </Box>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : activeSheet ? (
                <Card elevation={3} sx={{ borderRadius: 3.5, borderLeft: "6px solid #002F6C" }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        {/* Sheet Metadata Bar */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                    {activeSheet.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {t("fiscal_period_label", "Fiscal Period:")} <b>{activeSheet.fiscal_year}</b> • {t("created_by_label", "Created by:")} {activeSheet.creator_name}
                                </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Chip
                                    label={t(`status_${activeSheet.status.toLowerCase()}`, activeSheet.status)}
                                    color={
                                        activeSheet.status === "PUBLISHED"
                                            ? "success"
                                            : activeSheet.status === "SUBMITTED"
                                                ? "warning"
                                                : activeSheet.status === "VOIDED"
                                                    ? "error"
                                                    : "default"
                                    }
                                    sx={{ fontWeight: 800 }}
                                />

                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FileDownloadIcon />}
                                    onClick={() => handleExportExcel(activeSheet.id, activeSheet.title)}
                                    sx={{ fontWeight: 800, textTransform: "none", borderRadius: 2 }}
                                >
                                    {t("btn_export_xlsx", "Export .xlsx")}
                                </Button>

                                {isPresident && !activeSheet.is_deleted && (
                                    <Tooltip title={t("tooltip_void_record", "Soft Delete / Void Record")}>
                                        <IconButton color="error" size="small" onClick={() => setOpenVoid(true)}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Stack>
                        </Box>

                        {/* Interactive MS Excel Ribbon Bar */}
                        {!isLocked && isTreasurer && (
                            <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: "rgba(0, 47, 108, 0.05)", borderRadius: 2.5, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddRow}
                                    sx={{ bgcolor: "#002F6C", fontWeight: 800, textTransform: "none" }}
                                >
                                    {t("btn_add_row", "Add Row")}
                                </Button>

                                <Chip icon={<FunctionsIcon />} label={t("autosum_active_chip", "Auto-Sum Active")} color="primary" variant="outlined" size="small" sx={{ fontWeight: 700 }} />

                                <Box sx={{ flex: 1 }} />

                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    onClick={handleSaveGrid}
                                    disabled={saving}
                                    sx={{ fontWeight: 800, textTransform: "none" }}
                                >
                                    {saving ? t("saving_status", "Saving…") : t("save_changes_btn", "Save Changes")}
                                </Button>

                                {activeSheet.status === "DRAFT" && (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="warning"
                                        startIcon={<SendIcon />}
                                        onClick={handleSubmitForApproval}
                                        sx={{ fontWeight: 800, textTransform: "none" }}
                                    >
                                        {t("btn_submit_for_approval", "Submit for Approval")}
                                    </Button>
                                )}
                            </Paper>
                        )}

                        {isLocked && (
                            <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                                <LockIcon fontSize="small" />
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                    {t("locked_governance_notice", "Record locked under statutory governance. Editing is restricted to preserve tamper-proof audit integrity.")}
                                </Typography>
                            </Box>
                        )}

                        {/* Excel-Style Spreadsheet Canvas Table */}
                        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: "#002F6C" }}>
                                    <TableRow>
                                        <TableCell sx={{ color: "white", fontWeight: 800, width: 50 }}>#</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_category", "Category / Cost Center")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_description", "Description")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800, width: 150 }}>{t("col_type", "Type")}</TableCell>
                                        <TableCell align="right" sx={{ color: "white", fontWeight: 800, width: 160 }}>{t("col_amount", "Amount (€)")}</TableCell>
                                        {!isLocked && isTreasurer && <TableCell align="center" sx={{ color: "white", fontWeight: 800, width: 60 }}>—</TableCell>}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {editRows.map((row, idx) => (
                                        <TableRow key={idx} hover>
                                            <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>{idx + 1}</TableCell>
                                            <TableCell>
                                                {!isLocked && isTreasurer ? (
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
                                                {!isLocked && isTreasurer ? (
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
                                                {!isLocked && isTreasurer ? (
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
                                                        <MenuItem value="INCOME">{t("type_income_label", "INCOME (+)")}</MenuItem>
                                                        <MenuItem value="EXPENSE">{t("type_expense_label", "EXPENSE (-)")}</MenuItem>
                                                    </TextField>
                                                ) : (
                                                    <Chip
                                                        label={t(`type_${row.type.toLowerCase()}`, row.type)}
                                                        size="small"
                                                        color={row.type === "INCOME" ? "success" : "error"}
                                                        sx={{ fontWeight: 800, fontSize: "0.68rem" }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {!isLocked && isTreasurer ? (
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
                                            {!isLocked && isTreasurer && (
                                                <TableCell align="center">
                                                    <IconButton size="small" color="error" onClick={() => handleRemoveRow(idx)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}

                                    {/* Auto-Calculated Formula Totals Row */}
                                    <TableRow sx={{ bgcolor: "action.hover" }}>
                                        <TableCell colSpan={3} sx={{ fontWeight: 900, color: "#002F6C" }}>
                                            {t("net_balance_formula_label", "NET TREASURY BALANCE (Calculated Formula)")}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 800 }}>
                                            +€{liveIncome.toFixed(2)} / -€{liveExpense.toFixed(2)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 900, fontSize: "1.05rem", color: liveNet >= 0 ? "success.main" : "error.main" }}>
                                            €{liveNet.toFixed(2)}
                                        </TableCell>
                                        {!isLocked && isTreasurer && <TableCell />}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            ) : null}

            {/* Create Spreadsheet Modal */}
            <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>➕ {t("modal_create_sheet_title", "Create Financial Spreadsheet")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateSheet}>
                    <DialogContent dividers>
                        <TextField
                            fullWidth
                            required
                            label={t("sheet_title_label", "Document Title")}
                            value={createTitle}
                            onChange={(e) => setCreateTitle(e.target.value)}
                            margin="normal"
                            placeholder={t("sheet_title_placeholder", "e.g. Annual Budget 2026/2027")}
                        />

                        <TextField
                            fullWidth
                            required
                            label={t("fiscal_year_label", "Fiscal Year")}
                            value={createYear}
                            onChange={(e) => setCreateYear(e.target.value)}
                            margin="normal"
                            placeholder="2026/2027"
                        />

                        <TextField
                            select
                            fullWidth
                            label={t("sheet_model_label", "Sheet Model")}
                            value={createType}
                            onChange={(e) => setCreateType(e.target.value as any)}
                            margin="normal"
                        >
                            <MenuItem value="BUDGET">{t("model_budget", "Annual Operating Budget")}</MenuItem>
                            <MenuItem value="ANNUAL_ACCOUNTS">{t("model_annual_accounts", "Statutory Accounts (Tilinpäätös)")}</MenuItem>
                            <MenuItem value="PROJECT_LEDGER">{t("model_project_ledger", "Charity Project Spreadsheet")}</MenuItem>
                        </TextField>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenCreate(false)}>{t("cancel_btn", "Cancel")}</Button>
                        <Button type="submit" variant="contained" sx={{ fontWeight: 800, bgcolor: "#002F6C" }}>
                            {t("btn_create_sheet_submit", "Create Sheet")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* President-Only Void / Soft Delete Reason Modal */}
            <Dialog open={openVoid} onClose={() => !voiding && setOpenVoid(false)} maxWidth="xs" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800, color: "error.main" }}>⚠️ {t("modal_void_title", "Void Statutory Financial Sheet")}</DialogTitle>
                <Box component="form" onSubmit={handleVoidSubmit}>
                    <DialogContent dividers>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t("void_explanation_note", "This record will be marked as VOIDED and locked. The audit trail will be retained for statutory association inspectors (Tilintarkastaja).")}
                        </Typography>

                        <TextField
                            fullWidth
                            required
                            multiline
                            rows={3}
                            label={t("label_mandatory_void_reason", "Mandatory Reason for Voiding")}
                            value={voidReason}
                            onChange={(e) => setVoidReason(e.target.value)}
                            placeholder={t("placeholder_void_reason", "e.g. Superseded by updated General Assembly resolution on 14.10...")}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenVoid(false)} disabled={voiding}>{t("cancel_btn", "Cancel")}</Button>
                        <Button type="submit" variant="contained" color="error" disabled={voiding} sx={{ fontWeight: 800 }}>
                            {voiding ? t("voiding_status", "Voiding…") : t("confirm_void_btn", "Confirm Void")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Container>
    );
};