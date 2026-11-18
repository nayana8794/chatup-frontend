// chatup/frontend/src/theme/ThemeContext.tsx
import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

interface ThemeContextType {
    mode: "light" | "dark";
    toggleColorMode: () => void;
    clubLogo: string | null;
    brandPrimary: string | null;
    brandSecondary: string | null;
    applyClubBranding: (primary?: string | null, secondary?: string | null, logoUrl?: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    mode: "light",
    toggleColorMode: () => { },
    clubLogo: null,
    brandPrimary: null,
    brandSecondary: null,
    applyClubBranding: () => { },
});

export const useAppTheme = () => useContext(ThemeContext);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<"light" | "dark">("light");
    const [primaryHex, setPrimaryHex] = useState<string | null>(() => localStorage.getItem("chatup_primary_color"));
    const [secondaryHex, setSecondaryHex] = useState<string | null>(() => localStorage.getItem("chatup_secondary_color"));
    const [clubLogo, setClubLogo] = useState<string | null>(() => localStorage.getItem("chatup_club_logo"));

    const toggleColorMode = () => {
        setMode((prev) => (prev === "light" ? "dark" : "light"));
    };

    const applyClubBranding = useCallback((primary?: string | null, secondary?: string | null, logoUrl?: string | null) => {
        if (primary) {
            localStorage.setItem("chatup_primary_color", primary);
            setPrimaryHex(primary);
        } else {
            localStorage.removeItem("chatup_primary_color");
            setPrimaryHex(null);
        }

        if (secondary) {
            localStorage.setItem("chatup_secondary_color", secondary);
            setSecondaryHex(secondary);
        } else {
            localStorage.removeItem("chatup_secondary_color");
            setSecondaryHex(null);
        }

        if (logoUrl) {
            localStorage.setItem("chatup_club_logo", logoUrl);
            setClubLogo(logoUrl);
        } else {
            localStorage.removeItem("chatup_club_logo");
            setClubLogo(null);
        }
    }, []);

    const activePrimary = primaryHex || (mode === "light" ? "#002F6C" : "#4A90E2");
    const activeSecondary = secondaryHex || "#F2A900";

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    primary: {
                        main: activePrimary,
                    },
                    secondary: {
                        main: activeSecondary,
                    },
                    background: {
                        default: mode === "light" ? "#F8F9FA" : "#121212",
                        paper: mode === "light" ? "#FFFFFF" : "#1E1E1E",
                    },
                },
                typography: {
                    fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
                    fontSize: 16,
                    h4: {
                        fontWeight: 700,
                        fontSize: "2rem",
                    },
                    button: {
                        textTransform: "none",
                        fontWeight: 600,
                        fontSize: "1.1rem",
                    },
                },
                components: {
                    MuiButton: {
                        styleOverrides: {
                            root: {
                                borderRadius: 10,
                                minHeight: 52,
                            },
                        },
                    },
                    MuiTextField: {
                        styleOverrides: {
                            root: {
                                "& .MuiInputBase-root": {
                                    minHeight: 56,
                                    fontSize: "1.1rem",
                                },
                            },
                        },
                    },
                },
            }),
        [mode, activePrimary, activeSecondary]
    );

    return (
        <ThemeContext.Provider
            value={{
                mode,
                toggleColorMode,
                clubLogo,
                brandPrimary: primaryHex,
                brandSecondary: secondaryHex,
                applyClubBranding,
            }}
        >
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    );
};