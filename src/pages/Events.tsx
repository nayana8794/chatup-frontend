// chatup/frontend/src/pages/Events.tsx
import React, { useState, useEffect } from "react";
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
    FormControlLabel,
    Checkbox,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import VideoCameraFrontIcon from "@mui/icons-material/VideoCameraFront";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpIcon from "@mui/icons-material/Help";
import CancelIcon from "@mui/icons-material/Cancel";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import LockClockIcon from "@mui/icons-material/LockClock";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";

interface EventItem {
    id: string;
    title: string;
    description?: string;
    event_type: "REGULAR_MEETING" | "BOARD_MEETING" | "CHARITY_PROJECT" | "SOCIAL_EVENT";
    start_time: string;
    end_time?: string;
    location: string;
    is_online: boolean;
    meeting_link?: string;
    planner_name?: string;
    going_count: number;
    maybe_count: number;
    declined_count: number;
    my_rsvp?: "GOING" | "MAYBE" | "DECLINED";
}

interface Attendee {
    user_id: string;
    full_name: string;
    role: string;
    status: "GOING" | "MAYBE" | "DECLINED";
}

// Timezone-safe UTC Date parser
const parseEventDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    return new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
};

export const Events: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const canManage = [
        "SUPER_ADMIN",
        "PRESIDENT",
        "VICE_PRESIDENT",
        "PLANNER",
        "VICE_PLANNER",
    ].includes(user?.role || "");

    const [events, setEvents] = useState<EventItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"UPCOMING" | "PAST">("UPCOMING");

    // Create / Edit Event Dialog states
    const [openDialog, setOpenDialog] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventType, setEventType] = useState<EventItem["event_type"]>("REGULAR_MEETING");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [location, setLocation] = useState("");
    const [isOnline, setIsOnline] = useState(false);
    const [meetingLink, setMeetingLink] = useState("");

    // Attendees Modal states
    const [attendeesModalOpen, setAttendeesModalOpen] = useState(false);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [selectedEventTitle, setSelectedEventTitle] = useState("");

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/events");
            setEvents(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    // Real-time Event Auto-Sync
    useEffect(() => {
        if (
            lastEvent?.type === "EVENT_CREATED" ||
            lastEvent?.type === "EVENT_UPDATED" ||
            lastEvent?.type === "RSVP_UPDATED" ||
            lastEvent?.type === "EVENT_DELETED"
        ) {
            fetchEvents();
        }
    }, [lastEvent]);

    const handleRSVP = async (eventId: string, status: "GOING" | "MAYBE" | "DECLINED") => {
        try {
            await apiClient.post(`/events/${eventId}/rsvp`, { status });
            fetchEvents();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error setting RSVP");
        }
    };

    const handleOpenCreateDialog = () => {
        setEditingEventId(null);
        setTitle("");
        setDescription("");
        setEventType("REGULAR_MEETING");
        setStartTime("");
        setEndTime("");
        setLocation("");
        setIsOnline(false);
        setMeetingLink("");
        setOpenDialog(true);
    };

    const handleOpenEditDialog = (ev: EventItem) => {
        setEditingEventId(ev.id);
        setTitle(ev.title);
        setDescription(ev.description || "");
        setEventType(ev.event_type);

        // Format to YYYY-MM-DDTHH:mm for datetime-local input
        const sDate = parseEventDate(ev.start_time);
        const localS = new Date(sDate.getTime() - sDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setStartTime(localS);

        if (ev.end_time) {
            const eDate = parseEventDate(ev.end_time);
            const localE = new Date(eDate.getTime() - eDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            setEndTime(localE);
        } else {
            setEndTime("");
        }

        setLocation(ev.location);
        setIsOnline(ev.is_online);
        setMeetingLink(ev.meeting_link || "");
        setOpenDialog(true);
    };

    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !startTime) return;

        try {
            const payload = {
                title,
                description,
                event_type: eventType,
                start_time: new Date(startTime).toISOString(),
                end_time: endTime ? new Date(endTime).toISOString() : null,
                location: isOnline && !location.trim() ? "Online / Virtual Meeting" : location,
                is_online: isOnline,
                meeting_link: isOnline ? meetingLink : null,
            };

            if (editingEventId) {
                // Point 2: Update existing event
                await apiClient.put(`/events/${editingEventId}`, payload);
            } else {
                // Create new event
                await apiClient.post("/events", payload);
            }

            setOpenDialog(false);
            fetchEvents();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error saving event");
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!window.confirm("Are you sure you want to delete this event?")) return;
        try {
            await apiClient.delete(`/events/${eventId}`);
            fetchEvents();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error deleting event");
        }
    };

    const handleOpenAttendees = async (event: EventItem) => {
        try {
            setSelectedEventTitle(event.title);
            const res = await apiClient.get(`/events/${event.id}/attendees`);
            setAttendees(res.data);
            setAttendeesModalOpen(true);
        } catch (err) {
            console.error(err);
        }
    };

    // Filter Upcoming vs Past using UTC safe dates
    const now = new Date();
    const displayedEvents = events.filter((ev) => {
        const evDate = parseEventDate(ev.start_time);
        return tab === "UPCOMING" ? evDate >= now : evDate < now;
    });

    const getEventTypeColor = (type: EventItem["event_type"]) => {
        switch (type) {
            case "REGULAR_MEETING":
                return "#002F6C"; // Lions Navy
            case "BOARD_MEETING":
                return "#C2185B"; // Crimson
            case "CHARITY_PROJECT":
                return "#2E7D32"; // Green
            case "SOCIAL_EVENT":
                return "#E65100"; // Gold / Orange
            default:
                return "#1976D2";
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
            {/* Header Bar */}
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
                    📅 {t("events_title")}
                </Typography>

                {canManage && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleOpenCreateDialog}
                        sx={{ fontWeight: "bold", minHeight: 48 }}
                    >
                        {t("schedule_event_btn")}
                    </Button>
                )}
            </Stack>

            <Tabs
                value={tab}
                onChange={(_, val) => setTab(val)}
                sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
            >
                <Tab label={t("upcoming_events_tab")} value="UPCOMING" sx={{ fontWeight: 800, fontSize: "1rem" }} />
                <Tab label={t("past_events_tab")} value="PAST" sx={{ fontWeight: 800, fontSize: "1rem" }} />
            </Tabs>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : displayedEvents.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
                    <Typography color="text.secondary" variant="h6">
                        {t("no_events_found")}
                    </Typography>
                </Paper>
            ) : (
                <Stack spacing={3}>
                    {displayedEvents.map((ev) => {
                        const dateObj = parseEventDate(ev.start_time);
                        const isPassed = dateObj < now; // Point 1: ආරම්භ වූ / පසු වූ Event එකක්දැයි බැලීම

                        const monthStr = dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
                        const dayStr = dateObj.getDate();
                        const weekdayStr = dateObj.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
                        const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                        return (
                            <Card
                                key={ev.id}
                                elevation={3}
                                sx={{
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    borderLeft: "6px solid",
                                    borderLeftColor: isPassed ? "grey.500" : getEventTypeColor(ev.event_type),
                                    opacity: isPassed ? 0.85 : 1,
                                    transition: "transform 0.2s, box-shadow 0.2s",
                                    "&:hover": { transform: "translateY(-3px)", boxShadow: 6 },
                                }}
                            >
                                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: { xs: "column", sm: "row" },
                                            gap: 2.5,
                                            alignItems: { xs: "stretch", sm: "flex-start" },
                                        }}
                                    >
                                        {/* Calendar Badge */}
                                        <Paper
                                            elevation={2}
                                            sx={{
                                                width: { xs: "100%", sm: 90 },
                                                height: { xs: 65, sm: 95 },
                                                borderRadius: 3,
                                                bgcolor: isPassed ? "grey.600" : getEventTypeColor(ev.event_type),
                                                color: "white",
                                                display: "flex",
                                                flexDirection: { xs: "row", sm: "column" },
                                                justifyContent: "center",
                                                alignItems: "center",
                                                gap: { xs: 1.5, sm: 0 },
                                                p: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 1 }}>
                                                {weekdayStr}
                                            </Typography>
                                            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                                                {dayStr}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                                {monthStr}
                                            </Typography>
                                        </Paper>

                                        {/* Event Details */}
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
                                                <Chip
                                                    label={ev.event_type.replace("_", " ")}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: isPassed ? "grey.600" : getEventTypeColor(ev.event_type),
                                                        color: "white",
                                                        fontWeight: 800,
                                                        fontSize: "0.75rem",
                                                    }}
                                                />

                                                {isPassed && (
                                                    <Chip
                                                        icon={<LockClockIcon sx={{ color: "white !important" }} />}
                                                        label="Event Started / Past"
                                                        size="small"
                                                        color="default"
                                                        sx={{ fontWeight: 800, bgcolor: "grey.700", color: "white" }}
                                                    />
                                                )}

                                                {ev.is_online && (
                                                    <Chip
                                                        icon={<VideoCameraFrontIcon sx={{ color: "white !important" }} />}
                                                        label="Virtual Meeting"
                                                        size="small"
                                                        color="info"
                                                        sx={{ fontWeight: 800, fontSize: "0.75rem" }}
                                                    />
                                                )}
                                            </Box>

                                            <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", mb: 1 }}>
                                                {ev.title}
                                            </Typography>

                                            {ev.description && (
                                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                                                    {ev.description}
                                                </Typography>
                                            )}

                                            <Stack spacing={1} sx={{ mb: 2 }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                                                    <AccessTimeIcon fontSize="small" color="primary" />
                                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                        {timeStr}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
                                                    <LocationOnIcon fontSize="small" color="error" />
                                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                        {ev.location}
                                                    </Typography>
                                                </Box>

                                                {ev.is_online && ev.meeting_link && !isPassed && (
                                                    <Box sx={{ mt: 1 }}>
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            startIcon={<VideoCameraFrontIcon />}
                                                            href={ev.meeting_link}
                                                            target="_blank"
                                                            sx={{ fontWeight: 800, borderRadius: 2 }}
                                                        >
                                                            Join Video Meeting
                                                        </Button>
                                                    </Box>
                                                )}
                                            </Stack>

                                            <Divider sx={{ my: 2 }} />

                                            {/* RSVP Buttons & Counters */}
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: { xs: "column", md: "row" },
                                                    justifyContent: "space-between",
                                                    alignItems: { xs: "stretch", md: "center" },
                                                    gap: 2,
                                                }}
                                            >
                                                <Box
                                                    sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
                                                    onClick={() => handleOpenAttendees(ev)}
                                                >
                                                    <PeopleAltIcon color="action" />
                                                    <Chip label={`${ev.going_count} Going`} color="success" size="small" sx={{ fontWeight: 800 }} />
                                                    <Chip label={`${ev.maybe_count} Maybe`} color="warning" size="small" sx={{ fontWeight: 800 }} />
                                                    <Chip label={`${ev.declined_count} Can't`} color="error" size="small" sx={{ fontWeight: 800 }} />
                                                </Box>

                                                {/* Point 1: Event එක ආරම්භ වී ඇත්නම් RSVP Buttons disable වේ */}
                                                {!isPassed ? (
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            variant={ev.my_rsvp === "GOING" ? "contained" : "outlined"}
                                                            color="success"
                                                            startIcon={<CheckCircleIcon />}
                                                            onClick={() => handleRSVP(ev.id, "GOING")}
                                                            sx={{ minHeight: 44, fontWeight: 800, flex: 1 }}
                                                        >
                                                            {t("rsvp_going")}
                                                        </Button>
                                                        <Button
                                                            variant={ev.my_rsvp === "MAYBE" ? "contained" : "outlined"}
                                                            color="warning"
                                                            startIcon={<HelpIcon />}
                                                            onClick={() => handleRSVP(ev.id, "MAYBE")}
                                                            sx={{ minHeight: 44, fontWeight: 800, flex: 1 }}
                                                        >
                                                            {t("rsvp_maybe")}
                                                        </Button>
                                                        <Button
                                                            variant={ev.my_rsvp === "DECLINED" ? "contained" : "outlined"}
                                                            color="error"
                                                            startIcon={<CancelIcon />}
                                                            onClick={() => handleRSVP(ev.id, "DECLINED")}
                                                            sx={{ minHeight: 44, fontWeight: 800, flex: 1 }}
                                                        >
                                                            {t("rsvp_declined")}
                                                        </Button>
                                                    </Stack>
                                                ) : (
                                                    <Chip label="RSVP Closed (Event Started)" color="default" sx={{ fontWeight: 700 }} />
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Point 2: Edit & Delete Actions for Authorized Managers */}
                                        {canManage && (
                                            <Stack direction="row" spacing={0.5} sx={{ alignSelf: { xs: "flex-end", sm: "flex-start" } }}>
                                                {/* Point 1: ආරම්භ නොවූ Events සඳහා පමණක් Edit කිරීමට අවසර දේ */}
                                                {!isPassed && (
                                                    <Tooltip title="Edit Event">
                                                        <IconButton color="primary" onClick={() => handleOpenEditDialog(ev)}>
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Delete Event">
                                                    <IconButton color="error" onClick={() => handleDeleteEvent(ev.id)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            )}

            {/* ================= MODAL: CREATE / EDIT EVENT ================= */}
            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {editingEventId ? "✏️ Edit Event" : `➕ ${t("schedule_event_btn")}`}
                </DialogTitle>
                <Box component="form" onSubmit={handleSaveEvent}>
                    <DialogContent>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label={t("event_title_label")}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. October Monthly Meeting"
                            />

                            <TextField
                                fullWidth
                                select
                                label={t("event_type_label")}
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value as any)}
                            >
                                <MenuItem value="REGULAR_MEETING">Regular Meeting</MenuItem>
                                <MenuItem value="BOARD_MEETING">Board Meeting</MenuItem>
                                <MenuItem value="CHARITY_PROJECT">Charity / Service Project</MenuItem>
                                <MenuItem value="SOCIAL_EVENT">Social Gathering / Gala</MenuItem>
                            </TextField>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <TextField
                                    fullWidth
                                    required
                                    type="datetime-local"
                                    label={t("start_time_label")}
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <TextField
                                    fullWidth
                                    type="datetime-local"
                                    label={t("end_time_label")}
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                            </Stack>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={isOnline}
                                        onChange={(e) => setIsOnline(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label={t("online_event_checkbox")}
                            />

                            {isOnline ? (
                                <TextField
                                    fullWidth
                                    label={t("meeting_link_label")}
                                    value={meetingLink}
                                    onChange={(e) => setMeetingLink(e.target.value)}
                                    placeholder="https://zoom.us/j/... or Meet link"
                                />
                            ) : (
                                <TextField
                                    fullWidth
                                    required={!isOnline}
                                    label={t("location_label")}
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Club House, Mannerheimintie 10"
                                />
                            )}

                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label={t("description_label")}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Details, dress code, guest speakers..."
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2.5 }}>
                        <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 800, minHeight: 44 }}>
                            {editingEventId ? "Save Changes" : "Schedule Event"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Attendees List Modal */}
            <Dialog
                open={attendeesModalOpen}
                onClose={() => setAttendeesModalOpen(false)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>👥 {selectedEventTitle}</DialogTitle>
                <DialogContent sx={{ p: 1 }}>
                    {attendees.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                            No responses recorded yet.
                        </Typography>
                    ) : (
                        <List>
                            {attendees.map((att) => (
                                <ListItem key={att.user_id} sx={{ borderRadius: 2 }}>
                                    <ListItemIcon>
                                        <PersonIcon color="primary" />
                                    </ListItemIcon>
                                    <ListItemText primary={att.full_name} secondary={att.role} />
                                    <Chip
                                        label={att.status}
                                        size="small"
                                        color={
                                            att.status === "GOING"
                                                ? "success"
                                                : att.status === "MAYBE"
                                                    ? "warning"
                                                    : "error"
                                        }
                                        sx={{ fontWeight: 800 }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setAttendeesModalOpen(false)} fullWidth variant="contained">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};