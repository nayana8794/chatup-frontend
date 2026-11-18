// chatup/frontend/src/components/ChatUpLogo.tsx
import React from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeContext";

interface ChatUpLogoProps {
    size?: number;
    useClubCrest?: boolean;
    srcOverride?: string;
}

export const ChatUpLogo: React.FC<ChatUpLogoProps> = ({
    size = 36,
    useClubCrest = false,
    srcOverride,
}) => {
    const { clubLogo } = useAppTheme();
    const src = srcOverride || (useClubCrest && clubLogo ? clubLogo : null) || "/chatup-logo.png";

    return (
        <Box
            component="img"
            src={src}
            alt="Club Logo"
            sx={{
                width: size,
                height: size,
                borderRadius: "50%",
                objectFit: "cover",
                display: "inline-block",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                border: "1.5px solid rgba(242, 169, 0, 0.55)",
            }}
        />
    );
};

interface ChatUpTitleProps {
    color?: string;
}

export const ChatUpTitle: React.FC<ChatUpTitleProps> = ({ color = "inherit" }) => {
    const { t } = useTranslation();
    const fullName = t("app_name", "ChatUp");

    if (fullName.toLowerCase().endsWith("up")) {
        const prefix = fullName.slice(0, -2);
        const suffix = fullName.slice(-2);
        return (
            <Box component="span" sx={{ color, fontWeight: 900, letterSpacing: 0.4 }}>
                {prefix}
                <Box component="span" sx={{ color: "#F2A900" }}>
                    {suffix}
                </Box>
            </Box>
        );
    }

    return (
        <Box component="span" sx={{ color, fontWeight: 900 }}>
            {fullName}
        </Box>
    );
};