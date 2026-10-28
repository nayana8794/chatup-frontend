// chatup/frontend/src/components/PushNotificationPrompt.tsx
import React, { useState, useEffect } from "react";
import { Paper, Typography, Button, Stack, Box, Slide, IconButton } from "@mui/material";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { subscribeToPushNotifications, isPushSubscribed } from "../utils/pushManager";

export const PushNotificationPrompt: React.FC = () => {
    const { t } = useTranslation();
    const [showPrompt, setShowPrompt] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const isDismissed = localStorage.getItem("chatup_push_dismissed") === "true";
        if (isDismissed) return;

        if ("Notification" in window && Notification.permission === "default") {
            isPushSubscribed()
                .then((subscribed) => {
                    if (!subscribed) {
                        setShowPrompt(true);
                    }
                })
                .catch(() => { });
        }
    }, []);

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem("chatup_push_dismissed", "true");
    };

    const handleEnable = async () => {
        setLoading(true);
        try {
            const success = await subscribeToPushNotifications();
            if (success) {
                setIsSuccess(true);
                localStorage.setItem("chatup_push_dismissed", "true");
                // Smoothly auto-close after 1.2 seconds of success feedback
                setTimeout(() => {
                    setShowPrompt(false);
                }, 1200);
            } else {
                // If dismissed or unsupported, close prompt cleanly
                handleDismiss();
            }
        } catch {
            handleDismiss();
        } finally {
            setLoading(false);
        }
    };

    if (!showPrompt) return null;

    return (
        <Slide direction="up" in={showPrompt} mountOnEnter unmountOnExit>
            <Paper
                elevation={8}
                sx={{
                    position: "fixed",
                    bottom: { xs: 80, sm: 24 },
                    right: { xs: 16, sm: 24 },
                    left: { xs: 16, sm: "auto" },
                    maxWidth: { xs: "none", sm: 420 },
                    zIndex: 9998,
                    p: 2.2,
                    borderRadius: 3.5,
                    bgcolor: "#002F6C",
                    border: "1.5px solid #F2A900",
                    boxShadow: "0 12px 36px rgba(0,0,0,0.5)",
                    color: "white",
                }}
            >
                <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                            {isSuccess ? (
                                <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: 26 }} />
                            ) : (
                                <NotificationsActiveIcon sx={{ color: "#F2A900", fontSize: 26 }} />
                            )}
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "white" }}>
                                {isSuccess
                                    ? t("push.success_title", "Notifications Enabled!")
                                    : t("push.title", "Enable Club Alerts")}
                            </Typography>
                        </Box>
                        <IconButton
                            size="small"
                            onClick={handleDismiss}
                            disabled={loading}
                            sx={{ color: "rgba(255,255,255,0.7)" }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
                        {isSuccess
                            ? t("push.success_desc", "You will now receive alerts for incoming meetings and messages.")
                            : t(
                                "push.desc",
                                "Get instant alerts on your lock screen for incoming Lions video meetings and urgent club messages."
                            )}
                    </Typography>

                    {!isSuccess && (
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end", pt: 0.5 }}>
                            <Button
                                size="small"
                                onClick={handleDismiss}
                                disabled={loading}
                                sx={{ color: "rgba(255,255,255,0.7)", textTransform: "none", fontWeight: 700 }}
                            >
                                {t("push.later", "Later")}
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                disabled={loading}
                                onClick={handleEnable}
                                sx={{
                                    bgcolor: "#F2A900",
                                    color: "#002F6C",
                                    fontWeight: 900,
                                    textTransform: "none",
                                    borderRadius: 2,
                                    px: 2,
                                    "&:hover": { bgcolor: "#d99800" },
                                }}
                            >
                                {loading ? t("push.enabling", "Enabling…") : t("push.enable", "Enable Notifications")}
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </Paper>
        </Slide>
    );
};