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

export const MembersManagement: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    // Phone screens හඳුනා ගැනීම (Mobile View: screen width < 600px)
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    // Add Member Dialog states
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState("MEMBER");
    const [language, setLanguage] = useState("fi");
    const [error, setError] = useState<string | null>(null);

    // Temporary Password Display Dialog
    const [tempPassDialog, setTempPassDialog] = useState<{ open: boolean; name: string; password: string }>({
        open: false,
        name: "",
        password: "",
    });
    const [copied, setCopied] = useState(false);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const res = await apiClient.get("/members");
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
                phone_number: phone.trim() ? phone.trim() : null, // Empty string නම් null ලෙස යවයි
                role,
                language,
            });

            setOpenAddDialog(false);
            setFullName("");
            setEmail("");
            setPhone("");

            // Show temporary password modal
            setTempPassDialog({
                open: true,
                name: res.data.full_name,
                password: res.data.temp_password,
            });

            fetchMembers();
        } catch (err: any) {
            // 422 error එකක් ආවොත් field එක පැහැදිලිව පෙන්වීම
            const detail = err.response?.data?.detail;
            if (Array.isArray(detail)) {
                setError(detail.map((d: any) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(", "));
            } else {
                setError(detail || "Error adding member");
            }
        }
    };

    const handleResetPassword = async (member: Member) => {
        if (!window.confirm(`${member.full_name} සඳහා මුරපදය Reset කිරීමට අවශ්‍යද?`)) return;

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
        if (!window.confirm(`${t("confirm_delete")} (${member.full_name})`)) return;

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
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
            {/* Mobile-Friendly Header Bar (Fixed sx alignment) */}
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
                <Typography
                    variant="h5"
                    sx={{ fontWeight: "bold", textAlign: { xs: "center", sm: "left" } }}
                >
                    👥 {t("menu_members")}
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ fontWeight: "bold", minHeight: 48 }}
                >
                    {t("add_member")}
                </Button>
            </Stack>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress size={50} />
                </Box>
            ) : isMobile ? (
                /* ================= MOBILE VIEW: SENIOR-FRIENDLY CARDS ================= */
                <Stack spacing={2}>
                    {members.map((member) => (
                        <Card key={member.id} elevation={3} sx={{ borderRadius: 3, p: 1 }}>
                            <CardContent>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                                    <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
                                        {member.full_name}
                                    </Typography>
                                    <Chip
                                        label={member.role}
                                        color="primary"
                                        size="small"
                                        sx={{ fontWeight: "bold" }}
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

                                {/* Mobile Large Touch Action Buttons (Fixed sx alignment) */}
                                <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="warning"
                                        startIcon={<LockResetIcon />}
                                        onClick={() => handleResetPassword(member)}
                                        sx={{ fontWeight: "bold", minHeight: 40 }}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDeleteMember(member)}
                                        sx={{ fontWeight: "bold", minHeight: 40 }}
                                    >
                                        Delete
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            ) : (
                /* ================= DESKTOP VIEW: STANDARD TABLE ================= */
                <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 3 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: "primary.main" }}>
                            <TableRow>
                                <TableCell sx={{ color: "white", fontWeight: "bold", fontSize: "1.05rem" }}>
                                    {t("member_name")}
                                </TableCell>
                                <TableCell sx={{ color: "white", fontWeight: "bold", fontSize: "1.05rem" }}>
                                    {t("email_label")}
                                </TableCell>
                                <TableCell sx={{ color: "white", fontWeight: "bold", fontSize: "1.05rem" }}>
                                    {t("member_phone")}
                                </TableCell>
                                <TableCell sx={{ color: "white", fontWeight: "bold", fontSize: "1.05rem" }}>
                                    {t("member_role")}
                                </TableCell>
                                <TableCell align="center" sx={{ color: "white", fontWeight: "bold", fontSize: "1.05rem" }}>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {members.map((member) => (
                                <TableRow key={member.id} hover>
                                    <TableCell sx={{ fontWeight: "bold", fontSize: "1rem" }}>{member.full_name}</TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>{member.phone_number || "-"}</TableCell>
                                    <TableCell>
                                        <Chip label={member.role} color="primary" variant="outlined" sx={{ fontWeight: "bold" }} />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Box sx={{ display: "flex", justifyContent: "center", gap: 1 }}>
                                            <Tooltip title={t("reset_password")}>
                                                <IconButton color="warning" onClick={() => handleResetPassword(member)}>
                                                    <LockResetIcon fontSize="medium" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t("delete_member")}>
                                                <IconButton color="error" onClick={() => handleDeleteMember(member)}>
                                                    <DeleteIcon fontSize="medium" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Add Member Dialog */}
            <Dialog
                open={openAddDialog}
                onClose={() => setOpenAddDialog(false)}
                maxWidth="sm"
                fullWidth
                sx={{ "& .MuiDialog-paper": { m: { xs: 2, sm: 4 }, p: 1, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: "bold" }}>➕ {t("add_member")}</DialogTitle>
                <Box component="form" onSubmit={handleCreateMember}>
                    <DialogContent sx={{ px: { xs: 1, sm: 3 } }}>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <TextField
                            fullWidth
                            required
                            label={t("member_name")}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            required
                            type="email"
                            label={t("email_label")}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label={t("member_phone")}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            select
                            label={t("member_role")}
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            margin="normal"
                        >
                            <MenuItem value="MEMBER">Member</MenuItem>
                            <MenuItem value="VICE_PRESIDENT">Vice President</MenuItem>
                            <MenuItem value="SECRETARY">Secretary</MenuItem>
                            <MenuItem value="VICE_SECRETARY">Vice Secretary</MenuItem>
                            <MenuItem value="PLANNER">Planner</MenuItem>
                            <MenuItem value="VICE_PLANNER">Vice Planner</MenuItem>
                            <MenuItem value="TREASURER">Treasurer</MenuItem>
                            <MenuItem value="VICE_TREASURER">Vice Treasurer</MenuItem>
                        </TextField>
                        <TextField
                            fullWidth
                            select
                            label={t("member_language")}
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
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" color="primary" sx={{ minHeight: 44, fontWeight: "bold" }}>
                            {t("add_member")}
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
                sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3 } }}
            >
                <DialogTitle sx={{ bgcolor: "success.main", color: "white", fontWeight: "bold" }}>
                    🔑 {t("temp_password_title")}
                </DialogTitle>
                <DialogContent sx={{ pt: 3, textAlign: "center" }}>
                    <Typography variant="body1" sx={{ mb: 1, fontWeight: "bold" }}>
                        {tempPassDialog.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {t("temp_password_desc")}
                    </Typography>

                    <Paper
                        elevation={2}
                        sx={{
                            p: 2,
                            bgcolor: "grey.100",
                            borderRadius: 2,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <Typography variant="h5" sx={{ fontWeight: "bold", letterSpacing: 1, color: "primary.main" }}>
                            {tempPassDialog.password}
                        </Typography>
                        <Tooltip title={copied ? t("password_copied") : t("copy_password")}>
                            <IconButton color="primary" onClick={() => copyToClipboard(tempPassDialog.password)}>
                                <ContentCopyIcon />
                            </IconButton>
                        </Tooltip>
                    </Paper>

                    {copied && <Alert severity="success" sx={{ mt: 2 }}>{t("password_copied")}</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        variant="contained"
                        onClick={() => setTempPassDialog({ ...tempPassDialog, open: false })}
                        fullWidth
                        sx={{ minHeight: 48, fontWeight: "bold" }}
                    >
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};