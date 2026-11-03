// chatup/frontend/src/pages/FinancialReports.tsx
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
    CircularProgress,
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
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useTranslation } from "react-i18next";
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
    is_deleted?: boolean;
    deletion_reason?: string;
    creator_name: string;
    approver_name?: string;
    approved_at?: string;
    created_at: string;
}

export const FinancialReports: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();

    const [sheets, setSheets] = useState<FinancialSheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSheet, setSelectedSheet] = useState<FinancialSheet | null>(null);

    const fetchPublishedReports = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get<FinancialSheet[]>("/financial-sheets");
            const published = res.data.filter((s) => s.status === "PUBLISHED" && !s.is_deleted);
            setSheets(published);
            if (published.length > 0) {
                setSelectedSheet(published[0]);
            }
        } catch (err) {
            console.error("Failed to load published financial reports:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPublishedReports();
    }, [fetchPublishedReports]);

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

    const rows = selectedSheet?.grid_data?.rows || [];

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 }, px: { xs: 2, sm: 3 } }}>
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
                    📈 {t("financial_reports_title", "Official Club Financial Reports")}
                </Typography>

                <Box sx={{ minWidth: { sm: 200 }, display: { xs: "none", sm: "block" } }} />
            </Stack>

            {/* Report Selector Chips */}
            {sheets.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
                    {sheets.map((s) => (
                        <Chip
                            key={s.id}
                            icon={<AssessmentIcon />}
                            label={`${s.title} (${s.fiscal_year})`}
                            onClick={() => setSelectedSheet(s)}
                            color={selectedSheet?.id === s.id ? "primary" : "default"}
                            variant={selectedSheet?.id === s.id ? "filled" : "outlined"}
                            sx={{ fontWeight: 800, py: 2, px: 1, borderRadius: 2.5 }}
                        />
                    ))}
                </Box>
            )}

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : selectedSheet ? (
                <Card elevation={3} sx={{ borderRadius: 3.5, borderLeft: "6px solid #2E7D32" }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                    {selectedSheet.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {t("fiscal_period_label", "Fiscal Period:")} <b>{selectedSheet.fiscal_year}</b> • {t("certified_by_label", "Certified & Published by:")} {selectedSheet.approver_name || selectedSheet.creator_name}
                                </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Chip label={t("status_published", "CERTIFIED & PUBLISHED")} color="success" sx={{ fontWeight: 800 }} />
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FileDownloadIcon />}
                                    onClick={() => handleExportExcel(selectedSheet.id, selectedSheet.title)}
                                    sx={{ fontWeight: 800, textTransform: "none", borderRadius: 2 }}
                                >
                                    {t("btn_export_xlsx", "Export .xlsx")}
                                </Button>
                            </Stack>
                        </Box>

                        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: "#002F6C" }}>
                                    <TableRow>
                                        <TableCell sx={{ color: "white", fontWeight: 800, width: 50 }}>#</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_category", "Category / Cost Center")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_description", "Description")}</TableCell>
                                        <TableCell sx={{ color: "white", fontWeight: 800, width: 150 }}>{t("col_type", "Type")}</TableCell>
                                        <TableCell align="right" sx={{ color: "white", fontWeight: 800, width: 160 }}>{t("col_amount", "Amount (€)")}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row, idx) => (
                                        <TableRow key={idx} hover>
                                            <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>{idx + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>{row.category}</TableCell>
                                            <TableCell>{row.description}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={t(`type_${row.type.toLowerCase()}`, row.type)}
                                                    size="small"
                                                    color={row.type === "INCOME" ? "success" : "error"}
                                                    sx={{ fontWeight: 800, fontSize: "0.68rem" }}
                                                />
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, color: row.type === "INCOME" ? "success.main" : "error.main" }}>
                                                {row.type === "INCOME" ? "+" : "-"}€{parseFloat(String(row.amount || 0)).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    <TableRow sx={{ bgcolor: "action.hover" }}>
                                        <TableCell colSpan={3} sx={{ fontWeight: 900, color: "#002F6C", fontSize: "0.95rem" }}>
                                            {t("certified_net_balance_label", "CERTIFIED NET TREASURY BALANCE")}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.85rem" }}>
                                            +€{selectedSheet.total_income.toFixed(2)} / -€{selectedSheet.total_expense.toFixed(2)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 900, fontSize: "1.1rem", color: selectedSheet.net_balance >= 0 ? "success.main" : "error.main" }}>
                                            €{selectedSheet.net_balance.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            ) : (
                <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                    <AssessmentIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{t("no_published_reports", "No Published Financial Reports")}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t("no_published_reports_desc", "The club treasurer and president have not yet published certified financial reports.")}
                    </Typography>
                </Paper>
            )}
        </Container>
    );
};