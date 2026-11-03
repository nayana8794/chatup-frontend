// chatup/frontend/src/pages/MeetingMinutes.tsx
import React, { useState, useEffect, useRef } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Card,
    CardActionArea,
    Chip,
    IconButton,
    TextField,
    Tabs,
    Tab,
    Stack,
    Divider,
    CircularProgress,
    Tooltip,
    ButtonGroup,
    Alert,
    CardContent,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import SaveIcon from "@mui/icons-material/Save";
import PublishIcon from "@mui/icons-material/Publish";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";
import { useRealtime } from "../context/useRealtime";

interface Minute {
    id: string;
    title: string;
    meeting_date: string;
    location?: string;
    attendees?: string;
    content: string;
    status: "DRAFT" | "PUBLISHED";
    author_name?: string;
    created_at: string;
}

interface FinancialSheet {
    id: string;
    title: string;
    fiscal_year: string;
    sheet_type: string;
    status: "DRAFT" | "SUBMITTED" | "PUBLISHED" | "VOIDED";
    grid_data: { rows: Array<{ category: string; description: string; type: string; amount: any }> };
    total_income: number;
    total_expense: number;
    net_balance: number;
    is_deleted?: boolean;
    creator_name: string;
    approver_name?: string;
    created_at: string;
}

interface LockHolder {
    user_id: string;
    user_name: string;
    user_role: string;
}

export const MeetingMinutes: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const canEdit = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "VICE_SECRETARY",
    ].includes(user?.role || "");

    const isPresidentOrSuperAdmin = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");

    const [mainTab, setMainTab] = useState<"MINUTES" | "FINANCIAL_REPORTS">("MINUTES");
    const [view, setView] = useState<"list" | "editor" | "reader">("list");
    const [tab, setTab] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

    const [minutes, setMinutes] = useState<Minute[]>([]);
    const [financialSheets, setFinancialSheets] = useState<FinancialSheet[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [activeMinuteId, setActiveMinuteId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
    const [location, setLocation] = useState("");
    const [attendees, setAttendees] = useState("");
    const editorRef = useRef<HTMLDivElement>(null);

    // Lock states
    const [isLockedByOther, setIsLockedByOther] = useState(false);
    const [lockHolder, setLockHolder] = useState<LockHolder | null>(null);
    const heartbeatTimerRef = useRef<any>(null);

    const [selectedMinute, setSelectedMinute] = useState<Minute | null>(null);
    const [selectedFinancialSheet, setSelectedFinancialSheet] = useState<FinancialSheet | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [momRes, sheetRes] = await Promise.all([
                apiClient.get("/mom"),
                apiClient.get("/financial-sheets").catch(() => ({ data: [] })),
            ]);
            setMinutes(momRes.data);
            const publishedSheets = sheetRes.data.filter((s: FinancialSheet) => s.status === "PUBLISHED" && !s.is_deleted);
            setFinancialSheets(publishedSheets);
            if (publishedSheets.length > 0 && !selectedFinancialSheet) {
                setSelectedFinancialSheet(publishedSheets[0]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Real-time Event Listener
    useEffect(() => {
        if (!lastEvent) return;

        if (
            lastEvent.type === "MOM_PUBLISHED" ||
            lastEvent.type === "MOM_SAVED" ||
            lastEvent.type === "MOM_DELETED" ||
            lastEvent.type === "FINANCIAL_SHEET_APPROVED" ||
            lastEvent.type === "FINANCIAL_SHEET_VOIDED"
        ) {
            fetchData();
            if (lastEvent.type === "MOM_DELETED" && selectedMinute?.id === lastEvent.minute_id) {
                setSelectedMinute(null);
                setView("list");
            }
        }

        if (lastEvent.type === "MOM_LOCK_ACQUIRED" && lastEvent.minute_id === activeMinuteId) {
            const isMe = String(lastEvent.user_id).toLowerCase() === String(user?.user_id).toLowerCase();
            if (!isMe) {
                setIsLockedByOther(true);
                setLockHolder({
                    user_id: lastEvent.user_id,
                    user_name: lastEvent.user_name,
                    user_role: lastEvent.user_role,
                });
            }
        }

        if (lastEvent.type === "MOM_LOCK_RELEASED" && lastEvent.minute_id === activeMinuteId) {
            setIsLockedByOther(false);
            setLockHolder(null);
        }
    }, [lastEvent, activeMinuteId, selectedMinute, user]);

    useEffect(() => {
        return () => {
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            if (activeMinuteId) {
                apiClient.post(`/mom/${activeMinuteId}/unlock`).catch(() => { });
            }
        };
    }, [activeMinuteId]);

    const executeCommand = (command: string, value: string | undefined = undefined) => {
        if (isLockedByOther) return;
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const handleOpenEditor = async (minute?: Minute, forceTakeover: boolean = false) => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

        if (minute) {
            setActiveMinuteId(minute.id);
            setTitle(minute.title);
            setMeetingDate(minute.meeting_date.slice(0, 10));
            setLocation(minute.location || "");
            setAttendees(minute.attendees || "");

            try {
                const res = await apiClient.post(`/mom/${minute.id}/lock?force=${forceTakeover}`);
                if (res.data.is_locked_by_other) {
                    setIsLockedByOther(true);
                    setLockHolder(res.data.lock_holder);
                } else {
                    setIsLockedByOther(false);
                    setLockHolder(null);
                    heartbeatTimerRef.current = setInterval(() => {
                        apiClient.post(`/mom/${minute.id}/heartbeat`).catch(() => { });
                    }, 20000);
                }
            } catch (err) {
                console.error(err);
            }

            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.innerHTML = minute.content;
                }
            }, 50);
        } else {
            setActiveMinuteId(null);
            setIsLockedByOther(false);
            setLockHolder(null);
            setTitle("");
            setMeetingDate(new Date().toISOString().slice(0, 10));
            setLocation("");
            setAttendees("");
            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.innerHTML = "<p>Meeting called to order. Agenda items discussed...</p>";
                }
            }, 50);
        }
        setView("editor");
    };

    const handleCloseEditor = async () => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (activeMinuteId) {
            await apiClient.post(`/mom/${activeMinuteId}/unlock`).catch(() => { });
        }
        setActiveMinuteId(null);
        setIsLockedByOther(false);
        setLockHolder(null);
        setView("list");
    };

    const handleOpenReader = (minute: Minute) => {
        setSelectedMinute(minute);
        setView("reader");
    };

    const handleSave = async (statusToSave: "DRAFT" | "PUBLISHED") => {
        if (isLockedByOther) {
            alert("Cannot save: document is locked by another user.");
            return;
        }

        const contentHtml = editorRef.current?.innerHTML || "";
        if (!title.trim()) {
            alert("Please provide a meeting title / agenda.");
            return;
        }

        try {
            if (activeMinuteId) {
                await apiClient.put(`/mom/${activeMinuteId}`, {
                    title,
                    meeting_date: new Date(meetingDate).toISOString(),
                    location,
                    attendees,
                    content: contentHtml,
                    status: statusToSave,
                });
            } else {
                await apiClient.post("/mom", {
                    title,
                    meeting_date: new Date(meetingDate).toISOString(),
                    location,
                    attendees,
                    content: contentHtml,
                    status: statusToSave,
                });
            }

            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            setActiveMinuteId(null);
            fetchData();
            setView("list");
            alert(
                statusToSave === "PUBLISHED"
                    ? "Official minutes published to archive!"
                    : "Draft saved successfully!"
            );
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error saving minutes.");
        }
    };

    const handleDelete = async (minuteId: string) => {
        if (!window.confirm("Are you sure you want to delete this document?")) return;
        try {
            await apiClient.delete(`/mom/${minuteId}`);
            fetchData();
            setView("list");
        } catch (err) {
            console.error(err);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportFinancialExcel = async (sheetId: string, titleStr: string) => {
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
            a.download = `${titleStr.replace(" ", "_")}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            alert("Failed to export Excel file");
        }
    };

    const displayedMinutes = minutes.filter((m) =>
        canEdit ? m.status === tab : m.status === "PUBLISHED"
    );

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            {/* Top Main Navigation Tabs (Minutes vs Official Financial Reports) */}
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
                    sx={{ fontWeight: 800, minHeight: 48, borderRadius: 2.5 }}
                >
                    {t("back_to_dashboard", "Back to Dashboard")}
                </Button>

                <Typography variant="h5" sx={{ fontWeight: 900, textAlign: "center", color: "primary.main" }}>
                    📜 {t("mom_title", "Meeting Minutes & Document Archive")}
                </Typography>

                {canEdit && view === "list" ? (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenEditor()}
                        sx={{ fontWeight: 800, minHeight: 48, borderRadius: 2.5 }}
                    >
                        {t("new_minute", "Write New Minutes")}
                    </Button>
                ) : (
                    <Box sx={{ width: { xs: 0, sm: 160 }, display: { xs: "none", sm: "block" } }} />
                )}
            </Stack>

            {view === "list" && (
                <Tabs
                    value={mainTab}
                    onChange={(_, val) => setMainTab(val)}
                    variant="fullWidth"
                    sx={{ mb: 3, borderBottom: 2, borderColor: "divider" }}
                >
                    <Tab label={t("all_minutes", "Meeting Minutes Archive")} value="MINUTES" sx={{ fontWeight: 800, fontSize: "1rem" }} />
                    <Tab icon={<AssessmentIcon />} iconPosition="start" label={t("financial_reports_title", "Official Financial Reports")} value="FINANCIAL_REPORTS" sx={{ fontWeight: 800, fontSize: "1rem", color: "success.main" }} />
                </Tabs>
            )}

            {/* ================= SECTION A: FINANCIAL REPORTS VIEWER ================= */}
            {view === "list" && mainTab === "FINANCIAL_REPORTS" && (
                <Box>
                    {financialSheets.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
                            {financialSheets.map((s) => (
                                <Chip
                                    key={s.id}
                                    icon={<AssessmentIcon />}
                                    label={`${s.title} (${s.fiscal_year})`}
                                    onClick={() => setSelectedFinancialSheet(s)}
                                    color={selectedFinancialSheet?.id === s.id ? "primary" : "default"}
                                    variant={selectedFinancialSheet?.id === s.id ? "filled" : "outlined"}
                                    sx={{ fontWeight: 800, py: 2, px: 1, borderRadius: 2.5 }}
                                />
                            ))}
                        </Box>
                    )}

                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                            <CircularProgress size={50} />
                        </Box>
                    ) : selectedFinancialSheet ? (
                        <Card elevation={3} sx={{ borderRadius: 3.5, borderLeft: "6px solid #2E7D32" }}>
                            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                            {selectedFinancialSheet.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            Fiscal Period: <b>{selectedFinancialSheet.fiscal_year}</b> • Certified & Published by: {selectedFinancialSheet.approver_name || selectedFinancialSheet.creator_name}
                                        </Typography>
                                    </Box>

                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                        <Chip label="CERTIFIED & PUBLISHED" color="success" sx={{ fontWeight: 800 }} />
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<FileDownloadIcon />}
                                            onClick={() => handleExportFinancialExcel(selectedFinancialSheet.id, selectedFinancialSheet.title)}
                                            sx={{ fontWeight: 800, textTransform: "none", borderRadius: 2 }}
                                        >
                                            {t("btn_export_xlsx", "Export .xlsx")}
                                        </Button>
                                    </Stack>
                                </Box>

                                <Box sx={{ overflowX: "auto" }}>
                                    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                                        <Box component="thead" sx={{ bgcolor: "#002F6C", color: "white" }}>
                                            <Box component="tr">
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>#</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>Category / Cost Center</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>Description</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "left", fontWeight: 800 }}>Type</Box>
                                                <Box component="th" sx={{ p: 1.2, textAlign: "right", fontWeight: 800 }}>Amount (€)</Box>
                                            </Box>
                                        </Box>
                                        <Box component="tbody">
                                            {selectedFinancialSheet.grid_data?.rows?.map((row, idx) => (
                                                <Box component="tr" key={idx} sx={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                                                    <Box component="td" sx={{ p: 1.2, fontWeight: 700, color: "text.secondary" }}>{idx + 1}</Box>
                                                    <Box component="td" sx={{ p: 1.2, fontWeight: 700 }}>{row.category}</Box>
                                                    <Box component="td" sx={{ p: 1.2 }}>{row.description}</Box>
                                                    <Box component="td" sx={{ p: 1.2 }}>
                                                        <Chip
                                                            label={row.type}
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
                                            <Box component="tr" sx={{ bgcolor: "action.hover" }}>
                                                <Box component="td" colSpan={3} sx={{ p: 1.5, fontWeight: 900, color: "#002F6C" }}>
                                                    CERTIFIED NET TREASURY BALANCE
                                                </Box>
                                                <Box component="td" sx={{ p: 1.5, fontWeight: 800, color: "text.secondary", fontSize: "0.85rem" }}>
                                                    +€{selectedFinancialSheet.total_income.toFixed(2)} / -€{selectedFinancialSheet.total_expense.toFixed(2)}
                                                </Box>
                                                <Box component="td" sx={{ p: 1.5, textAlign: "right", fontWeight: 900, fontSize: "1.1rem", color: selectedFinancialSheet.net_balance >= 0 ? "success.main" : "error.main" }}>
                                                    €{selectedFinancialSheet.net_balance.toFixed(2)}
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    ) : (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3.5 }}>
                            <AssessmentIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>No Published Financial Reports</Typography>
                            <Typography variant="body2" color="text.secondary">
                                The club treasurer and president have not yet published certified financial reports.
                            </Typography>
                        </Paper>
                    )}
                </Box>
            )}

            {/* ================= SECTION B: MEETING MINUTES VIEW ================= */}
            {view === "list" && mainTab === "MINUTES" && (
                <Box>
                    {canEdit && (
                        <Tabs
                            value={tab}
                            onChange={(_, val) => setTab(val)}
                            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
                        >
                            <Tab label={t("published_tab")} value="PUBLISHED" sx={{ fontWeight: "bold", fontSize: "1rem" }} />
                            <Tab label={t("drafts_tab")} value="DRAFT" sx={{ fontWeight: "bold", fontSize: "1rem" }} />
                        </Tabs>
                    )}

                    {loading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                            <CircularProgress size={50} />
                        </Box>
                    ) : displayedMinutes.length === 0 ? (
                        <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                            <Typography color="text.secondary" variant="h6">
                                {t("no_minutes_found")}
                            </Typography>
                        </Paper>
                    ) : (
                        <Stack spacing={2}>
                            {displayedMinutes.map((minute) => (
                                <Card
                                    key={minute.id}
                                    elevation={2}
                                    sx={{
                                        borderRadius: 3,
                                        borderLeft: "6px solid",
                                        borderLeftColor: minute.status === "PUBLISHED" ? "primary.main" : "warning.main",
                                        transition: "transform 0.15s, box-shadow 0.15s",
                                        "&:hover": { transform: "translateY(-2px)", boxShadow: 4 },
                                    }}
                                >
                                    <CardActionArea
                                        onClick={() =>
                                            canEdit && minute.status === "DRAFT"
                                                ? handleOpenEditor(minute)
                                                : handleOpenReader(minute)
                                        }
                                        sx={{ p: { xs: 2, sm: 2.5 } }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexDirection: { xs: "column", sm: "row" },
                                                justifyContent: "space-between",
                                                alignItems: { xs: "flex-start", sm: "center" },
                                                gap: 1,
                                                mb: 1,
                                            }}
                                        >
                                            <Typography variant="h6" sx={{ fontWeight: "bold", color: "text.primary" }}>
                                                📝 {minute.title}
                                            </Typography>
                                            <Chip
                                                label={minute.status === "PUBLISHED" ? "Official Archive" : "Draft"}
                                                color={minute.status === "PUBLISHED" ? "primary" : "warning"}
                                                size="small"
                                                sx={{ fontWeight: "bold" }}
                                            />
                                        </Box>

                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            spacing={{ xs: 1, sm: 3 }}
                                            sx={{ color: "text.secondary", mt: 1 }}
                                        >
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <CalendarMonthIcon fontSize="small" />
                                                <Typography variant="body2">
                                                    {new Date(minute.meeting_date).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                            {minute.location && (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <LocationOnIcon fontSize="small" />
                                                    <Typography variant="body2">{minute.location}</Typography>
                                                </Box>
                                            )}
                                            {minute.author_name && (
                                                <Typography variant="body2">Recorded by: {minute.author_name}</Typography>
                                            )}
                                        </Stack>
                                    </CardActionArea>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Box>
            )}

            {/* ================= VIEW 2: MS WORD-STYLE EDITOR VIEW ================= */}
            {view === "editor" && (
                <Box>
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
                            onClick={handleCloseEditor}
                            variant="outlined"
                            sx={{ fontWeight: "bold", minHeight: 48 }}
                        >
                            Cancel / Back
                        </Button>

                        <Typography variant="h6" sx={{ fontWeight: 800, textAlign: { xs: "center", sm: "left" } }}>
                            ✍️ MS Word Minutes Editor
                        </Typography>

                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                            <Button
                                variant="outlined"
                                color="warning"
                                startIcon={<SaveIcon />}
                                disabled={isLockedByOther}
                                onClick={() => handleSave("DRAFT")}
                                sx={{ fontWeight: "bold", minHeight: 48 }}
                            >
                                {t("save_draft")}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PublishIcon />}
                                disabled={isLockedByOther}
                                onClick={() => handleSave("PUBLISHED")}
                                sx={{ fontWeight: "bold", minHeight: 48 }}
                            >
                                {t("publish_minute")}
                            </Button>
                        </Stack>
                    </Stack>

                    {isLockedByOther && lockHolder && (
                        <Alert
                            severity="warning"
                            icon={<LockIcon fontSize="large" />}
                            action={
                                isPresidentOrSuperAdmin && (
                                    <Button
                                        color="inherit"
                                        size="small"
                                        variant="outlined"
                                        startIcon={<LockOpenIcon />}
                                        onClick={() => {
                                            const min = minutes.find((m) => m.id === activeMinuteId);
                                            if (min) handleOpenEditor(min, true);
                                        }}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        Take Over Lock
                                    </Button>
                                )
                            }
                            sx={{ mb: 3, borderRadius: 3, "& .MuiAlert-message": { fontSize: "1.05rem" } }}
                        >
                            <b>Document Locked:</b> Currently being edited by{" "}
                            <b>
                                {lockHolder.user_name} ({lockHolder.user_role})
                            </b>
                            . Opened in Read-Only mode to protect concurrent changes.
                        </Alert>
                    )}

                    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3 }}>
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                required
                                disabled={isLockedByOther}
                                label={t("meeting_title_label")}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Monthly General Meeting - October 2026"
                            />
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    disabled={isLockedByOther}
                                    label={t("meeting_date_label")}
                                    value={meetingDate}
                                    onChange={(e) => setMeetingDate(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <TextField
                                    fullWidth
                                    disabled={isLockedByOther}
                                    label={t("meeting_location_label")}
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Helsinki Club Hall / Virtual"
                                />
                            </Stack>
                            <TextField
                                fullWidth
                                disabled={isLockedByOther}
                                label={t("attendees_label")}
                                value={attendees}
                                onChange={(e) => setAttendees(e.target.value)}
                                placeholder="e.g. Matti Virtanen (President), Johan Lindqvist (Secretary), +24 members"
                            />
                        </Stack>
                    </Paper>

                    <Paper
                        elevation={3}
                        sx={{
                            p: 1.5,
                            mb: 2,
                            borderRadius: "12px 12px 0 0",
                            bgcolor: "grey.100",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 1,
                            alignItems: "center",
                            position: "sticky",
                            top: 70,
                            zIndex: 10,
                            opacity: isLockedByOther ? 0.5 : 1,
                            pointerEvents: isLockedByOther ? "none" : "auto",
                        }}
                    >
                        <ButtonGroup size="small" variant="contained">
                            <Tooltip title="Bold (Ctrl+B)">
                                <IconButton onClick={() => executeCommand("bold")}>
                                    <FormatBoldIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Italic (Ctrl+I)">
                                <IconButton onClick={() => executeCommand("italic")}>
                                    <FormatItalicIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Underline (Ctrl+U)">
                                <IconButton onClick={() => executeCommand("underline")}>
                                    <FormatUnderlinedIcon />
                                </IconButton>
                            </Tooltip>
                        </ButtonGroup>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => executeCommand("formatBlock", "<h1>")}
                            sx={{ fontWeight: "bold" }}
                        >
                            H1
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => executeCommand("formatBlock", "<h2>")}
                            sx={{ fontWeight: "bold" }}
                        >
                            H2
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => executeCommand("formatBlock", "<p>")}
                        >
                            Paragraph
                        </Button>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                        <ButtonGroup size="small">
                            <Tooltip title="Bullet List">
                                <IconButton onClick={() => executeCommand("insertUnorderedList")}>
                                    <FormatListBulletedIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Numbered List">
                                <IconButton onClick={() => executeCommand("insertOrderedList")}>
                                    <FormatListNumberedIcon />
                                </IconButton>
                            </Tooltip>
                        </ButtonGroup>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                        <ButtonGroup size="small">
                            <Tooltip title="Align Left">
                                <IconButton onClick={() => executeCommand("justifyLeft")}>
                                    <FormatAlignLeftIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Align Center">
                                <IconButton onClick={() => executeCommand("justifyCenter")}>
                                    <FormatAlignCenterIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Align Right">
                                <IconButton onClick={() => executeCommand("justifyRight")}>
                                    <FormatAlignRightIcon />
                                </IconButton>
                            </Tooltip>
                        </ButtonGroup>
                    </Paper>

                    <Paper
                        elevation={4}
                        sx={{
                            minHeight: 650,
                            p: { xs: 3, sm: 6 },
                            bgcolor: "background.paper",
                            borderRadius: "0 0 12px 12px",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                            maxWidth: 850,
                            mx: "auto",
                        }}
                    >
                        <Box sx={{ textAlign: "center", mb: 4, pb: 2, borderBottom: "2px solid #002F6C" }}>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                                🦁 LIONS CLUB OFFICIAL MINUTES
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {title || "Meeting Minutes"}
                            </Typography>
                        </Box>

                        <Box
                            ref={editorRef}
                            contentEditable={!isLockedByOther}
                            suppressContentEditableWarning
                            sx={{
                                minHeight: 450,
                                outline: "none",
                                fontSize: "1.15rem",
                                lineHeight: 1.8,
                                bgcolor: isLockedByOther ? "grey.50" : "transparent",
                                cursor: isLockedByOther ? "not-allowed" : "text",
                                "& h1": { fontSize: "1.8rem", color: "primary.main", my: 2 },
                                "& h2": { fontSize: "1.4rem", color: "text.primary", my: 1.5 },
                                "& p": { my: 1 },
                                "& ul, & ol": { pl: 4, my: 1 },
                            }}
                        />
                    </Paper>
                </Box>
            )}

            {/* ================= VIEW 3: OFFICIAL READER & PRINT VIEW ================= */}
            {view === "reader" && selectedMinute && (
                <Box>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        sx={{
                            justifyContent: "space-between",
                            alignItems: { xs: "stretch", sm: "center" },
                            mb: 3,
                            "@media print": { display: "none" },
                        }}
                    >
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={() => setView("list")}
                            variant="outlined"
                            sx={{ fontWeight: "bold", minHeight: 48 }}
                        >
                            Back to Archive
                        </Button>

                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                            {canEdit && (
                                <>
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<EditIcon />}
                                        onClick={() => handleOpenEditor(selectedMinute)}
                                        sx={{ fontWeight: "bold", minHeight: 48 }}
                                    >
                                        {t("edit_minute")}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDelete(selectedMinute.id)}
                                        sx={{ fontWeight: "bold", minHeight: 48 }}
                                    >
                                        Delete
                                    </Button>
                                </>
                            )}

                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PrintIcon />}
                                onClick={handlePrint}
                                sx={{ fontWeight: "bold", minHeight: 48 }}
                            >
                                {t("print_document")}
                            </Button>
                        </Stack>
                    </Stack>

                    <Paper
                        elevation={4}
                        sx={{
                            p: { xs: 3, sm: 6 },
                            maxWidth: 850,
                            mx: "auto",
                            borderRadius: 3,
                            minHeight: 800,
                            "@media print": {
                                boxShadow: "none",
                                p: 0,
                                maxWidth: "100%",
                            },
                        }}
                    >
                        <Box sx={{ textAlign: "center", mb: 4, pb: 2, borderBottom: "3px solid #002F6C" }}>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.main" }}>
                                🦁 LIONS CLUB OFFICIAL MEETING MINUTES
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                                {selectedMinute.title}
                            </Typography>
                        </Box>

                        <Paper elevation={0} sx={{ p: 2, bgcolor: "grey.100", borderRadius: 2, mb: 4 }}>
                            <Stack spacing={1}>
                                <Typography variant="body1">
                                    <b>Date:</b> {new Date(selectedMinute.meeting_date).toLocaleDateString()}
                                </Typography>
                                {selectedMinute.location && (
                                    <Typography variant="body1">
                                        <b>Location:</b> {selectedMinute.location}
                                    </Typography>
                                )}
                                {selectedMinute.attendees && (
                                    <Typography variant="body1">
                                        <b>Attendees:</b> {selectedMinute.attendees}
                                    </Typography>
                                )}
                                {selectedMinute.author_name && (
                                    <Typography variant="body2" color="text.secondary">
                                        <b>Minutes recorded by:</b> {selectedMinute.author_name}
                                    </Typography>
                                )}
                            </Stack>
                        </Paper>

                        <Box
                            dangerouslySetInnerHTML={{ __html: selectedMinute.content }}
                            sx={{
                                fontSize: "1.15rem",
                                lineHeight: 1.8,
                                "& h1": { fontSize: "1.7rem", color: "primary.main", my: 2 },
                                "& h2": { fontSize: "1.35rem", color: "text.primary", my: 1.5 },
                                "& p": { my: 1.2 },
                                "& ul, & ol": { pl: 4, my: 1 },
                            }}
                        />

                        <Box sx={{ mt: 8, pt: 4, borderTop: "1px dashed #ccc", display: "flex", justifyContent: "space-between" }}>
                            <Box sx={{ textAlign: "center" }}>
                                <Box sx={{ width: 180, borderBottom: "1px solid black", mb: 1 }} />
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>Club Secretary</Typography>
                            </Box>
                            <Box sx={{ textAlign: "center" }}>
                                <Box sx={{ width: 180, borderBottom: "1px solid black", mb: 1 }} />
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>Club President</Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
            )}
        </Container>
    );
};