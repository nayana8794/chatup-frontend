// chatup/frontend/src/pages/Login.tsx
import React, { useState } from "react";
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Alert,
    MenuItem,
    Select,
    IconButton,
    Tooltip,
} from "@mui/material";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LanguageIcon from "@mui/icons-material/Language";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeContext";
import { useAuth } from "../context/AuthContext";
import apiClient from "../api/client";

export const Login: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { mode, toggleColorMode } = useAppTheme();
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang);
        localStorage.setItem("chatup_lang", lang); // සදහටම සුරැකීම
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.post("/auth/login", {
                email,
                password,
            });

            // Update AuthContext State
            login(response.data);

            // Auto-set preferred language
            if (response.data.language) {
                i18n.changeLanguage(response.data.language);
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || t("login_failed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", py: 4 }}>
            <Paper elevation={4} sx={{ p: 4, width: "100%", borderRadius: 4 }}>
                {/* Top Bar: Night Mode & Language Switcher */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LanguageIcon color="primary" />
                        <Select
                            size="small"
                            value={i18n.language}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            sx={{ fontWeight: "bold" }}
                        >
                            <MenuItem value="en">English (EN)</MenuItem>
                            <MenuItem value="fi">Suomi (FI)</MenuItem>
                            <MenuItem value="sv">Svenska (SV)</MenuItem>
                        </Select>
                    </Box>

                    <Tooltip title={mode === "dark" ? t("light_mode") : t("dark_mode")}>
                        <IconButton onClick={toggleColorMode} color="inherit">
                            {mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Branding Title */}
                <Box sx={{ textAlign: "center", mb: 3 }}>
                    <Typography variant="h4" color="primary" gutterBottom>
                        🦁 {t("app_name")}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t("login_subtitle")}
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3, fontSize: "1rem" }}>
                        {error}
                    </Alert>
                )}

                {/* Login Form */}
                <Box component="form" onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        required
                        id="email"
                        label={t("email_label")}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        margin="normal"
                        placeholder="president@lionshelsinki.fi"
                    />

                    <TextField
                        fullWidth
                        required
                        id="password"
                        label={t("password_label")}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        margin="normal"
                    />

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        disabled={loading}
                        sx={{ mt: 3 }}
                    >
                        {loading ? t("signing_in") : t("sign_in_button")}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
};