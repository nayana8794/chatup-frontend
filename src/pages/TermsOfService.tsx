// chatup/frontend/src/pages/TermsOfService.tsx
import React from "react";
import { Container, Paper, Typography, Button, Box } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { ChatUpLogo, ChatUpTitle } from "../components/ChatUpLogo";

export const TermsOfService: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
                        <ChatUpTitle /> — {t("Terms of Service")}
                    </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {t("Effective Date: November 2026 • Governing Law: Finland & European Union.")}
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                    {t("1. Acceptance of SaaS License Terms")}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    {t("By accessing or using the ChatUp platform, community associations (Lions Clubs, Rotary Clubs, and European societies) agree to be bound by these terms and valid annual/monthly subscription licensing agreements.")}
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                    {t("2. Statutory Governance & Audit Integrity")}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    {t("Club executives (Presidents, Treasurers, Secretaries) are solely responsible for verifying the accuracy of financial ledger entries, MS Excel studio spreadsheets, and published meeting minutes (MOM) prior to statutory auditor (Tilintarkastaja) inspection.")}
                </Typography>

                <Typography variant="h6" sx={{ fontWeight: 800, mt: 3, mb: 1 }}>
                    {t("3. Billing & SEPA Invoicing")}
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                    {t("Annual flat-rate licenses and flexible per-member plans are billed via SEPA bank transfer or authorized payment gateways. Subscriptions automatically renew unless formally decommissioned by the Super Admin or Club President.")}
                </Typography>
            </Paper>
        </Container>
    );
};