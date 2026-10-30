// chatup/frontend/src/pages/Voting.tsx
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
    Radio,
    RadioGroup,
    FormControlLabel,
    Checkbox,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    LinearProgress,
    IconButton,
    FormControl,
    FormLabel,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DeleteIcon from "@mui/icons-material/Delete";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useRealtime } from "../context/useRealtime";
import apiClient from "../api/client";

interface PollOption {
    id: string;
    title: string;
    description?: string;
    vote_count: number;
    percentage: number;
}

interface Poll {
    id: string;
    title: string;
    description?: string;
    poll_type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
    status: "ACTIVE" | "CLOSED";
    is_secret: boolean;
    total_votes: number;
    has_voted: boolean;
    created_at: string;
    options: PollOption[];
}

export const Voting: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { lastEvent } = useRealtime();

    const isOfficer = ["SUPER_ADMIN", "PRESIDENT", "VICE_PRESIDENT", "SECRETARY", "VICE_SECRETARY"].includes(
        user?.role || ""
    );

    const [tabIndex, setTabIndex] = useState(0);
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedOptions, setSelectedOptions] = useState<{ [pollId: string]: string[] }>({});
    const [submittingPollId, setSubmittingPollId] = useState<string | null>(null);

    // Create Poll Dialog
    const [openCreate, setOpenCreate] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [pollType, setPollType] = useState<"SINGLE_CHOICE" | "MULTIPLE_CHOICE">("SINGLE_CHOICE");
    const [options, setOptions] = useState<string[]>(["", ""]);
    const [createError, setCreateError] = useState("");
    const [creating, setCreating] = useState(false);

    const fetchPolls = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.get<Poll[]>("/polls");
            setPolls(res.data);
        } catch (err) {
            console.error("Failed to fetch club polls:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPolls();
    }, [fetchPolls]);

    useEffect(() => {
        if (
            lastEvent?.type === "POLL_CREATED" ||
            lastEvent?.type === "POLL_VOTED" ||
            lastEvent?.type === "POLL_CLOSED" ||
            lastEvent?.type === "POLL_DELETED"
        ) {
            fetchPolls();
        }
    }, [lastEvent, fetchPolls]);

    const handleVoteSubmit = async (poll: Poll) => {
        const chosen = selectedOptions[poll.id] || [];
        if (chosen.length === 0) return;

        setSubmittingPollId(poll.id);
        try {
            await apiClient.post(`/polls/${poll.id}/vote`, {
                selected_option_ids: chosen,
            });
            fetchPolls();
        } catch (err: any) {
            alert(err.response?.data?.detail || t("vote_record_error", "Error recording ballot"));
        } finally {
            setSubmittingPollId(null);
        }
    };

    const handleClosePoll = async (pollId: string) => {
        if (!window.confirm(t("msg_confirm_conclude", "Are you sure you want to conclude this vote and publish final certified results?"))) return;
        try {
            await apiClient.post(`/polls/${pollId}/close`);
            fetchPolls();
        } catch (err: any) {
            alert(err.response?.data?.detail || t("vote_conclude_error", "Failed to conclude vote"));
        }
    };

    const handleDeletePoll = async (pollId: string) => {
        if (!window.confirm(t("msg_confirm_delete", "Delete this ballot permanently?"))) return;
        try {
            await apiClient.delete(`/polls/${pollId}`);
            fetchPolls();
        } catch (err: any) {
            alert(err.response?.data?.detail || t("vote_delete_error", "Failed to delete ballot"));
        }
    };

    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError("");

        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        if (cleanOptions.length < 2) {
            setCreateError(t("err_min_options", "Please provide at least 2 distinct voting candidates/options"));
            return;
        }

        setCreating(true);
        try {
            await apiClient.post("/polls", {
                title: title.trim(),
                description: description.trim() || undefined,
                poll_type: pollType,
                is_secret: true,
                options: cleanOptions.map((o) => ({ title: o })),
            });
            setOpenCreate(false);
            setTitle("");
            setDescription("");
            setPollType("SINGLE_CHOICE");
            setOptions(["", ""]);
            fetchPolls();
        } catch (err: any) {
            setCreateError(err.response?.data?.detail || t("create_ballot_error", "Failed to create ballot"));
        } finally {
            setCreating(false);
        }
    };

    const activePolls = polls.filter((p) => p.status === "ACTIVE");
    const closedPolls = polls.filter((p) => p.status === "CLOSED");

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 }, px: { xs: 2, sm: 3 } }}>
            {/* Unified Responsive Header: Exact layout as Events screen (Image 2) */}
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
                    🗳️ {t("secret_voting_title", "Democratic Secret Voting")}
                </Typography>

                {isOfficer ? (
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenCreate(true)}
                        sx={{
                            minHeight: 44,
                            borderRadius: 2.5,
                            fontWeight: 900,
                            px: 2.5,
                            bgcolor: "#002F6C",
                            textTransform: "none",
                            fontSize: "0.95rem",
                            width: { xs: "100%", sm: "auto" },
                            "&:hover": { bgcolor: "#001f4d" },
                        }}
                    >
                        {t("btn_create_ballot", "Create Election Ballot")}
                    </Button>
                ) : (
                    <Box sx={{ width: { xs: 0, sm: 140 }, display: { xs: "none", sm: "block" } }} />
                )}
            </Stack>

            {/* Clean Underline Tabs matching Events Screen (Image 2) */}
            <Box sx={{ borderBottom: 2, borderColor: "divider", mb: 3.5 }}>
                <Tabs
                    value={tabIndex}
                    onChange={(_, val) => setTabIndex(val)}
                    variant="fullWidth"
                    sx={{
                        "& .MuiTab-root": {
                            fontWeight: 800,
                            fontSize: { xs: "0.92rem", sm: "1.05rem" },
                            textTransform: "none",
                            pb: 1.5,
                        },
                    }}
                >
                    <Tab label={`${t("tab_active_ballots", "Active Ballots")} (${activePolls.length})`} />
                    <Tab label={`${t("tab_concluded_results", "Concluded Results")} (${closedPolls.length})`} />
                </Tabs>
            </Box>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : tabIndex === 0 ? (
                /* TAB 0: ACTIVE BALLOTS */
                activePolls.length === 0 ? (
                    <Card
                        elevation={1}
                        sx={{
                            p: { xs: 4, sm: 5 },
                            borderRadius: 4,
                            textAlign: "center",
                            border: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <Box
                            sx={{
                                width: 72,
                                height: 72,
                                borderRadius: "50%",
                                bgcolor: "action.hover",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mx: "auto",
                                mb: 2,
                            }}
                        >
                            <HowToVoteIcon sx={{ fontSize: 38, color: "text.secondary" }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                            {t("no_active_ballots", "No Active Ballots")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t("no_active_ballots_desc", "There are currently no open voting procedures in your club.")}
                        </Typography>
                    </Card>
                ) : (
                    <Stack spacing={2.5}>
                        {activePolls.map((poll) => {
                            const isVoted = poll.has_voted;
                            const isSingle = poll.poll_type === "SINGLE_CHOICE";
                            const chosen = selectedOptions[poll.id] || [];

                            return (
                                <Card key={poll.id} elevation={3} sx={{ borderRadius: 3.5, borderLeft: "6px solid #002F6C" }}>
                                    <CardContent sx={{ p: { xs: 2.2, sm: 3 } }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, mb: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                {poll.title}
                                            </Typography>
                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                {poll.is_secret && (
                                                    <Chip
                                                        icon={<LockIcon sx={{ fontSize: 13 }} />}
                                                        label={t("secret_ballot_badge", "Secret Ballot")}
                                                        size="small"
                                                        sx={{ bgcolor: "rgba(0, 47, 108, 0.12)", color: "#002F6C", fontWeight: 800 }}
                                                    />
                                                )}
                                                <Chip
                                                    label={`${poll.total_votes} ${t("cast_count_badge", "Cast")}`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 700 }}
                                                />
                                            </Stack>
                                        </Box>

                                        {poll.description && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {poll.description}
                                            </Typography>
                                        )}

                                        {isVoted ? (
                                            <Box sx={{ mt: 2, p: 2, bgcolor: "rgba(46, 125, 50, 0.08)", borderRadius: 2.5, border: "1px solid rgba(46, 125, 50, 0.25)" }}>
                                                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 0.5 }}>
                                                    <CheckCircleIcon sx={{ color: "success.main" }} />
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "success.main" }}>
                                                        {t("vote_submitted_title", "Your Secret Ballot Has Been Cast!")}
                                                    </Typography>
                                                </Stack>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                                    {t("vote_submitted_desc", "Thank you for participating in club democracy. Final results will unlock once the President concludes the voting window.")}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Box sx={{ mt: 2 }}>
                                                {isSingle ? (
                                                    <RadioGroup
                                                        value={chosen[0] || ""}
                                                        onChange={(e) =>
                                                            setSelectedOptions({
                                                                ...selectedOptions,
                                                                [poll.id]: [e.target.value],
                                                            })
                                                        }
                                                    >
                                                        {poll.options.map((opt) => (
                                                            <Box
                                                                key={opt.id}
                                                                sx={{
                                                                    mb: 1.2,
                                                                    p: 1.2,
                                                                    borderRadius: 2.5,
                                                                    border: chosen[0] === opt.id ? "2px solid #002F6C" : "1px solid rgba(0,0,0,0.12)",
                                                                    bgcolor: chosen[0] === opt.id ? "rgba(0, 47, 108, 0.06)" : "background.paper",
                                                                }}
                                                            >
                                                                <FormControlLabel
                                                                    value={opt.id}
                                                                    control={<Radio color="primary" />}
                                                                    label={
                                                                        <Box>
                                                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                                                {opt.title}
                                                                            </Typography>
                                                                            {opt.description && (
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    {opt.description}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    }
                                                                    sx={{ width: "100%", m: 0 }}
                                                                />
                                                            </Box>
                                                        ))}
                                                    </RadioGroup>
                                                ) : (
                                                    poll.options.map((opt) => {
                                                        const isChecked = chosen.includes(opt.id);
                                                        return (
                                                            <Box
                                                                key={opt.id}
                                                                sx={{
                                                                    mb: 1.2,
                                                                    p: 1.2,
                                                                    borderRadius: 2.5,
                                                                    border: isChecked ? "2px solid #002F6C" : "1px solid rgba(0,0,0,0.12)",
                                                                    bgcolor: isChecked ? "rgba(0, 47, 108, 0.06)" : "background.paper",
                                                                }}
                                                            >
                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const next = e.target.checked
                                                                                    ? [...chosen, opt.id]
                                                                                    : chosen.filter((id) => id !== opt.id);
                                                                                setSelectedOptions({
                                                                                    ...selectedOptions,
                                                                                    [poll.id]: next,
                                                                                });
                                                                            }}
                                                                        />
                                                                    }
                                                                    label={
                                                                        <Box>
                                                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                                                {opt.title}
                                                                            </Typography>
                                                                            {opt.description && (
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    {opt.description}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    }
                                                                    sx={{ width: "100%", m: 0 }}
                                                                />
                                                            </Box>
                                                        );
                                                    })
                                                )}

                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    disabled={chosen.length === 0 || submittingPollId === poll.id}
                                                    onClick={() => handleVoteSubmit(poll)}
                                                    sx={{ mt: 2, minHeight: 48, borderRadius: 2.5, fontWeight: 900, bgcolor: "#002F6C" }}
                                                >
                                                    {submittingPollId === poll.id ? <CircularProgress size={24} color="inherit" /> : t("btn_submit_ballot", "Submit Secret Ballot")}
                                                </Button>
                                            </Box>
                                        )}

                                        {/* Officer Controls */}
                                        {isOfficer && (
                                            <Stack direction="row" spacing={1.5} sx={{ mt: 2.5, pt: 1.5, borderTop: "1px solid rgba(0,0,0,0.08)", justifyContent: "flex-end", alignItems: "center" }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="warning"
                                                    onClick={() => handleClosePoll(poll.id)}
                                                    sx={{ fontWeight: 800, textTransform: "none", borderRadius: 2 }}
                                                >
                                                    {t("btn_conclude_vote", "Conclude & Publish Results")}
                                                </Button>
                                                {user?.role === "PRESIDENT" && (
                                                    <IconButton size="small" color="error" onClick={() => handleDeletePoll(poll.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Stack>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                )
            ) : (
                /* TAB 1: CONCLUDED RESULTS */
                closedPolls.length === 0 ? (
                    <Card elevation={1} sx={{ p: 5, borderRadius: 4, textAlign: "center", border: "1px solid", borderColor: "divider" }}>
                        <EmojiEventsIcon sx={{ fontSize: 56, color: "text.secondary", mb: 1.5 }} />
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                            {t("no_concluded_records", "No Certified Election Records")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t("no_concluded_records_desc", "Concluded votes will display their audited breakdown and candidate percentages here.")}
                        </Typography>
                    </Card>
                ) : (
                    <Stack spacing={2.5}>
                        {closedPolls.map((poll) => {
                            const maxVotes = Math.max(...poll.options.map((o) => o.vote_count), 0);
                            return (
                                <Card key={poll.id} elevation={3} sx={{ borderRadius: 3.5, borderLeft: "6px solid #2e7d32" }}>
                                    <CardContent sx={{ p: { xs: 2.2, sm: 3 } }}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, mb: 1 }}>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 900, color: "#002F6C" }}>
                                                    {poll.title}
                                                </Typography>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                                                    <AccessTimeIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t("audit_record_label", "Concluded • Certified Audit Record")}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Chip label={t("certified_results_badge", "Certified Results")} color="success" size="small" sx={{ fontWeight: 800 }} />
                                        </Box>

                                        {poll.description && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                {poll.description}
                                            </Typography>
                                        )}

                                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                                            {poll.options.map((opt) => {
                                                const isWinner = opt.vote_count === maxVotes && maxVotes > 0;
                                                return (
                                                    <Box key={opt.id} sx={{ p: 1.5, borderRadius: 2.5, bgcolor: isWinner ? "rgba(242, 169, 0, 0.12)" : "rgba(0,0,0,0.03)", border: isWinner ? "1.5px solid #F2A900" : "1px solid rgba(0,0,0,0.08)" }}>
                                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.8 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 0.8 }}>
                                                                {isWinner && <EmojiEventsIcon sx={{ color: "#F2A900", fontSize: 20 }} />}
                                                                {opt.title}
                                                            </Typography>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: isWinner ? "#b78103" : "text.primary" }}>
                                                                {opt.vote_count} {t("votes_label", "votes")} ({opt.percentage}%)
                                                            </Typography>
                                                        </Box>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={opt.percentage}
                                                            sx={{ height: 10, borderRadius: 5, bgcolor: "rgba(0,0,0,0.08)", "& .MuiLinearProgress-bar": { bgcolor: isWinner ? "#F2A900" : "#002F6C" } }}
                                                        />
                                                    </Box>
                                                );
                                            })}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                )
            )}

            {/* CREATE BALLOT DIALOG */}
            <Dialog open={openCreate} onClose={() => !creating && setOpenCreate(false)} maxWidth="sm" fullWidth sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}>
                <DialogTitle sx={{ fontWeight: 800 }}>🗳️ {t("dialog_create_title", "Create Democratic Ballot / Election")}</DialogTitle>
                <Box component="form" onSubmit={handleCreatePoll}>
                    <DialogContent dividers>
                        {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

                        <TextField
                            fullWidth
                            required
                            label={t("label_ballot_title", "Ballot Title")}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            margin="normal"
                            placeholder={t("placeholder_ballot_title", "e.g. 2026/2027 Club President Election")}
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label={t("label_ballot_desc", "Description / Purpose (Optional)")}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            margin="normal"
                            placeholder={t("placeholder_ballot_desc", "Specify candidate credentials or voting instructions")}
                        />

                        <FormControl sx={{ mt: 2, mb: 1 }}>
                            <FormLabel sx={{ fontWeight: 800, fontSize: "0.85rem" }}>
                                {t("label_selection_rule", "Ballot Selection Rule")}
                            </FormLabel>
                            <RadioGroup
                                row
                                value={pollType}
                                onChange={(e) => setPollType(e.target.value as "SINGLE_CHOICE" | "MULTIPLE_CHOICE")}
                            >
                                <FormControlLabel
                                    value="SINGLE_CHOICE"
                                    control={<Radio size="small" />}
                                    label={t("rule_single_choice", "Single Choice (1 Candidate)")}
                                />
                                <FormControlLabel
                                    value="MULTIPLE_CHOICE"
                                    control={<Radio size="small" />}
                                    label={t("rule_multiple_choice", "Multiple Choices Allowed")}
                                />
                            </RadioGroup>
                        </FormControl>

                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2, mb: 1, color: "primary.main" }}>
                            {t("label_candidates_options", "Candidates / Voting Options:")}
                        </Typography>

                        {options.map((opt, idx) => (
                            <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    required
                                    label={`${t("option_label", "Option")} #${idx + 1}`}
                                    value={opt}
                                    onChange={(e) => {
                                        const next = [...options];
                                        next[idx] = e.target.value;
                                        setOptions(next);
                                    }}
                                    placeholder={idx === 0 ? t("candidate_a", "Candidate A") : t("candidate_b", "Candidate B")}
                                />
                                {options.length > 2 && (
                                    <IconButton size="small" color="error" onClick={() => setOptions(options.filter((_, i) => i !== idx))}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>
                        ))}

                        <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setOptions([...options, ""])}
                            sx={{ mt: 1, fontWeight: 800 }}
                        >
                            {t("btn_add_option", "Add Candidate / Option")}
                        </Button>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenCreate(false)} disabled={creating}>
                            {t("cancel_btn", "Cancel")}
                        </Button>
                        <Button type="submit" variant="contained" disabled={creating} sx={{ fontWeight: 800, bgcolor: "#002F6C" }}>
                            {creating ? <CircularProgress size={24} color="inherit" /> : t("btn_deploy_ballot", "Deploy Ballot")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Container>
    );
};