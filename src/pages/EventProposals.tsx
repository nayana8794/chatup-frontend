// chatup-frontend/src/pages/EventProposals.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Chip,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    CircularProgress,
    Stack,
    Divider,
    Paper,
    IconButton,
    Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EuroSymbolIcon from "@mui/icons-material/EuroSymbol";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import { playNotificationChime } from "../utils/sound";
import apiClient from "../api/client";

interface Proposal {
    id: string;
    proposer_id: string;
    proposer_name: string;
    title: string;
    description?: string;
    proposed_date: string;
    location?: string;
    estimated_budget: number;
    status: "PENDING_ENDORSEMENT" | "PENDING_PRESIDENT_APPROVAL" | "APPROVED_AND_PUBLISHED" | "REJECTED";
    endorsed_user_ids: string[];
    created_at: string;
}

export const EventProposals: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [loading, setLoading] = useState(true);

    // Create Proposal Modal State
    const [openModal, setOpenModal] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [proposedDate, setProposedDate] = useState("");
    const [location, setLocation] = useState("");
    const [budget, setBudget] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    const isPresident = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT"].includes(user?.role || "");

    const fetchProposals = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const res = await apiClient.get<Proposal[]>("/proposals");
            setProposals(res.data);
        } catch (err) {
            console.error("Failed to load proposals:", err);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchProposals(true);
    }, [fetchProposals]);

    // Live WebSockets Synchronization
    useEffect(() => {
        if (!lastEvent) return;
        const ev = String(lastEvent.type);
        if (
            ev === "EVENT_PROPOSAL_CREATED" ||
            ev === "EVENT_PROPOSAL_ENDORSED" ||
            ev === "EVENT_PROPOSAL_APPROVED" ||
            ev === "EVENT_PROPOSAL_DELETED"
        ) {
            playNotificationChime();
            void fetchProposals(false);
        }
    }, [lastEvent, fetchProposals]);

    const handleCreateProposal = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        setSubmitting(true);

        try {
            await apiClient.post("/proposals", {
                title: title.trim(),
                description: description.trim() || undefined,
                proposed_date: new Date(proposedDate).toISOString(),
                location: location.trim() || undefined,
                estimated_budget: budget ? parseFloat(budget) : 0.0,
            });
            setOpenModal(false);
            setTitle("");
            setDescription("");
            setProposedDate("");
            setLocation("");
            setBudget("");
            void fetchProposals(false);
            alert(t("proposal_created_success", "Event proposal submitted successfully for member endorsements!"));
        } catch (err: any) {
            setFormError(err.response?.data?.detail || "Failed to submit proposal");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEndorse = async (proposalId: string) => {
        try {
            await apiClient.post(`/proposals/${proposalId}/endorse`);
            void fetchProposals(false);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to endorse proposal");
        }
    };

    const handleApprove = async (proposalId: string) => {
        if (!window.confirm(t("confirm_approve_proposal", "Approve this proposal and officially publish it to the club calendar?"))) return;
        try {
            await apiClient.post(`/proposals/${proposalId}/approve`);
            void fetchProposals(false);
            alert(t("proposal_approved_success", "Proposal approved! Event synchronized with club calendar."));
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to approve proposal");
        }
    };

    const handleDelete = async (proposalId: string) => {
        if (!window.confirm(t("confirm_delete_proposal", "Delete this proposal?"))) return;
        try {
            await apiClient.delete(`/proposals/${proposalId}`);
            void fetchProposals(false);
        } catch (err: any) {
            alert(err.response?.data?.detail || "Failed to delete proposal");
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 4 }, px: { xs: 2, sm: 3 } }}>
            {/* Top Navigation Bar */}
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 3.5,
                }}
            >
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={onBack}
                    variant="outlined"
                    sx={{ fontWeight: 800, minHeight: 48, borderRadius: 3, px: 2.5 }}
                >
                    {t("back_to_dashboard", "Back to Dashboard")}
                </Button>

                <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: "primary.main" }}>
                        💡 {t("proposals_title", "Community Event & Project Proposals")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {t("proposals_subtitle", "Democratic member suggestions requiring assembly endorsements & presidential approval")}
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenModal(true)}
                    sx={{ fontWeight: 900, minHeight: 48, borderRadius: 3, bgcolor: "#002F6C" }}
                >
                    {t("propose_event_btn", "Propose New Event")}
                </Button>
            </Stack>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : proposals.length === 0 ? (
                <Paper sx={{ p: 6, textAlign: "center", borderRadius: 4 }}>
                    <EventIcon sx={{ fontSize: 60, color: "text.secondary", mb: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {t("no_proposals_found", "No Event Proposals Yet")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                        {t("no_proposals_desc", "Be the first member to pitch a new community project or club assembly activity.")}
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenModal(true)}
                        sx={{ fontWeight: 800, bgcolor: "#002F6C", borderRadius: 2.5 }}
                    >
                        {t("propose_event_btn", "Propose New Event")}
                    </Button>
                </Paper>
            ) : (
                <Stack spacing={2.5}>
                    {proposals.map((prop) => {
                        const myUserId = String(user?.user_id || "").toLowerCase();
                        const hasEndorsed = prop.endorsed_user_ids?.some((id) => String(id).toLowerCase() === myUserId);
                        const isProposer = String(prop.proposer_id).toLowerCase() === myUserId;
                        const endorsementCount = prop.endorsed_user_ids?.length || 0;

                        return (
                            <Card
                                key={prop.id}
                                elevation={2}
                                sx={{
                                    borderRadius: 3.5,
                                    borderLeft: "6px solid",
                                    borderLeftColor:
                                        prop.status === "APPROVED_AND_PUBLISHED"
                                            ? "success.main"
                                            : prop.status === "PENDING_PRESIDENT_APPROVAL"
                                                ? "warning.main"
                                                : "#002F6C",
                                }}
                            >
                                <CardContent sx={{ p: { xs: 2.2, sm: 3 } }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                {prop.title}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                                Proposed by <b>{prop.proposer_name}</b> • {new Date(prop.created_at).toLocaleDateString()}
                                            </Typography>
                                        </Box>

                                        <Chip
                                            label={
                                                prop.status === "APPROVED_AND_PUBLISHED"
                                                    ? t("status_approved", "Approved & Published")
                                                    : prop.status === "PENDING_PRESIDENT_APPROVAL"
                                                        ? t("status_awaiting_president", "Awaiting President Approval")
                                                        : t("status_gathering_endorsements", `Gathering Endorsements (${endorsementCount}/2)`)
                                            }
                                            color={
                                                prop.status === "APPROVED_AND_PUBLISHED"
                                                    ? "success"
                                                    : prop.status === "PENDING_PRESIDENT_APPROVAL"
                                                        ? "warning"
                                                        : "primary"
                                            }
                                            sx={{ fontWeight: 800 }}
                                        />
                                    </Box>

                                    {prop.description && (
                                        <Typography variant="body2" sx={{ mb: 2, color: "text.primary", lineHeight: 1.6 }}>
                                            {prop.description}
                                        </Typography>
                                    )}

                                    <Stack direction="row" spacing={3} sx={{ color: "text.secondary", flexWrap: "wrap", gap: 1.5, mb: 2.5 }}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                            <AccessTimeIcon fontSize="small" />
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                {new Date(prop.proposed_date).toLocaleDateString()} at {new Date(prop.proposed_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </Typography>
                                        </Box>
                                        {prop.location && (
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <LocationOnIcon fontSize="small" color="error" />
                                                <Typography variant="body2">{prop.location}</Typography>
                                            </Box>
                                        )}
                                        {prop.estimated_budget > 0 && (
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                <EuroSymbolIcon fontSize="small" color="success" />
                                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                                    Est. Budget: €{prop.estimated_budget.toFixed(2)}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Stack>

                                    <Divider sx={{ mb: 2 }} />

                                    {/* Action Buttons */}
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                                            👥 Member Endorsements: <b>{endorsementCount}</b> {endorsementCount === 1 ? "Member" : "Members"} seconded
                                        </Typography>

                                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                                            {prop.status !== "APPROVED_AND_PUBLISHED" && !hasEndorsed && !isProposer && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<ThumbUpIcon />}
                                                    onClick={() => handleEndorse(prop.id)}
                                                    sx={{ fontWeight: 800, bgcolor: "#002F6C", borderRadius: 2.5, textTransform: "none" }}
                                                >
                                                    {t("btn_endorse", "Endorse Proposal")}
                                                </Button>
                                            )}

                                            {hasEndorsed && prop.status !== "APPROVED_AND_PUBLISHED" && (
                                                <Chip
                                                    icon={<CheckCircleIcon />}
                                                    label={t("endorsed_badge", "You Endorsed")}
                                                    color="success"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 800 }}
                                                />
                                            )}

                                            {isPresident && prop.status === "PENDING_PRESIDENT_APPROVAL" && (
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="success"
                                                    startIcon={<CheckCircleIcon />}
                                                    onClick={() => handleApprove(prop.id)}
                                                    sx={{ fontWeight: 900, borderRadius: 2.5, textTransform: "none" }}
                                                >
                                                    {t("btn_approve_to_calendar", "Approve & Sync to Calendar")}
                                                </Button>
                                            )}

                                            {(isProposer || isPresident) && prop.status !== "APPROVED_AND_PUBLISHED" && (
                                                <Tooltip title={t("delete_btn", "Delete Proposal")}>
                                                    <IconButton size="small" color="error" onClick={() => handleDelete(prop.id)}>
                                                        <DeleteIcon fontSize="small" />
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

            {/* Create Proposal Modal */}
            <Dialog open={openModal} onClose={() => !submitting && setOpenModal(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 900, color: "#002F6C" }}>
                    💡 {t("modal_propose_title", "Propose New Club Event or Project")}
                </DialogTitle>
                <Box component="form" onSubmit={handleCreateProposal}>
                    <DialogContent dividers>
                        {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

                        <TextField
                            fullWidth
                            required
                            label={t("proposal_title_label", "Event / Project Title")}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Spring Charity Golf Tournament & Gala Dinner"
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label={t("proposal_desc_label", "Detailed Description & Objectives")}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            margin="normal"
                            placeholder="Explain the community impact, expected participants, and schedule..."
                        />

                        <TextField
                            fullWidth
                            required
                            type="datetime-local"
                            label={t("proposed_date_label", "Proposed Date & Time")}
                            value={proposedDate}
                            onChange={(e) => setProposedDate(e.target.value)}
                            margin="normal"
                            slotProps={{ inputLabel: { shrink: true } }}
                        />

                        <TextField
                            fullWidth
                            label={t("location_label", "Venue / Location")}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            margin="normal"
                            placeholder="e.g. Helsinki Country Club"
                        />

                        <TextField
                            fullWidth
                            type="number"
                            label={t("estimated_budget_label", "Estimated Budget (€ Optional)")}
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            margin="normal"
                            placeholder="1500.00"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenModal(false)} disabled={submitting}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={submitting} sx={{ fontWeight: 900, bgcolor: "#002F6C" }}>
                            {submitting ? <CircularProgress size={24} color="inherit" /> : "Submit Proposal"}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Container>
    );
};