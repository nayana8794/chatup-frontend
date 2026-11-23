// chatup/frontend/src/pages/PrivacyPolicy.tsx
import React from "react";
import { Container, Paper, Typography, Button, Box } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { ChatUpLogo, ChatUpTitle } from "../components/ChatUpLogo";

export const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useTranslation();

    return (
        <Container maxWidth="md" sx={{ py: 6, px: { xs: 2, sm: 3 } }}>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
                variant="outlined"
                sx={{ mb: 3, fontWeight: 800, borderRadius: 2.5 }}
            >
                {t("back_btn", "Back")}
            </Button>

            <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
                    <ChatUpLogo size={42} />
                    <Typography variant="h4" sx={{ fontWeight: 900, color: "primary.main" }}>
                        <ChatUpTitle /> — Privacy Policy (GDPR)
                    </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Last updated: November 2026 • Compliant with EU General Data Protection Regulation (2016/679).
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                    1. Data Controller & Hosting
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    ChatUp SaaS operates under strict European data residency standards. All serverless databases (Neon PostgreSQL) are hosted in AWS Europe Central 1 (Frankfurt, Germany) to guarantee 100% GDPR compliance.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                    2. Information We Collect
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    We collect only necessary professional association details: full names, official organizational email addresses, phone numbers for treasury dues/MobilePay verification, and meeting minutes/financial ledger entries recorded by authorized club officers.
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                    3. Your Rights (Art. 15–22 GDPR)
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    Club members and executives retain the absolute right to access, rectify, or request permanent erasure of their personal data by contacting their local Club President or Super Admin.
                </Typography>
            </Paper>
        </Container>
    );
};