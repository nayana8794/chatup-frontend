// chatup/frontend/src/components/ClubPaymentHistoryModal.tsx
import React, { useState, useEffect, useCallback } from "react";
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Alert,
} from "@mui/material";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface PaymentRecord {
    id: string;
    amount_eur: number;
    reference_number: string;
    notes: string;
    paid_at: string;
    status: string;
}

interface BillingHistoryData {
    club_id: string;
    club_name: string;
    current_plan: string;
    billing_cycle: string;
    subscription_status: string;
    payment_history: PaymentRecord[];
}

interface Props {
    open: boolean;
    onClose: () => void;
    clubId: string;
    clubName: string;
    onSuccess: () => void;
}

export const ClubPaymentHistoryModal: React.FC<Props> = ({ open, onClose, clubId, clubName, onSuccess }) => {
    const { t } = useTranslation();
    const [data, setData] = useState<BillingHistoryData | null>(null);
    const [loading, setLoading] = useState(true);

    const [showRecordForm, setShowRecordForm] = useState(false);
    const [amount, setAmount] = useState("");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const fetchHistory = useCallback(async () => {
        if (!clubId) return;
        setLoading(true);
        try {
            const res = await apiClient.get<BillingHistoryData>(`/admin/clubs/${clubId}/billing-history`);
            setData(res.data);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        if (open) {
            setShowRecordForm(false);
            fetchHistory();
        }
    }, [open, fetchHistory]);

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        try {
            await apiClient.post(`/admin/clubs/${clubId}/billing-history`, {
                amount_eur: parseFloat(amount) || 0,
                reference_number: reference.trim() || undefined,
                notes: notes.trim() || undefined,
            });
            setAmount("");
            setReference("");
            setNotes("");
            setShowRecordForm(false);
            fetchHistory();
            onSuccess();
        } catch (err: any) {
            setErrorMsg(err.response?.data?.detail || t("payment_record_failed", "Failed to record payment"));
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 4, maxHeight: "92vh" } }}>
            <DialogTitle sx={{ fontWeight: 900, color: "#002F6C", display: "flex", alignItems: "center", gap: 1 }}>
                <ReceiptIcon sx={{ color: "#F2A900" }} />
                {t("payment_history_title", "Subscription & Payment Audit History")}: {clubName}
            </DialogTitle>
            <DialogContent dividers sx={{ overflowY: "auto" }}>
                {loading ? (
                    <Box sx={{ p: 5, display: "flex", justifyContent: "center" }}>
                        <CircularProgress />
                    </Box>
                ) : !data ? (
                    <Alert severity="error">{t("billing_history_load_error", "Could not load billing history.")}</Alert>
                ) : (
                    <Stack spacing={3}>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: "action.hover", borderLeft: "5px solid #002F6C" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                                <Box>
                                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                                        {t("active_saas_tier", "Active SaaS Tier")}
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
                                        {data.current_plan.replace(/_/g, " ")} ({data.billing_cycle})
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                                    <Chip
                                        label={data.subscription_status}
                                        color={data.subscription_status === "ACTIVE" ? "success" : "warning"}
                                        sx={{ fontWeight: 900 }}
                                    />
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<AddCircleIcon />}
                                        onClick={() => setShowRecordForm(!showRecordForm)}
                                        sx={{ fontWeight: 800, bgcolor: "#2e7d32", textTransform: "none" }}
                                    >
                                        {showRecordForm ? t("cancel_entry_btn", "Cancel Entry") : t("record_sepa_payment_btn", "Record SEPA Payment")}
                                    </Button>
                                </Stack>
                            </Box>
                        </Paper>

                        {showRecordForm && (
                            <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, bgcolor: "background.default", border: "1.5px solid #2e7d32" }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "#2e7d32", mb: 1.5 }}>
                                    💰 {t("manual_sepa_title", "Record Manual SEPA Bank Transfer & Activate License")}
                                </Typography>
                                {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
                                <Box component="form" onSubmit={handleRecordPayment}>
                                    <Stack spacing={2}>
                                        <TextField
                                            fullWidth
                                            required
                                            type="number"
                                            size="small"
                                            label={t("amount_received_label", "Amount Received (€)")}
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="490.00"
                                        />
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={t("viitenumero_ref_label", "Finnish Viitenumero / Reference Number (Optional)")}
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder="e.g. 1000543"
                                        />
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={t("reconciliation_notes_label", "Reconciliation Notes / Bank Statement ID (Optional)")}
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="e.g. Nordea Bank transfer on 14.11.2026"
                                        />
                                        <Button type="submit" variant="contained" color="success" sx={{ fontWeight: 900, py: 1 }}>
                                            {t("confirm_activate_license_btn", "Confirm Payment & Activate License")}
                                        </Button>
                                    </Stack>
                                </Box>
                            </Paper>
                        )}

                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, textTransform: "uppercase", color: "text.secondary" }}>
                                {t("audit_trail_heading", "Official Transaction Audit Trail")} ({data.payment_history.length})
                            </Typography>
                            {data.payment_history.length === 0 ? (
                                <Paper sx={{ p: 4, textAlign: "center", borderRadius: 3 }}>
                                    <Typography color="text.secondary" variant="body2">
                                        {t("no_payment_records_found", "No payment records found for this club workspace.")}
                                    </Typography>
                                </Paper>
                            ) : (
                                <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 3 }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: "#002F6C" }}>
                                            <TableRow>
                                                <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_datetime_utc", "Date & Time (UTC)")}</TableCell>
                                                <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_reference_viitenumero", "Reference / Viitenumero")}</TableCell>
                                                <TableCell sx={{ color: "white", fontWeight: 800 }}>{t("col_reconciliation_notes", "Reconciliation Notes")}</TableCell>
                                                <TableCell align="right" sx={{ color: "white", fontWeight: 800 }}>{t("col_amount_eur", "Amount (€)")}</TableCell>
                                                <TableCell align="center" sx={{ color: "white", fontWeight: 800 }}>{t("col_status", "Status")}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.payment_history.map((tx) => (
                                                <TableRow key={tx.id} hover>
                                                    <TableCell sx={{ fontWeight: 700 }}>{new Date(tx.paid_at).toLocaleString()}</TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 800 }}>{tx.reference_number}</TableCell>
                                                    <TableCell sx={{ color: "text.secondary" }}>{tx.notes}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 900, color: "success.main" }}>€{tx.amount_eur.toFixed(2)}</TableCell>
                                                    <TableCell align="center">
                                                        <Chip icon={<CheckCircleIcon />} label={tx.status} color="success" size="small" sx={{ fontWeight: 800 }} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Box>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button variant="contained" onClick={onClose} sx={{ fontWeight: 800, borderRadius: 2.5 }}>
                    {t("close_audit_log_btn", "Close Audit Log")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};