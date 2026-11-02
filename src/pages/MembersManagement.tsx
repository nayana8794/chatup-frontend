// chatup/frontend/src/pages/MembersManagement.tsx
import React, { useState, useEffect } from "react";
import {
    Container,
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Alert,
    Tooltip,
    CircularProgress,
    Card,
    CardContent,
    useMediaQuery,
    useTheme,
    Stack,
    Divider,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LockResetIcon from "@mui/icons-material/LockReset";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BadgeIcon from "@mui/icons-material/Badge";
import { useTranslation } from "react-i18next";
import apiClient from "../api/client";

interface Member {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string;
    role: string;
    language: string;
    is_active: boolean;
    must_change_password?: boolean;
}

const OFFICER_ROLES = [
    { value: "MEMBER", label: "role_member" },
    { value: "VICE_PRESIDENT", label: "role_vice_president" },
    { value: "SECRETARY", label: "role_secretary" },
    { value: "VICE_SECRETARY", label: "role_vice_secretary" },
    { value: "TREASURER", label: "role_treasurer" },
    { value: "VICE_TREASURER", label: "role_vice_treasurer" },
    { value: "PLANNER", label: "role_planner" },
    { value: "VICE_PLANNER", label: "role_vice_planner" },
];

export const MembersManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Member Dialog
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("MEMBER");
    const [language, setLanguage] = useState("fi");
    const [error, setError] = useState<string | null>(null);

    // Edit Member / Promote Role Dialog
    const [editTarget, setEditTarget] = useState<Member | null>(null);
    const [editRole, setEditRole] = useState("MEMBER");
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editError, setEditError] = useState<string | null>(null);
    const [savingRole, setSavingRole] = useState(false);

    // Temporary Password Modal
    const [tempPassDialog, setTempPassDialog] = useState<{ open: boolean; name: string; password: string }>({
        open: false,
        name: "",
        password: "",
    });
    const [copied, setCopied] = useState(false);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get<Member[]>("/members");
            setMembers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleCreateMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await apiClient.post("/members", {
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                phone_number: phone.trim() ? phone.trim() : null,
                role,
                language,
            });

            setOpenAddDialog(false);
            setFullName("");
            setEmail("");
            setPhone("");

            setTempPassDialog({
                open: true,
                name: res.data.full_name,
                password: res.data.temp_password,
            });

            fetchMembers();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (Array.isArray(detail)) {
                setError(detail.map((d: any) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(", "));
            } else {
                setError(detail || t("error_adding_member", "Error adding member"));
            }
        }
    };

    const handleOpenEditMember = (member: Member) => {
        setEditTarget(member);
        setEditRole(member.role);
        setEditName(member.full_name);
        setEditPhone(member.phone_number || "");
        setEditError(null);
    };

    const handleSaveRoleAndDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTarget) return;

        setEditError(null);
        setSavingRole(true);
        try {
            await apiClient.patch(`/members/${editTarget.id}`, {
                full_name: editName.trim(),
                phone_number: editPhone.trim() || null,
                role: editRole,
            });
            setEditTarget(null);
            fetchMembers();
        } catch (err: any) {
            setEditError(err.response?.data?.detail || t("error_updating_role", "Failed to update member role"));
        } finally {
            setSavingRole(false);
        }
    };

    const handleResetPassword = async (member: Member) => {
        if (!window.confirm(`${t("confirm_reset_pass", "Reset password for")} ${member.full_name}?`)) return;

        try {
            const res = await apiClient.post(`/members/${member.id}/reset-password`);
            setTempPassDialog({
                open: true,
                name: member.full_name,
                password: res.data.temp_password,
            });
            fetchMembers();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error resetting password");
        }
    };

    const handleDeleteMember = async (member: Member) => {
        if (!window.confirm(`${t("confirm_delete", "Delete member")} (${member.full_name})?`)) return;

        try {
            await apiClient.delete(`/members/${member.id}`);
            fetchMembers();
        } catch (err: any) {
            alert(err.response?.data?.detail || "Error deleting member");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, sm: 3.5 }, px: { xs: 2, sm: 3 } }}>
            {/* Top Header Bar: 100% Centered matching Events, Voting, Dues */}
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
                    👥 {t("menu_members", "Club Members Management")}
                </Typography>

                <Box
                    sx={{
                        minWidth: { sm: 200 },
                        display: "flex",
                        justifyContent: { xs: "center", sm: "flex-end" },
                    }}
                >
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PersonAddIcon />}
                        onClick={() => setOpenAddDialog(true)}
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
                        {t("add_member", "Add Member")}
                    </Button>
                </Box>
            </Stack>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : isMobile ? (
                /* ================= MOBILE VIEW: SENIOR-FRIENDLY CARDS ================= */
                <Stack spacing={2}>
                    {members.map((member) => (
                        <Card key={member.id} elevation={3} sx={{ borderRadius: 3.5, p: 1, borderLeft: "5px solid #002F6C" }}>
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main", fontSize: "1.1rem" }}>
                                        {member.full_name}
                                    </Typography>
                                    <Chip
                                        label={member.role}
                                        color={member.role === "MEMBER" ? "default" : "primary"}
                                        size="small"
                                        sx={{ fontWeight: 800 }}
                                    />
                                </Box>

                                <Stack spacing={0.5} sx={{ my: 1.5 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <EmailIcon fontSize="small" color="action" />
                                        <Typography variant="body2" color="text.secondary">
                                            {member.email}
                                        </Typography>
                                    </Box>
                                    {member.phone_number && (
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <PhoneIcon fontSize="small" color="action" />
                                            <Typography variant="body2" color="text.secondary">
                                                {member.phone_number}
                                            </Typography>
                                        </Box>
                                    )}
                                </Stack>

                                <Divider sx={{ my: 1.5 }} />

                                {/* Action Buttons: Edit Role, Reset, Delete */}
                                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap", gap: 0.5 }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<BadgeIcon />}
                                        onClick={() => handleOpenEditMember(member)}
                                        sx={{ fontWeight: 800, borderRadius: 2, textTransform: "none" }}
                                    >
                                        {t("change_role_btn", "Change Role")}
                                    </Button>

                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="warning"
                                        startIcon={<LockResetIcon />}
                                        onClick={() => handleResetPassword(member)}
                                        sx={{ fontWeight: 800, borderRadius: 2, textTransform: "none" }}
                                    >
                                        {t("reset_btn", "Reset")}
                                    </Button>

                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDeleteMember(member)}
                                        sx={{ fontWeight: 800, borderRadius: 2, textTransform: "none" }}
                                    >
                                        {t("delete_btn", "Delete")}
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            ) : (
                /* ================= DESKTOP VIEW: LUXURY TABLE ================= */
                <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3.5, overflowX: "auto" }}>
                    <Table>
                        <TableHead sx={{ bgcolor: "#002F6C" }}>
                            <TableRow>
                                <TableCell sx={{ color: "white", fontWeight: 800, fontSize: "1rem" }}>
                                    {t("member_name", "Member Name")}
                                </TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800, fontSize: "1rem" }}>
                                    {t("email_label", "Email Address")}
                                </TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800, fontSize: "1rem" }}>
                                    {t("member_phone", "Phone Number")}
                                </TableCell>
                                <TableCell sx={{ color: "white", fontWeight: 800, fontSize: "1rem" }}>
                                    {t("member_role", "Assigned Role")}
                                </TableCell>
                                <TableCell align="center" sx={{ color: "white", fontWeight: 800, fontSize: "1rem" }}>
                                    {t("actions_label", "Actions")}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {members.map((member) => (
                                <TableRow key={member.id} hover>
                                    <TableCell sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{member.full_name}</TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>{member.phone_number || "—"}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={member.role}
                                            color={member.role === "MEMBER" ? "default" : "primary"}
                                            sx={{ fontWeight: 800 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
                                            <Tooltip title={t("change_role_tooltip", "Promote or Change Officer Role")}>
                                                <IconButton color="primary" onClick={() => handleOpenEditMember(member)}>
                                                    <BadgeIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t("reset_password", "Reset Temporary Password")}>
                                                <IconButton color="warning" onClick={() => handleResetPassword(member)}>
                                                    <LockResetIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t("delete_member", "Delete Member")}>
                                                <IconButton color="error" onClick={() => handleDeleteMember(member)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Promote Role / Edit Details Dialog */}
            <Dialog
                open={Boolean(editTarget)}
                onClose={() => !savingRole && setEditTarget(null)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: { xs: 2, sm: 4 }, p: 1, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: "primary.main" }}>
                    🎖️ {t("promote_dialog_title", "Change Role & Appoint Officer")}
                </DialogTitle>
                <Box component="form" onSubmit={handleSaveRoleAndDetails}>
                    <DialogContent sx={{ px: { xs: 1, sm: 3 } }}>
                        {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {t("promote_dialog_desc", "Promoting a member to an officer role grants them board access without resetting their account or passwords.")}
                        </Typography>

                        <TextField
                            fullWidth
                            select
                            required
                            label={t("member_role", "Assigned Officer Role")}
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            margin="normal"
                            helperText={t("role_select_hint", "Select new club responsibility")}
                        >
                            {OFFICER_ROLES.map((r) => (
                                <MenuItem key={r.value} value={r.value}>
                                    {t(r.label, r.value)}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            fullWidth
                            required
                            label={t("member_name", "Full Name")}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            margin="normal"
                        />

                        <TextField
                            fullWidth
                            label={t("member_phone", "Phone Number")}
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            margin="normal"
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditTarget(null)} disabled={savingRole}>
                            {t("cancel_btn", "Cancel")}
                        </Button>
                        <Button type="submit" variant="contained" disabled={savingRole} sx={{ minHeight: 44, fontWeight: 800, bgcolor: "#002F6C" }}>
                            {savingRole ? <CircularProgress size={24} color="inherit" /> : t("save_role_btn", "Update Member Role")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog
                open={openAddDialog}
                onClose={() => setOpenAddDialog(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: { xs: 2, sm: 4 }, p: 1, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>➕ {t("add_member", "Add New Member")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateMember}>
                    <DialogContent sx={{ px: { xs: 1, sm: 3 } }}>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField
                            fullWidth
                            required
                            label={t("member_name", "Full Name")}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("email_label", "Email Address")}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label={t("member_phone", "Phone Number")}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            select
                            label={t("member_role", "Assigned Role")}
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            margin="normal"
                        >
                            {OFFICER_ROLES.map((r) => (
                                <MenuItem key={r.value} value={r.value}>
                                    {t(r.label, r.value)}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            fullWidth
                            select
                            label={t("member_language", "Preferred Language")}
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            margin="normal"
                        >
                            <MenuItem value="fi">Suomi (FI)</MenuItem>
                            <MenuItem value="sv">Svenska (SV)</MenuItem>
                            <MenuItem value="en">English (EN)</MenuItem>
                        </TextField>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setOpenAddDialog(false)} sx={{ minHeight: 44 }}>
                            {t("cancel_btn", "Cancel")}
                        </Button>
                        <Button type="submit" variant="contained" sx={{ minHeight: 44, fontWeight: 800, bgcolor: "#002F6C" }}>
                            {t("add_member", "Add Member")}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>

            {/* Temporary Password Display Modal */}
            <Dialog
                open={tempPassDialog.open}
                onClose={() => setTempPassDialog({ ...tempPassDialog, open: false })}
                maxWidth="xs"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3.5 } }}
            >
                <DialogTitle sx={{ bgcolor: "success.main", color: "white", fontWeight: 800 }}>
                    🔑 {t("temp_password_title", "Temporary Credentials Generated")}
                </DialogTitle>
                <DialogContent sx={{ pt: 3, textAlign: "center" }}>
                    <Typography variant="body1" sx={{ mb: 1, fontWeight: 800 }}>
                        {tempPassDialog.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t("temp_password_desc", "Share this readable temporary password with the member. They will be mandated to change it upon initial login.")}
                    </Typography>

                    <Paper
                        elevation={2}
                        sx={{
                            p: 2,
                            bgcolor: "grey.100",
                            borderRadius: 2.5,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: 1, color: "primary.main" }}>
                            {tempPassDialog.password}
                        </Typography>
                        <Tooltip title={copied ? t("password_copied", "Copied!") : t("copy_password", "Copy Password")}>
                            <IconButton color="primary" onClick={() => copyToClipboard(tempPassDialog.password)}>
                                <ContentCopyIcon />
                            </IconButton>
                        </Tooltip>
                    </Paper>

                    {copied && <Alert severity="success" sx={{ mt: 2, fontWeight: 700 }}>{t("password_copied", "Copied to clipboard!")}</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        variant="contained"
                        onClick={() => setTempPassDialog({ ...tempPassDialog, open: false })}
                        fullWidth
                        sx={{ minHeight: 48, fontWeight: 800 }}
                    >
                        {t("done_btn", "Done")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};