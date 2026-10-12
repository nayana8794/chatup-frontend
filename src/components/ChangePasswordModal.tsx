// chatup/frontend/src/components/ChangePasswordModal.tsx
import React, { useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Typography,
    Alert,
    Box,
    InputAdornment,
    IconButton,
    Stack,
    Divider,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LogoutIcon from "@mui/icons-material/Logout";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";

export const ChangePasswordModal: React.FC = () => {
    const { t } = useTranslation();
    const { user, clearMustChangePassword, logout } = useAuth();

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // User ගේ `must_change_password` true නම් පමණක් මෙම dialog එක විවෘත වේ
    const open = Boolean(user?.must_change_password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setError(t("new_password"));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await apiClient.post("/auth/change-password", {
                old_password: oldPassword,
                new_password: newPassword,
            });

            // Clear the temporary flag in state & localStorage
            clearMustChangePassword();
            alert("Password updated successfully!");
        } catch (err: any) {
            setError(err.response?.data?.detail || "Password change failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            maxWidth="sm"
            fullWidth
            // onClose prop එකක් නැති නිසා backdrop click කර හෝ ESC ඔබා Dialog එක වැසිය නොහැක
            sx={{ "& .MuiDialog-paper": { m: 2, borderRadius: 3, p: 1 } }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    bgcolor: "warning.main",
                    color: "warning.contrastText",
                    borderRadius: 2,
                    py: 2,
                }}
            >
                <LockResetIcon fontSize="large" />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {t("change_password_title")}
                </Typography>
            </DialogTitle>

            <Box component="form" onSubmit={handleSubmit}>
                <DialogContent sx={{ pt: 3 }}>
                    <Typography variant="body1" sx={{ mb: 2, color: "text.primary", fontWeight: 500 }}>
                        {t("change_password_desc")}
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2, fontWeight: "bold" }}>
                            {error}
                        </Alert>
                    )}

                    <Stack spacing={2.5}>
                        {/* Old Password Input (MUI v6 slotProps syntax) */}
                        <TextField
                            fullWidth
                            required
                            type={showPassword ? "text" : "password"}
                            label={t("old_password")}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="Lions@xxxxxx"
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />

                        {/* New Permanent Password Input */}
                        <TextField
                            fullWidth
                            required
                            type={showPassword ? "text" : "password"}
                            label={t("new_password")}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            helperText={t("password_length")}
                        />

                        {/* Confirm New Password Input */}
                        <TextField
                            fullWidth
                            required
                            type={showPassword ? "text" : "password"}
                            label={t("confirm_new_password")}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </Stack>
                </DialogContent>

                <Divider sx={{ my: 1 }} />

                <DialogActions sx={{ p: 2.5, justifyContent: "space-between" }}>
                    {/* Escape hatch for users who want to log out instead */}
                    <Button
                        variant="text"
                        color="error"
                        startIcon={<LogoutIcon />}
                        onClick={logout}
                        sx={{ fontWeight: "bold" }}
                    >
                        {t("logout")}
                    </Button>

                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={loading}
                        sx={{ minHeight: 48, px: 4, fontWeight: "bold", fontSize: "1rem" }}
                    >
                        {loading ? "Updating..." : t("update_password_btn")}
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
};