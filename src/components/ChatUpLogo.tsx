// chatup/frontend/src/components/ChatUpLogo.tsx
import React from "react";
import { Box } from "@mui/material";
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