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

export const MeetingMinutes: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    // Permissions: Secretary, President, VP, Super Admin can write/edit
    const canEdit = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "SECRETARY",
        "VICE_SECRETARY",
    ].includes(user?.role || "");

    // Views: "list" | "editor" | "reader"
    const [view, setView] = useState<"list" | "editor" | "reader">("list");
    const [tab, setTab] = useState<"PUBLISHED" | "DRAFT">("PUBLISHED");

    const [minutes, setMinutes] = useState<Minute[]>([]);
    const [loading, setLoading] = useState(true);

    // Active / Editing Minute Form state
    const [activeMinuteId, setActiveMinuteId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
    const [location, setLocation] = useState("");
    const [attendees, setAttendees] = useState("");
    const editorRef = useRef<HTMLDivElement>(null);

    // Selected minute for reader
    const [selectedMinute, setSelectedMinute] = useState<Minute | null>(null);

    const fetchMinutes = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/mom");
            setMinutes(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMinutes();
    }, []);

    // Real-Time Auto-Sync: වෙනත් පරිශීලකයෙකු MOM එකක් Publish, Save හෝ Delete කළ විට පිටුව Refresh නොකර Live Sync වීම
    useEffect(() => {
        if (
            lastEvent?.type === "MOM_PUBLISHED" ||
            lastEvent?.type === "MOM_SAVED" ||
            lastEvent?.type === "MOM_DELETED"
        ) {
            fetchMinutes();

            // යම් හෙයකින් Reader එකේ විවෘත කරගෙන සිටි ලේඛනයක් delete වුවහොත් List view එකට මාරු කිරීම
            if (lastEvent.type === "MOM_DELETED" && selectedMinute?.id === lastEvent.minute_id) {
                setSelectedMinute(null);
                setView("list");
            }
        }
    }, [lastEvent, selectedMinute]);

    // Format command for Word-style ribbon toolbar
    const executeCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const handleOpenEditor = (minute?: Minute) => {
        if (minute) {
            setActiveMinuteId(minute.id);
            setTitle(minute.title);
            setMeetingDate(minute.meeting_date.slice(0, 10));
            setLocation(minute.location || "");
            setAttendees(minute.attendees || "");
            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.innerHTML = minute.content;
                }
            }, 50);
        } else {
            setActiveMinuteId(null);
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

    const handleOpenReader = (minute: Minute) => {
        setSelectedMinute(minute);
        setView("reader");
    };

    const handleSave = async (statusToSave: "DRAFT" | "PUBLISHED") => {
        const contentHtml = editorRef.current?.innerHTML || "";
        if (!title.trim()) {
            alert("Please provide a meeting title / agenda.");
            return;
        }

        try {
            if (activeMinuteId) {
                // Update
                await apiClient.put(`/mom/${activeMinuteId}`, {
                    title,
                    meeting_date: new Date(meetingDate).toISOString(),
                    location,
                    attendees,
                    content: contentHtml,
                    status: statusToSave,
                });
            } else {
                // Create
                await apiClient.post("/mom", {
                    title,
                    meeting_date: new Date(meetingDate).toISOString(),
                    location,
                    attendees,
                    content: contentHtml,
                    status: statusToSave,
                });
            }

            fetchMinutes();
            setView("list");
            alert(
                statusToSave === "PUBLISHED"
                    ? "Official minutes published to archive!"
                    : "Draft saved successfully!"
            );
        } catch (err) {
            console.error(err);
            alert("Error saving minutes.");
        }
    };

    const handleDelete = async (minuteId: string) => {
        if (!window.confirm("Are you sure you want to delete this document?")) return;
        try {
            await apiClient.delete(`/mom/${minuteId}`);
            fetchMinutes();
            setView("list");
        } catch (err) {
            console.error(err);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Filter minutes by tab
    const displayedMinutes = minutes.filter((m) =>
        canEdit ? m.status === tab : m.status === "PUBLISHED"
    );

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            {/* ================= VIEW 1: LIST / ARCHIVE VIEW ================= */}
            {view === "list" && (
                <Box>
                    {/* Top Bar */}
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
                            📜 {t("mom_title")}
                        </Typography>

                        {canEdit && (
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenEditor()}
                                sx={{ fontWeight: "bold", minHeight: 48 }}
                            >
                                {t("new_minute")}
                            </Button>
                        )}
                    </Stack>

                    {/* Secretary Filter Tabs (Drafts vs Official Archive) */}
                    {canEdit && (
                        <Tabs
                            value={tab}
                            onChange={(_, val) => setTab(val)}
                            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
                        >
                            <Tab
                                label={t("published_tab")}
                                value="PUBLISHED"
                                sx={{ fontWeight: "bold", fontSize: "1rem" }}
                            />
                            <Tab
                                label={t("drafts_tab")}
                                value="DRAFT"
                                sx={{ fontWeight: "bold", fontSize: "1rem" }}
                            />
                        </Tabs>
                    )}

                    {/* List of Documents */}
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
                    {/* Editor Header Bar */}
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
                            onClick={() => setView("list")}
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
                                onClick={() => handleSave("DRAFT")}
                                sx={{ fontWeight: "bold", minHeight: 48 }}
                            >
                                {t("save_draft")}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PublishIcon />}
                                onClick={() => handleSave("PUBLISHED")}
                                sx={{ fontWeight: "bold", minHeight: 48 }}
                            >
                                {t("publish_minute")}
                            </Button>
                        </Stack>
                    </Stack>

                    {/* Meeting Metadata Inputs */}
                    <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3 }}>
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                required
                                label={t("meeting_title_label")}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Monthly General Meeting - October 2026"
                            />
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label={t("meeting_date_label")}
                                    value={meetingDate}
                                    onChange={(e) => setMeetingDate(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <TextField
                                    fullWidth
                                    label={t("meeting_location_label")}
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Helsinki Club Hall / Virtual"
                                />
                            </Stack>
                            <TextField
                                fullWidth
                                label={t("attendees_label")}
                                value={attendees}
                                onChange={(e) => setAttendees(e.target.value)}
                                placeholder="e.g. Matti Virtanen (President), Johan Lindqvist (Secretary), +24 members"
                            />
                        </Stack>
                    </Paper>

                    {/* ================= MS WORD RIBBON TOOLBAR ================= */}
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
                        }}
                    >
                        {/* Text Styling */}
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

                        {/* Headings */}
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

                        {/* Lists */}
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

                        {/* Alignment */}
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

                    {/* ================= A4 PAPER DOCUMENT CANVAS ================= */}
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
                        {/* Lions Club Header Watermark */}
                        <Box sx={{ textAlign: "center", mb: 4, pb: 2, borderBottom: "2px solid #002F6C" }}>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                                🦁 LIONS CLUB OFFICIAL MINUTES
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {title || "Meeting Minutes"}
                            </Typography>
                        </Box>

                        {/* ContentEditable Native Word Canvas */}
                        <Box
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            sx={{
                                minHeight: 450,
                                outline: "none",
                                fontSize: "1.15rem", // Senior-Friendly 18px base text
                                lineHeight: 1.8,
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
                    {/* Reader Top Action Bar */}
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={2}
                        sx={{
                            justifyContent: "space-between",
                            alignItems: { xs: "stretch", sm: "center" },
                            mb: 3,
                            "@media print": { display: "none" }, // Hidden while printing
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

                    {/* Printable Official Document Canvas */}
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
                        {/* Official Letterhead */}
                        <Box sx={{ textAlign: "center", mb: 4, pb: 2, borderBottom: "3px solid #002F6C" }}>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.main" }}>
                                🦁 LIONS CLUB OFFICIAL MEETING MINUTES
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
                                {selectedMinute.title}
                            </Typography>
                        </Box>

                        {/* Meeting Information Block */}
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

                        {/* Document Content */}
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

                        {/* Signature Area */}
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