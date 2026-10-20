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
    RadioGroup,
    Radio,
    FormControl,
    FormLabel,
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
import DirectionsIcon from "@mui/icons-material/Directions";
import Diversity1Icon from "@mui/icons-material/Diversity1";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import RemoveIcon from "@mui/icons-material/Remove";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";
import { playNotificationChime } from "../utils/sound";

interface DutyShiftItem {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    max_volunteers?: number | null;
    assigned_count?: number;
}

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
    allows_guests: boolean;
    duty_shifts: DutyShiftItem[];
    going_count: number;
    maybe_count: number;
    declined_count: number;
    total_guests_count: number;
    my_rsvp?: "GOING" | "MAYBE" | "DECLINED";
    my_guest_count: number;
    my_duty_shift_id?: string | null;
}

interface Attendee {
    user_id: string;
    full_name: string;
    role: string;
    status: "GOING" | "MAYBE" | "DECLINED";
    guest_count: number;
    duty_shift_id?: string | null;
    duty_shift_title?: string | null;
}

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

    // Create / Edit Dialog States
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
    const [allowsGuests, setAllowsGuests] = useState(false);
    const [dutyShifts, setDutyShifts] = useState<DutyShiftItem[]>([]);

    // Shift input draft for planner
    const [shiftTitle, setShiftTitle] = useState("");
    const [shiftStart, setShiftStart] = useState("");
    const [shiftEnd, setShiftEnd] = useState("");
    const [shiftMaxVolunteers, setShiftMaxVolunteers] = useState<number | "">("");

    // RSVP Options Dialog States (Family & Shift selection)
    const [rsvpModalOpen, setRsvpModalOpen] = useState(false);
    const [activeRsvpEvent, setActiveRsvpEvent] = useState<EventItem | null>(null);
    const [selectedGuestCount, setSelectedGuestCount] = useState<number>(0);
    const [selectedDutyShiftId, setSelectedDutyShiftId] = useState<string>("");

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

    // Real-time Event Auto-Sync & Sound Chime
    useEffect(() => {
        if (
            lastEvent?.type === "EVENT_CREATED" ||
            lastEvent?.type === "EVENT_UPDATED" ||
            lastEvent?.type === "RSVP_UPDATED" ||
            lastEvent?.type === "EVENT_DELETED"
        ) {
            if (lastEvent?.type === "EVENT_CREATED") {
                playNotificationChime();
            }
            fetchEvents();
        }
    }, [lastEvent]);

    const handleRSVPAction = (ev: EventItem, status: "GOING" | "MAYBE" | "DECLINED") => {
        if (status === "GOING" && (ev.allows_guests || (ev.duty_shifts && ev.duty_shifts.length > 0))) {
            setActiveRsvpEvent(ev);
            setSelectedGuestCount(ev.my_guest_count || 0);
            setSelectedDutyShiftId(ev.my_duty_shift_id || "");
            setRsvpModalOpen(true);
        } else {
            submitRSVP(ev.id, status, 0, null);
        }
    };

    const submitRSVP = async (
        eventId: string,
        status: "GOING" | "MAYBE" | "DECLINED",
        guestCount: number,
        dutyShiftId: string | null
    ) => {
        try {
            await apiClient.post(`/events/${eventId}/rsvp`, {
                status,
                guest_count: guestCount,
                duty_shift_id: dutyShiftId || null,
            });
            setRsvpModalOpen(false);
            fetchEvents();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error submitting RSVP");
        }
    };

    const handleAddShiftRow = () => {
        if (!shiftTitle.trim() || !shiftStart || !shiftEnd) {
            alert("Please specify duty title, start time, and end time.");
            return;
        }

        const newShift: DutyShiftItem = {
            id: String(Date.now()),
            title: shiftTitle.trim(),
            start_time: shiftStart,
            end_time: shiftEnd,
            max_volunteers: shiftMaxVolunteers ? Number(shiftMaxVolunteers) : null,
            assigned_count: 0,
        };

        setDutyShifts((prev) => [...prev, newShift]);
        setShiftTitle("");
        setShiftStart("");
        setShiftEnd("");
        setShiftMaxVolunteers("");
    };

    const handleRemoveShiftRow = (id: string) => {
        setDutyShifts((prev) => prev.filter((s) => s.id !== id));
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
        setAllowsGuests(false);
        setDutyShifts([]);
        setOpenDialog(true);
    };

    const handleOpenEditDialog = (ev: EventItem) => {
        setEditingEventId(ev.id);
        setTitle(ev.title);
        setDescription(ev.description || "");
        setEventType(ev.event_type);

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
        setAllowsGuests(ev.allows_guests || false);
        setDutyShifts(ev.duty_shifts || []);
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
                allows_guests: allowsGuests,
                duty_shifts: dutyShifts,
            };

            if (editingEventId) {
                await apiClient.put(`/events/${editingEventId}`, payload);
            } else {
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

    const now = new Date();
    const displayedEvents = events.filter((ev) => {
        const evDate = parseEventDate(ev.start_time);
        return tab === "UPCOMING" ? evDate >= now : evDate < now;
    });

    const getEventTypeColor = (type: EventItem["event_type"]) => {
        switch (type) {
            case "REGULAR_MEETING":
                return "#002F6C";
            case "BOARD_MEETING":
                return "#C2185B";
            case "CHARITY_PROJECT":
                return "#2E7D32";
            case "SOCIAL_EVENT":
                return "#E65100";
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
                        const isPassed = dateObj < now;

                        const monthStr = dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
                        const dayStr = dateObj.getDate();
                        const weekdayStr = dateObj.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
                        const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                            ev.location
                        )}`;

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
                                        {/* Calendar Date Badge */}
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

                                                {ev.allows_guests && (
                                                    <Chip
                                                        icon={<Diversity1Icon sx={{ color: "white !important" }} />}
                                                        label={t("family_invited_badge", "Family Invited")}
                                                        size="small"
                                                        sx={{ bgcolor: "#7B1FA2", color: "white", fontWeight: 800, fontSize: "0.75rem" }}
                                                    />
                                                )}

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

                                                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, color: "text.secondary" }}>
                                                    <LocationOnIcon fontSize="small" color="error" />
                                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                        {ev.location}
                                                    </Typography>

                                                    {/* Google Maps Driving Direction Link */}
                                                    {!ev.is_online && ev.location && (
                                                        <Button
                                                            size="small"
                                                            variant="text"
                                                            startIcon={<DirectionsIcon />}
                                                            href={googleMapsUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            sx={{
                                                                fontWeight: 800,
                                                                color: "primary.main",
                                                                textTransform: "none",
                                                                p: 0,
                                                                ml: 1,
                                                            }}
                                                        >
                                                            {t("drive_directions", "Open Map / Directions")}
                                                        </Button>
                                                    )}
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

                                            {/* Duty Shifts Chips Display */}
                                            {ev.duty_shifts && ev.duty_shifts.length > 0 && (
                                                <Box sx={{ mb: 2, p: 1.5, bgcolor: "background.default", borderRadius: 2.5 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", display: "block", mb: 1 }}>
                                                        ⏱️ {t("duty_shifts_title", "Volunteer Duty Shifts")}:
                                                    </Typography>
                                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                                        {ev.duty_shifts.map((s) => {
                                                            const isFull = s.max_volunteers ? (s.assigned_count || 0) >= s.max_volunteers : false;
                                                            const isMine = ev.my_duty_shift_id === s.id;
                                                            return (
                                                                <Chip
                                                                    key={s.id}
                                                                    icon={<AssignmentIndIcon />}
                                                                    label={`${s.title} (${s.start_time} - ${s.end_time}) • ${s.assigned_count || 0}${s.max_volunteers ? `/${s.max_volunteers}` : ""
                                                                        } ${isFull ? "(Full)" : ""}`}
                                                                    color={isMine ? "primary" : isFull ? "default" : "info"}
                                                                    variant={isMine ? "filled" : "outlined"}
                                                                    sx={{ fontWeight: 700 }}
                                                                />
                                                            );
                                                        })}
                                                    </Box>
                                                </Box>
                                            )}

                                            <Divider sx={{ my: 2 }} />

                                            {/* RSVP Buttons, Guests and Attendance Counter */}
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
                                                    sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, cursor: "pointer" }}
                                                    onClick={() => handleOpenAttendees(ev)}
                                                >
                                                    <PeopleAltIcon color="action" />
                                                    <Chip label={`${ev.going_count} ${t("rsvp_going")}`} color="success" size="small" sx={{ fontWeight: 800 }} />
                                                    {ev.total_guests_count > 0 && (
                                                        <Chip label={`+${ev.total_guests_count} Guests`} color="secondary" size="small" sx={{ fontWeight: 800 }} />
                                                    )}
                                                    <Chip label={`${ev.maybe_count} ${t("rsvp_maybe")}`} color="warning" size="small" sx={{ fontWeight: 800 }} />
                                                    <Chip label={`${ev.declined_count} ${t("rsvp_declined")}`} color="error" size="small" sx={{ fontWeight: 800 }} />
                                                </Box>

                                                {!isPassed ? (
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            variant={ev.my_rsvp === "GOING" ? "contained" : "outlined"}
                                                            color="success"
                                                            startIcon={<CheckCircleIcon />}
                                                            onClick={() => handleRSVPAction(ev, "GOING")}
                                                            sx={{ minHeight: 44, fontWeight: 800, flex: 1 }}
                                                        >
                                                            {t("rsvp_going")}
                                                            {ev.my_rsvp === "GOING" && ev.my_guest_count > 0 && ` (+${ev.my_guest_count})`}
                                                        </Button>
                                                        <Button
                                                            variant={ev.my_rsvp === "MAYBE" ? "contained" : "outlined"}
                                                            color="warning"
                                                            startIcon={<HelpIcon />}
                                                            onClick={() => handleRSVPAction(ev, "MAYBE")}
                                                            sx={{ minHeight: 44, fontWeight: 800, flex: 1 }}
                                                        >
                                                            {t("rsvp_maybe")}
                                                        </Button>
                                                        <Button
                                                            variant={ev.my_rsvp === "DECLINED" ? "contained" : "outlined"}
                                                            color="error"
                                                            startIcon={<CancelIcon />}
                                                            onClick={() => handleRSVPAction(ev, "DECLINED")}
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

                                        {/* Edit & Delete Controls */}
                                        {canManage && (
                                            <Stack direction="row" spacing={0.5} sx={{ alignSelf: { xs: "flex-end", sm: "flex-start" } }}>
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
                maxWidth="md"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: { xs: 1.5, sm: 2 }, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {editingEventId ? "✏️ Edit Event" : `➕ ${t("schedule_event_btn")}`}
                </DialogTitle>
                <Box component="form" onSubmit={handleSaveEvent}>
                    <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                required
                                label={t("event_title_label")}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Annual Lions Gala & Charity Auction"
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

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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

                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={allowsGuests}
                                            onChange={(e) => setAllowsGuests(e.target.checked)}
                                            color="secondary"
                                        />
                                    }
                                    label={t("allow_family_checkbox", "Allow Members to Bring Family / Guests")}
                                />
                            </Stack>

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
                                    placeholder="e.g. Aleksanterinkatu 15, 00100 Helsinki"
                                />
                            )}

                            <TextField
                                fullWidth
                                multiline
                                rows={2}
                                label={t("description_label")}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Details, dress code, guest speakers..."
                            />

                            {/* Duty Shifts Section inside Event Form */}
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 3 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                                    ⏱️ {t("add_duty_shifts_title", "Configure Duty Shifts / Volunteer Slots")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                                    {t("duty_shifts_desc", "Define volunteer roles for charity events (e.g. Ticket Counter, Refreshments). Members can choose their duty shift when RSVPing.")}
                                </Typography>

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
                                    <TextField
                                        size="small"
                                        label="Duty Title"
                                        value={shiftTitle}
                                        onChange={(e) => setShiftTitle(e.target.value)}
                                        placeholder="e.g. Entrance Desk"
                                        sx={{ flex: 2 }}
                                    />
                                    <TextField
                                        size="small"
                                        label="From"
                                        type="time"
                                        value={shiftStart}
                                        onChange={(e) => setShiftStart(e.target.value)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                        sx={{ flex: 1 }}
                                    />
                                    <TextField
                                        size="small"
                                        label="To"
                                        type="time"
                                        value={shiftEnd}
                                        onChange={(e) => setShiftEnd(e.target.value)}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                        sx={{ flex: 1 }}
                                    />
                                    <TextField
                                        size="small"
                                        label="Max Vol."
                                        type="number"
                                        value={shiftMaxVolunteers}
                                        onChange={(e) => setShiftMaxVolunteers(e.target.value ? Number(e.target.value) : "")}
                                        placeholder="No limit"
                                        sx={{ width: { xs: "100%", sm: 100 } }}
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={handleAddShiftRow}
                                        startIcon={<AddIcon />}
                                        sx={{ fontWeight: 800, whiteSpace: "nowrap" }}
                                    >
                                        Add Slot
                                    </Button>
                                </Stack>

                                {dutyShifts.length > 0 && (
                                    <List dense sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
                                        {dutyShifts.map((s) => (
                                            <ListItem
                                                key={s.id}
                                                secondaryAction={
                                                    <IconButton edge="end" color="error" onClick={() => handleRemoveShiftRow(s.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemIcon>
                                                    <AssignmentIndIcon color="primary" />
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={<Typography sx={{ fontWeight: 700 }}>{s.title}</Typography>}
                                                    secondary={`${s.start_time} - ${s.end_time} • Max: ${s.max_volunteers || "Unlimited"}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </Box>
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

            {/* ================= MODAL: RSVP OPTIONS (FAMILY GUESTS & DUTY SHIFT) ================= */}
            <Dialog
                open={rsvpModalOpen}
                onClose={() => setRsvpModalOpen(false)}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>
                    🟢 {t("confirm_attendance_title", "Confirm Attendance")}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {activeRsvpEvent?.title}
                        </Typography>

                        {/* Family Members / Guests Counter */}
                        {activeRsvpEvent?.allows_guests && (
                            <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 3 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                                    👨‍👩‍👧‍👦 {t("bringing_guests_q", "Bringing Family / Guests?")}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                                    {t("guests_help_text", "Include your spouse, partner, or children participating with you.")}
                                </Typography>

                                <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "center" }}>
                                    <IconButton
                                        onClick={() => setSelectedGuestCount((prev) => Math.max(0, prev - 1))}
                                        disabled={selectedGuestCount === 0}
                                        sx={{ bgcolor: "background.paper", boxShadow: 1 }}
                                    >
                                        <RemoveIcon />
                                    </IconButton>
                                    <Typography variant="h5" sx={{ fontWeight: 900, minWidth: 40, textAlign: "center" }}>
                                        {selectedGuestCount}
                                    </Typography>
                                    <IconButton
                                        onClick={() => setSelectedGuestCount((prev) => prev + 1)}
                                        sx={{ bgcolor: "background.paper", boxShadow: 1 }}
                                    >
                                        <AddIcon />
                                    </IconButton>
                                </Stack>
                            </Box>
                        )}

                        {/* Duty Shifts Selector */}
                        {activeRsvpEvent?.duty_shifts && activeRsvpEvent.duty_shifts.length > 0 && (
                            <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 3 }}>
                                <FormControl component="fieldset" fullWidth>
                                    <FormLabel component="legend" sx={{ fontWeight: 800, mb: 1, color: "text.primary" }}>
                                        ⏱️ {t("select_duty_shift_label", "Select Volunteer Duty Slot (Optional)")}
                                    </FormLabel>
                                    <RadioGroup
                                        value={selectedDutyShiftId}
                                        onChange={(e) => setSelectedDutyShiftId(e.target.value)}
                                    >
                                        <FormControlLabel
                                            value=""
                                            control={<Radio />}
                                            label={
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {t("no_duty_shift", "General Attendee (No specific duty shift)")}
                                                </Typography>
                                            }
                                        />
                                        {activeRsvpEvent.duty_shifts.map((s) => {
                                            const isFull = s.max_volunteers ? (s.assigned_count || 0) >= s.max_volunteers : false;
                                            const isSelected = selectedDutyShiftId === s.id;
                                            return (
                                                <FormControlLabel
                                                    key={s.id}
                                                    value={s.id}
                                                    disabled={isFull && !isSelected}
                                                    control={<Radio />}
                                                    label={
                                                        <Box>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                {s.title} ({s.start_time} - {s.end_time})
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {s.assigned_count || 0} / {s.max_volunteers || "∞"} spots filled {isFull ? "• FULL" : ""}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                />
                                            );
                                        })}
                                    </RadioGroup>
                                </FormControl>
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2.5 }}>
                    <Button onClick={() => setRsvpModalOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => {
                            if (activeRsvpEvent) {
                                submitRSVP(activeRsvpEvent.id, "GOING", selectedGuestCount, selectedDutyShiftId || null);
                            }
                        }}
                        sx={{ fontWeight: 800, minHeight: 44, px: 3 }}
                    >
                        {t("confirm_going_btn", "Confirm RSVP: Going")}
                    </Button>
                </DialogActions>
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
                                    <ListItemText
                                        primary={
                                            <Typography sx={{ fontWeight: 700 }}>
                                                {att.full_name}
                                                {att.guest_count > 0 && (
                                                    <Chip
                                                        label={`+${att.guest_count} family`}
                                                        size="small"
                                                        color="secondary"
                                                        sx={{ ml: 1, height: 20, fontSize: "0.7rem", fontWeight: "bold" }}
                                                    />
                                                )}
                                            </Typography>
                                        }
                                        secondary={
                                            att.duty_shift_title ? (
                                                <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700 }}>
                                                    ⏱️ Duty: {att.duty_shift_title}
                                                </Typography>
                                            ) : (
                                                att.role
                                            )
                                        }
                                    />
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